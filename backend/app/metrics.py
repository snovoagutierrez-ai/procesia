from sqlalchemy.orm import Session, selectinload, joinedload
from app import models, schemas
from decimal import Decimal
from collections import defaultdict, deque


def _branch_frequencies(flow_nodes, sequence_flows, task_bpmn_ids):
    """Frecuencia esperada de ejecución por nodo (1.0 = siempre se ejecuta).

    Propaga "flujo" desde 'start': en compuertas exclusivas reparte según
    branch_probability (equiprobable si no está definida); en paralelas cada
    rama recibe el flujo completo. Los ciclos de retrabajo convergen porque
    cada vuelta multiplica por p<1 (corte en aportes < 0.5%).

    Devuelve (freq_map, is_weighted). Nodos no alcanzados desde 'start'
    (proceso en construcción) no aparecen en el mapa — el caller usa 1.0
    para no ocultar su tiempo.
    """
    node_type = {fn.bpmn_id: str(fn.node_type.value if hasattr(fn.node_type, "value") else fn.node_type)
                 for fn in flow_nodes}
    known = set(task_bpmn_ids) | set(node_type.keys()) | {"start", "end"}

    out_edges = defaultdict(list)
    for f in sequence_flows:
        if f.source_ref in known and f.target_ref in known:
            out_edges[f.source_ref].append(f)

    # ¿Hay al menos una bifurcación exclusiva real? Si no, todo pesa 1.0.
    is_weighted = any(
        len(outs) > 1 and "parallel" not in node_type.get(src, "")
        for src, outs in out_edges.items()
    )

    freq = defaultdict(float)
    freq["start"] = 1.0
    queue = deque([("start", 1.0)])
    max_pushes = max(200, len(known) * 40)  # tope de seguridad ante grafos patológicos
    pushes = 0
    while queue and pushes < max_pushes:
        node, flow = queue.popleft()
        pushes += 1
        outs = out_edges.get(node, [])
        if not outs:
            continue
        if "parallel" in node_type.get(node, ""):
            shares = [flow] * len(outs)
        elif len(outs) == 1:
            shares = [flow]
        else:
            probs = [float(o.branch_probability) if o.branch_probability is not None else None for o in outs]
            defined = [p for p in probs if p is not None]
            if not defined:
                shares = [flow / len(outs)] * len(outs)  # equiprobable
            else:
                total = sum(defined)
                if total <= 0:
                    shares = [flow / len(outs)] * len(outs)
                else:
                    # Ramas sin probabilidad definida junto a otras definidas → 0
                    shares = [flow * ((p or 0.0) / total) for p in probs]
        for edge, share in zip(outs, shares):
            if share < 0.005:  # corta ciclos de retrabajo (convergencia geométrica)
                continue
            freq[edge.target_ref] += share
            queue.append((edge.target_ref, share))

    # El flujo acumulado nunca representa más de 1 ejecución por instancia
    # (los ciclos de retrabajo pueden superar 1.0 legítimamente: la tarea se
    # repite; cap defensivo alto solo contra grafos degenerados).
    return {k: min(v, 10.0) for k, v in freq.items()}, is_weighted


def _main_path_lead_time(flow_nodes, sequence_flows, task_times):
    """Lead time del camino más probable inicio→fin (greedy por probabilidad;
    en paralelas toma la rama más larga). None si no se alcanza 'end'."""
    node_type = {fn.bpmn_id: str(fn.node_type.value if hasattr(fn.node_type, "value") else fn.node_type)
                 for fn in flow_nodes}
    out_edges = defaultdict(list)
    for f in sequence_flows:
        out_edges[f.source_ref].append(f)

    def walk(node, visited):
        if node == "end":
            return 0.0
        if node in visited:
            return None  # ciclo: el camino principal no repite nodos
        visited = visited | {node}
        total = task_times.get(node, 0.0)
        outs = out_edges.get(node, [])
        if not outs:
            return None
        if "parallel" in node_type.get(node, "") and len(outs) > 1:
            branches = [walk(o.target_ref, visited) for o in outs]
            branches = [b for b in branches if b is not None]
            return (total + max(branches)) if branches else None
        # Exclusiva/secuencia: rama de mayor probabilidad (indefinida = -1)
        best = max(outs, key=lambda o: float(o.branch_probability) if o.branch_probability is not None else -1.0)
        rest = walk(best.target_ref, visited)
        return (total + rest) if rest is not None else None

    try:
        return walk("start", frozenset())
    except RecursionError:
        return None


def calculate_process_metrics(db: Session, process_id: int) -> schemas.ProcessMetricsResponse:
    process = (
        db.query(models.Process)
        .options(
            selectinload(models.Process.activities)
            .selectinload(models.Activity.tasks)
            .selectinload(models.Task.raci)
            .selectinload(models.TaskRaci.role),
            selectinload(models.Process.activities)
            .selectinload(models.Activity.tasks)
            .selectinload(models.Task.systems)
            .selectinload(models.TaskSystem.system),
        )
        .filter(models.Process.id == process_id)
        .first()
    )
    if not process:
        raise ValueError(f"Process {process_id} not found")

    # Fetch tasks in order
    tasks = []
    # Sort activities by position_order, then tasks by position_order
    for activity in sorted(process.activities, key=lambda a: a.position_order):
        for task in sorted(activity.tasks, key=lambda t: t.position_order):
            tasks.append(task)
            
    total_tasks = len(tasks)
    if total_tasks == 0:
        return schemas.ProcessMetricsResponse(
            process_id=process_id,
            total_cycle_time_sec=0.0,
            total_wait_time_sec=0.0,
            lead_time_sec=0.0,
            pce_percentage=0.0,
            structural=schemas.StructuralMetrics(
                va_count=0, nnva_count=0, nva_count=0, total_tasks=0,
                rework_rate_percentage=0.0, unique_systems_count=0,
                system_jumps=0, handoffs_count=0
            ),
            bottlenecks=[],
            cost=_build_cost(0.0, 0.0, process.monthly_volume)
        )

    # 0. Frecuencias esperadas por rama (compuertas exclusivas con probabilidad).
    # Sin grafo ramificado, todo pesa 1.0 y el cálculo es el lineal de siempre.
    freq_map, is_weighted = _branch_frequencies(
        process.flow_nodes, process.sequence_flows, [t.bpmn_id for t in tasks]
    )
    # Tareas no alcanzadas desde 'start' (proceso en construcción): peso 1.0
    # para no ocultar su tiempo mientras se conectan.
    def w(t):
        return freq_map.get(t.bpmn_id, 1.0) if is_weighted else 1.0

    # 1. Base Times (valor esperado por ejecución)
    total_cycle = sum(float(t.std_cycle_time_sec) * w(t) for t in tasks)
    total_wait = sum(float(t.std_wait_time_sec) * w(t) for t in tasks)
    lead_time = total_cycle + total_wait

    # 2. PCE
    va_cycle = sum(float(t.std_cycle_time_sec) * w(t) for t in tasks if t.value_classification == models.ValueClass.VA)
    pce = (va_cycle / lead_time * 100) if lead_time > 0 else 0.0

    # 2b. Lead time del camino principal (solo con grafo ramificado)
    main_path_lead = None
    if is_weighted:
        task_times = {t.bpmn_id: float(t.std_cycle_time_sec) + float(t.std_wait_time_sec) for t in tasks}
        main_path_lead = _main_path_lead_time(process.flow_nodes, process.sequence_flows, task_times)

    # 3. Structural Metrics
    va_count = sum(1 for t in tasks if t.value_classification == models.ValueClass.VA)
    nnva_count = sum(1 for t in tasks if t.value_classification == models.ValueClass.NNVA)
    nva_count = sum(1 for t in tasks if t.value_classification == models.ValueClass.NVA)
    
    rework_count = sum(1 for t in tasks if t.waste_type == models.WasteType.defects)
    rework_rate = (rework_count / total_tasks * 100)
    
    systems_used = set()
    prev_system = None
    system_jumps = 0
    
    prev_executor = None
    handoffs = 0
    
    total_cost = 0.0
    nva_cost = 0.0
    
    # N+1 mitigado con selectinload en el caller — ver eager loading arriba
    for i, t in enumerate(tasks):
        # Systems
        task_sys = [ts.system for ts in t.systems if ts.system]
        for s in task_sys:
            systems_used.add(s.id)
            
        current_sys = task_sys[0].id if task_sys else None
        if i > 0 and current_sys and prev_system and current_sys != prev_system:
            system_jumps += 1
        prev_system = current_sys if current_sys else prev_system
        
        # RACI, Handoffs & Costo
        # El EJECUTOR del trabajo es el Responsible (R). Tanto el costo de mano de
        # obra como los handoffs (traspasos) se miden sobre quien REALIZA la tarea,
        # no sobre el Accountable: el Accountable suele ser constante en todo el
        # proceso (un jefe), lo que sub-reporta handoffs y distorsiona el costo
        # (cobra a tarifa de gerente trabajo ejecutado por personal junior).
        resp_roles = [tr.role for tr in t.raci if tr.raci_type == models.RaciType.R]
        executor_roles = resp_roles
        if not executor_roles:
            # Fallback: Accountable, luego cualquier rol asignado
            executor_roles = [tr.role for tr in t.raci if tr.raci_type == models.RaciType.A]
        if not executor_roles and t.raci:
            executor_roles = [t.raci[0].role]

        current_exec = executor_roles[0].id if executor_roles else None

        if i > 0 and current_exec and prev_executor and current_exec != prev_executor:
            handoffs += 1
        prev_executor = current_exec if current_exec else prev_executor

        # Costo de mano de obra = tiempo de ciclo × tarifa del ejecutor (Responsible),
        # ponderado por la frecuencia esperada de la rama.
        if executor_roles and executor_roles[0].cost_per_hour is not None:
            cph = float(executor_roles[0].cost_per_hour)
            task_cost = (float(t.std_cycle_time_sec) / 3600.0) * cph * w(t)
            total_cost += task_cost
            if t.value_classification == models.ValueClass.NVA:
                nva_cost += task_cost

    # 4. Bottlenecks (TOC) — sobre tiempos por tarea SIN ponderar: el cuello de
    # botella se evalúa cuando la tarea efectivamente se ejecuta, sin importar
    # cuán probable sea su rama.
    avg_cycle = sum(float(t.std_cycle_time_sec) for t in tasks) / total_tasks
    avg_wait = sum(float(t.std_wait_time_sec) for t in tasks) / total_tasks
    
    bottlenecks = []
    for t in tasks:
        c_time = float(t.std_cycle_time_sec)
        w_time = float(t.std_wait_time_sec)
        
        if avg_cycle > 0 and c_time > 1.5 * avg_cycle:
            bottlenecks.append(schemas.MetricBottleneck(
                task_id=t.id,
                bpmn_id=t.bpmn_id,
                name=t.name,
                metric_type="cycle_time",
                value_sec=c_time,
                deviation_factor=c_time / avg_cycle
            ))
            
        if avg_wait > 0 and w_time > 1.5 * avg_wait:
            bottlenecks.append(schemas.MetricBottleneck(
                task_id=t.id,
                bpmn_id=t.bpmn_id,
                name=t.name,
                metric_type="wait_time",
                value_sec=w_time,
                deviation_factor=w_time / avg_wait
            ))

    return schemas.ProcessMetricsResponse(
        process_id=process_id,
        total_cycle_time_sec=total_cycle,
        total_wait_time_sec=total_wait,
        lead_time_sec=lead_time,
        pce_percentage=pce,
        structural=schemas.StructuralMetrics(
            va_count=va_count,
            nnva_count=nnva_count,
            nva_count=nva_count,
            total_tasks=total_tasks,
            rework_rate_percentage=rework_rate,
            unique_systems_count=len(systems_used),
            system_jumps=system_jumps,
            handoffs_count=handoffs
        ),
        bottlenecks=bottlenecks,
        cost=_build_cost(total_cost, nva_cost, process.monthly_volume),
        is_branch_weighted=is_weighted,
        main_path_lead_time_sec=main_path_lead
    )


def _build_cost(total_cost, nva_cost, monthly_volume):
    """Costo por ejecución + proyección mensual/anual según el volumen del proceso."""
    vol = float(monthly_volume) if monthly_volume is not None else None
    monthly = total_cost * vol if vol is not None else None
    annual = monthly * 12 if monthly is not None else None
    monthly_nva = nva_cost * vol if vol is not None else None
    return schemas.MetricCost(
        total_cost=total_cost,
        nva_cost=nva_cost,
        monthly_cost=monthly,
        annual_cost=annual,
        monthly_nva_cost=monthly_nva,
    )
