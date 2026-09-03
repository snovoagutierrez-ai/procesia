import json
import time
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict
from pydantic import ValidationError
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models, schemas
from app.config import settings
from app.metrics import calculate_process_metrics
import os

SYSTEM_PROMPT = """Eres un motor experto en optimización de procesos bajo metodologías Lean, Six Sigma y
BPMN 2.0. Recibirás un objeto JSON que representa el levantamiento transaccional de un
proceso, incluyendo jerarquía, asignación RACI, sistemas involucrados y una sección especial
"metrics" con los cálculos matemáticos reales y exactos (tiempos, desperdicios, cuellos de botella).

Tu ÚNICA función es analizar cualitativamente estos datos y devolver EXCLUSIVAMENTE un objeto JSON válido
conforme al esquema de salida. NO DEBES calcular métricas, asume que las métricas entregadas en "metrics"
son perfectas. Tu trabajo es interpretar la causa raíz (inefficiencies) y generar recomendaciones estructuradas 
y un flujo optimizado (optimized_flow).
IMPORTANTE: Todo el texto generado en descripciones, motivos, recomendaciones y campos similares DEBE estar estrictamente en Español.

REGLAS DE ANÁLISIS
1. Cuellos de botella y Summary: En tu respuesta, puedes devolver datos vacíos o replicar lo que 
   te enviamos. El sistema sobrescribirá esos campos con la matemática exacta, pero dedícate a 
   leer "metrics.bottlenecks" para fundamentar tus recomendaciones.
2. Desperdicios (Inefficiencies): Por cada tarea NVA o cuello de botella encontrado en "metrics",
   clasifica su causa raíz según los 8 desperdicios Lean. El campo waste_type DEBE ser exactamente
   uno de: defects, overproduction, waiting, non_utilized_talent, transportation, inventory,
   motion, excess_processing. El campo severity en bottlenecks DEBE ser exactamente uno de: low, medium, high, critical.
3. RACI: detecta anomalías — más de un 'A' (Accountable) en una tarea, ausencia de 'A',
   o exceso de handoffs entre roles distintos en tareas consecutivas.
3b. Ramas y decisiones: "sequence_flows" incluye condition_expression (ej. "Sí"/"No") y
   branch_probability (0-100, % de instancias que toman esa rama al salir de una compuerta
   exclusiva). Pondera el impacto de tus recomendaciones por esa probabilidad: una rama de
   retrabajo con probabilidad alta es un hallazgo prioritario (defects); una rama del 5%
   rara vez justifica recomendaciones de alto esfuerzo.
4. Sistemas: detecta saltos innecesarios entre sistemas (context switching) y
   oportunidades de automatización o integración.
5. Recomendaciones: por cada hallazgo cualitativo o matemático, propón una acción concreta.
   - action_type DEBE ser exactamente uno de: ELIMINATE, AUTOMATE, SIMPLIFY, MERGE, PARALLELIZE, REASSIGN, STANDARDIZE
   - implementation_complexity DEBE ser exactamente uno de: low, medium, high
   Estima estimated_time_saving_pct (0-100).
   PRIORIZACIÓN POR IMPACTO ANUALIZADO: si "monthly_volume" está presente, prioriza
   (campo priority, menor = más urgente) las recomendaciones por impacto = ahorro por
   instancia × volumen mensual, no solo por % de ahorro. Un ahorro pequeño en un proceso
   de alto volumen supera a un ahorro grande en uno de bajo volumen.
6. ERRORES DE CONSTRUCCIÓN DEL FLUJO (prioridad máxima): el campo "flow_issues" del
   JSON de entrada lista los nodos mal conectados detectados en el diagrama
   (isolated = suelto, dead_end = sin salida, unreachable = sin entrada,
   gateway_not_branching = compuerta con menos de 2 salidas, unlabeled_branches =
   ramas Sí/No sin etiquetar, probabilities_not_100, start_disconnected,
   end_disconnected). Si "flow_issues" NO está vacío:
   - Emite una recomendación por CADA issue, ANTES que cualquier mejora de tiempos,
     con priority más bajo (1, 2, 3...) porque un flujo mal armado invalida las métricas.
   - action_type = "STANDARDIZE" y target_node_bpmn_id = el node_bpmn_id del issue.
   - En description di EXACTAMENTE qué nodo está mal y CÓMO corregirlo en el editor
     (ej.: "La tarea 'Revisar' no tiene salida: arrastra una flecha desde su punto
     derecho hacia la siguiente tarea o hacia Fin"). Nombra siempre el nodo por su
     node_name para que el usuario lo ubique en el diagrama.
   - Refleja en analysis_confidence que las métricas no son fiables con el flujo roto.
7. optimized_flow: propón un grafo reestructurado SOLO si aporta una mejora estructural
   real (paralelizar, fusionar o eliminar pasos). Es una propuesta OPCIONAL que el
   usuario aplica de forma explícita y que REEMPLAZA su diagrama completo, así que:
   - Pon "applies": false cuando tus recomendaciones se puedan implementar sobre el
     flujo existente sin rediseñarlo, o cuando haya flow_issues sin resolver.
     Ante la duda, "applies": false — nunca reestructures un flujo solo para mostrar
     un cambio; el usuario perdería el diagrama que construyó a mano.
   - Si es true, CONSERVA los bpmn_id y nombres de las tareas que no cambian, y
     mantén las etiquetas/condiciones de las ramas existentes.

Si faltan datos para algún análisis, refléjalo reduciendo analysis_confidence (0.0-1.0).
La respuesta DEBE ser únicamente el siguiente objeto JSON:

{
  "process_id": "string",
  "analysis_confidence": 0.0,
  "summary": {
    "total_cycle_time_sec": 0, "total_wait_time_sec": 0,
    "value_added_ratio": 0.0, "nva_task_count": 0, "handoff_count": 0
  },
  "bottlenecks": [
    {"node_bpmn_id":"string","node_name":"string",
     "metric":"cycle_time","value_sec":0,
     "deviation_factor":0.0,"severity":"high",
     "impact_description":"string"}
  ],
  "inefficiencies": [
    {"node_bpmn_id":"string",
     "waste_type":"waiting",
     "description":"string","root_cause":"string"}
  ],
  "recommendations": [
    {"id":"string","target_node_bpmn_id":null,
     "action_type":"SIMPLIFY",
     "description":"string","expected_benefit":"string",
     "estimated_time_saving_pct":0,"implementation_complexity":"low",
     "priority":0}
  ],
  "optimized_flow": {
    "applies": false,
    "nodes": [
      {"bpmn_id":"string","type":"task","subtype":"string",
       "name":"string","cycle_time_sec":0,"wait_time_sec":0,
       "value_classification":"VA"}
    ],
    "flows": [
      {"bpmn_id":"string","source_ref":"string","target_ref":"string",
       "name":"string","condition":"string|null"}
    ]
  }
}"""

def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def detect_flow_issues(tasks_data, flow_nodes_data, sequence_flows_data) -> list:
    """Errores ESTRUCTURALES del diagrama (no de tiempos).

    La IA solo recibía tiempos y RACI, por eso nunca podía decir *dónde* estaba
    roto el flujo. Aquí se detecta lo mismo que el aviso amarillo del editor, y
    se le entrega para que señale el nodo exacto y cómo corregirlo.
    """
    issues = []
    name_by_id = {}
    for t in tasks_data:
        name_by_id[t["bpmn_id"]] = t["name"]
    for n in flow_nodes_data:
        name_by_id[n["bpmn_id"]] = n.get("name") or "Compuerta"

    outgoing, incoming = {}, {}
    for f in sequence_flows_data:
        outgoing.setdefault(f["source_ref"], []).append(f)
        incoming.setdefault(f["target_ref"], []).append(f)

    for t in tasks_data:
        bid = t["bpmn_id"]
        has_in, has_out = bool(incoming.get(bid)), bool(outgoing.get(bid))
        if not has_in and not has_out:
            issues.append({"node_bpmn_id": bid, "node_name": t["name"], "issue": "isolated",
                           "detail": "La tarea está suelta: no tiene flecha de entrada ni de salida, por lo que no forma parte del flujo."})
        elif not has_out:
            issues.append({"node_bpmn_id": bid, "node_name": t["name"], "issue": "dead_end",
                           "detail": "La tarea no tiene salida: el proceso se corta aquí y nunca llega al Fin."})
        elif not has_in:
            issues.append({"node_bpmn_id": bid, "node_name": t["name"], "issue": "unreachable",
                           "detail": "La tarea no tiene entrada: nunca se alcanza desde el Inicio."})

    for n in flow_nodes_data:
        node_type = str(n.get("node_type") or "")
        if "ateway" not in node_type:
            continue
        bid = n["bpmn_id"]
        outs = outgoing.get(bid, [])
        if len(outs) < 2:
            issues.append({"node_bpmn_id": bid, "node_name": n.get("name") or "Compuerta", "issue": "gateway_not_branching",
                           "detail": f"La compuerta tiene {len(outs)} salida(s); una decisión necesita al menos 2 caminos."})
        if not incoming.get(bid):
            issues.append({"node_bpmn_id": bid, "node_name": n.get("name") or "Compuerta", "issue": "unreachable",
                           "detail": "La compuerta no tiene entrada: nunca se llega a esta decisión."})
        if "exclusive" in node_type and len(outs) >= 2:
            sin_etiqueta = [o for o in outs if not (o.get("condition_expression") or o.get("name"))]
            if sin_etiqueta:
                issues.append({"node_bpmn_id": bid, "node_name": n.get("name") or "Compuerta", "issue": "unlabeled_branches",
                               "detail": f"{len(sin_etiqueta)} de {len(outs)} ramas no tienen etiqueta (Sí/No): el criterio de la decisión es ambiguo."})
            probs = [o.get("branch_probability") for o in outs if o.get("branch_probability") is not None]
            if probs and abs(sum(probs) - 100) > 1:
                issues.append({"node_bpmn_id": bid, "node_name": n.get("name") or "Compuerta", "issue": "probabilities_not_100",
                               "detail": f"Las probabilidades de las ramas suman {round(sum(probs))}% en vez de 100%."})

    if tasks_data and not outgoing.get("start"):
        issues.append({"node_bpmn_id": "start", "node_name": "Inicio", "issue": "start_disconnected",
                       "detail": "El evento de Inicio no está conectado a ninguna tarea."})
    if tasks_data and not incoming.get("end"):
        issues.append({"node_bpmn_id": "end", "node_name": "Fin", "issue": "end_disconnected",
                       "detail": "Ninguna tarea conduce al evento de Fin: el proceso no tiene cierre."})
    return issues


def build_process_snapshot(db: Session, process_id: int) -> Dict[str, Any]:
    process = db.query(models.Process).filter(models.Process.id == process_id).first()
    if not process:
        raise ValueError(f"Process with id {process_id} not found")

    activities_data = []
    for activity in process.activities:
        tasks_data = []
        for task in activity.tasks:
            # Fetch RACI assignments
            raci_assignments = []
            raci_list = db.query(models.TaskRaci, models.Role).join(models.Role).filter(models.TaskRaci.task_id == task.id).all()
            for tr, role in raci_list:
                raci_assignments.append({
                    "role_id": role.id,
                    "role_name": role.name,
                    "area": role.area,
                    "cost_per_hour": float(role.cost_per_hour) if role.cost_per_hour is not None else None,
                    "raci_type": tr.raci_type
                })

            # Fetch System assignments
            system_assignments = []
            system_list = db.query(models.TaskSystem, models.System).join(models.System).filter(models.TaskSystem.task_id == task.id).all()
            for ts, system in system_list:
                system_assignments.append({
                    "system_id": system.id,
                    "system_name": system.name,
                    "system_type": system.system_type,
                    "vendor": system.vendor,
                    "interaction_type": ts.interaction_type
                })

            tasks_data.append({
                "task_id": task.id,
                "bpmn_id": task.bpmn_id,
                "name": task.name,
                "description": task.description,
                "position_order": task.position_order,
                "task_type": task.task_type,
                "value_classification": task.value_classification,
                "waste_type": task.waste_type,
                "std_cycle_time_sec": float(task.std_cycle_time_sec) if task.std_cycle_time_sec is not None else 0.0,
                "std_wait_time_sec": float(task.std_wait_time_sec) if task.std_wait_time_sec is not None else 0.0,
                "raci": raci_assignments,
                "systems": system_assignments
            })

        activities_data.append({
            "activity_id": activity.id,
            "name": activity.name,
            "position_order": activity.position_order,
            "tasks": tasks_data
        })

    flow_nodes_data = []
    for fn in process.flow_nodes:
        flow_nodes_data.append({
            "bpmn_id": fn.bpmn_id,
            "node_type": fn.node_type,
            "name": fn.name
        })

    sequence_flows_data = []
    for sf in process.sequence_flows:
        sequence_flows_data.append({
            "bpmn_id": sf.bpmn_id,
            "source_ref": sf.source_ref,
            "target_ref": sf.target_ref,
            "name": sf.name,
            "condition_expression": sf.condition_expression,
            "branch_probability": float(sf.branch_probability) if sf.branch_probability is not None else None
        })

    all_tasks = [t for a in activities_data for t in a["tasks"]]
    snapshot = {
        "process_id": str(process.id),
        "name": process.name,
        "code": process.code,
        "objective": process.objective,
        "trigger_event": process.trigger_event,
        "output_result": process.output_result,
        "monthly_volume": float(process.monthly_volume) if process.monthly_volume is not None else None,
        "activities": activities_data,
        "flow_nodes": flow_nodes_data,
        "sequence_flows": sequence_flows_data,
        # Errores estructurales del diagrama, para que la IA pueda señalar
        # exactamente qué nodo está mal conectado y cómo arreglarlo.
        "flow_issues": detect_flow_issues(all_tasks, flow_nodes_data, sequence_flows_data),
    }
    return snapshot

def ask_task_assistant(text: str, context: dict) -> dict:
    import httpx
    http_opts = None
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        # urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)  # Removido: suprimía warnings globalmente
        http_opts = types.HttpOptions(httpx_client=httpx.Client(verify=False))

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)
    if not client:
        return {"reply": "Error: IA no configurada.", "suggestions": {}}
        
    system_prompt = """
    Eres un asistente experto en modelamiento de procesos (Metodología Lean y BPM).
    El usuario te explicará una tarea con sus propias palabras.

    Tu trabajo es ayudarle a estructurarla.

    Responde amigablemente y sugiere:
    1. Un nombre descriptivo para la tarea (corto, empezando con verbo en infinitivo).
    2. Su 'type': usa exactamente uno de estos valores:
       - "user"    → La realiza una persona de forma interactiva (Ej: revisar, aprobar, llamar).
       - "manual"  → La realiza una persona de forma física sin sistema (Ej: archivar, trasladar).
       - "service" → La ejecuta un sistema automáticamente sin intervención humana (Ej: enviar email automático, calcular).
    3. Su 'valueClass': usa exactamente uno de estos valores:
       - "VA"   → El cliente lo valora y pagaría por ello (agrega valor directo).
       - "NNVA" → Necesario por regulación, control interno o ley, pero el cliente no lo pide.
       - "NVA"  → Desperdicio puro: puede eliminarse sin afectar el resultado para el cliente.

    Devuelve un JSON con este esquema exacto:
    {
      "reply": "Tu mensaje amigable (2-3 oraciones) explicando por qué sugieres esto.",
      "suggestions": {
        "name": "Nombre de tarea",
        "type": "user",
        "valueClass": "VA"
      }
    }
    """
    
    user_prompt = f"Datos actuales de la tarea: {context}\n\nDescripción del usuario: {text}"
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[user_prompt],
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.4,
                max_output_tokens=32768,
                thinking_config=types.ThinkingConfig(thinking_budget=2048),
            )
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        print(f"Error en ask_task_assistant: {e}")
        return {"reply": "Ocurrió un error al procesar tu consulta con la IA.", "suggestions": {}}

def run_optimization(db: Session, process_id: int) -> models.OptimizationRun:
    # 1. Build Process Snapshot & Deterministic Metrics
    try:
        snapshot = build_process_snapshot(db, process_id)
        deterministic_metrics = calculate_process_metrics(db, process_id).model_dump()
        snapshot["metrics"] = deterministic_metrics
    except ValueError as e:
        raise ValueError(str(e))

    # 2. Create pending record in optimization_runs
    db_run = models.OptimizationRun(
        process_id=process_id,
        status=models.OptStatus.pending,
        model_used="gemini-2.5-flash",
        input_snapshot=snapshot
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    # 3. Initialize Gemini SDK client
    import httpx
    
    http_opts = None
    # Only allow bypassing SSL in non-production environments
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        # urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)  # Removido: suprimía warnings globalmente

        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)

    raw_response_text = ""
    validated_result = None

    try:
        # First call to Gemini
        contents_json = json.dumps(snapshot, indent=2, default=str)



        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Aquí tienes el snapshot del proceso para optimizar:\n\n{contents_json}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=schemas.OptimizationResult,
                temperature=0.2,
                max_output_tokens=32768,
                thinking_config=types.ThinkingConfig(thinking_budget=2048),
            )
        )
        raw_response_text = response.text






        cleaned_text = clean_json_response(raw_response_text)
        parsed_json = json.loads(cleaned_text)
        
        # Pydantic v2 validation
        validated_result = schemas.OptimizationResult.model_validate(parsed_json)

        
    except (json.JSONDecodeError, ValidationError, Exception) as first_err:
        print(f"First attempt failed: {first_err}. Waiting 2 seconds for rate limits before retrying...")
        # TODO: migrar a asyncio.sleep cuando el endpoint sea async
        time.sleep(2)

        # Attempt retry exactly once
        try:
            retry_prompt = (
                f"El JSON anterior falló la validación.\n"
                f"Error de validación:\n{str(first_err)}\n\n"
                f"Por favor, corrige el JSON y devuélvelo estrictamente de acuerdo con el esquema especificado en el system prompt.\n"
                f"Datos del proceso original:\n{json.dumps(snapshot, indent=2)}"
            )

            response_retry = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=retry_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=schemas.OptimizationResult,
                    temperature=0.2,
                    max_output_tokens=32768,
                    thinking_config=types.ThinkingConfig(thinking_budget=2048),
                )
            )
            raw_response_text_retry = response_retry.text






            cleaned_text_retry = clean_json_response(raw_response_text_retry)
            parsed_json_retry = json.loads(cleaned_text_retry)
            
            validated_result = schemas.OptimizationResult.model_validate(parsed_json_retry)

        except Exception as retry_err:
            print(f"[Optimization] Retry also failed for process {process_id}: {retry_err}")
            # Second validation failure - mark status as failed
            db_run.status = models.OptStatus.failed
            db_run.result = {"error": f"First attempt failed: {str(first_err)}. Retry attempt failed: {str(retry_err)}"}
            db_run.completed_at = func.now()
            db.commit()
            db.refresh(db_run)
            return db_run

    # If succeeded validation
    if validated_result:
        result_dict = validated_result.model_dump()
        
        # Override hallucinated math with deterministic python math
        result_dict['summary'] = {
            "total_cycle_time_sec": deterministic_metrics['total_cycle_time_sec'],
            "total_wait_time_sec": deterministic_metrics['total_wait_time_sec'],
            "value_added_ratio": deterministic_metrics['pce_percentage'] / 100.0,
            "nva_task_count": deterministic_metrics['structural']['nva_count'],
            "handoff_count": deterministic_metrics['structural']['handoffs_count']
        }
        
        result_dict['bottlenecks'] = [
            {
                "node_bpmn_id": b['bpmn_id'],
                "node_name": b['name'],
                "metric": b['metric_type'],
                "value_sec": b['value_sec'],
                "deviation_factor": b['deviation_factor'],
                "severity": "high" if b['deviation_factor'] > 2.0 else "medium",
                "impact_description": "Identificado determinísticamente por exceder 1.5x la media"
            } for b in deterministic_metrics.get('bottlenecks', [])
        ]
        
        db_run.status = models.OptStatus.completed
        db_run.result = result_dict
        
        # Extract value_added_ratio from summary if available
        va_ratio = result_dict.get('summary', {}).get('value_added_ratio', 0.0)
        # Cap to [0.0, 1.0] to prevent DB overflow on Numeric(5,4)
        va_ratio = max(0.0, min(1.0, float(va_ratio)))
        db_run.value_added_ratio = Decimal(str(va_ratio))
        db_run.completed_at = func.now()
        db.commit()
        db.refresh(db_run)

    return db_run

MACRO_SYSTEM_PROMPT = """Eres un motor experto en optimización de procesos bajo metodologías Lean, Six Sigma y BPMN 2.0. Recibirás un objeto JSON que representa el levantamiento de un MACROPROCESO completo, incluyendo todos sus sub-procesos y métricas agregadas.

Tu ÚNICA función es analizar cualitativamente estos datos y devolver EXCLUSIVAMENTE un objeto JSON válido conforme al esquema de salida. NO DEBES calcular métricas, asume que las métricas entregadas en "metrics" son perfectas. Tu trabajo es interpretar la causa raíz y generar recomendaciones estructuradas a nivel macro.
IMPORTANTE: Todo el texto generado en descripciones, recomendaciones y justificaciones DEBE estar estrictamente en Español.

REGLAS DE ANÁLISIS MACRO
1. Cuellos de botella macro (TOC): Identifica qué proceso limita el flujo completo basándote en el cycle time de los procesos individuales y reporta en "macro_bottlenecks".
2. Desperdicio de interfaz / handoffs: USA "connections" (las transiciones REALES proceso→proceso, no las infieras). Para cada conexión, compara "from_output_result" con "to_trigger_event": si no coinciden o hay un salto lógico, es un desperdicio de interfaz (esperas, retrabajo, datos que se rehacen). Regístralos en "interface_wastes". Si un proceso no aparece en ninguna conexión, señálalo como proceso aislado/sin integrar.
3. Redundancia entre procesos: Identifica pasos o validaciones repetidas en procesos distintos que podrían consolidarse.
4. Secuenciación / paralelización: Identifica procesos que actualmente son secuenciales pero que podrían ejecutarse en paralelo.
5. Recomendaciones y Proyección: Propón acciones y un "projected_macro_lead_time_sec".
6. JSON Estricto: La respuesta DEBE ser únicamente el siguiente objeto JSON:

{
  "macroprocess_id": "string",
  "analysis_confidence": 0.0,
  "summary": {
    "total_macro_lead_time_sec": 0,
    "macro_pce": 0.0,
    "total_handoffs": 0
  },
  "macro_bottlenecks": [
    {"process_code":"string","process_name":"string",
     "metric":"lead_time|cycle_time", "value_sec":0,
     "severity":"low|medium|high|critical",
     "impact_description":"string"}
  ],
  "interface_wastes": [
    {"from_process_code":"string", "to_process_code":"string",
     "waste_type":"waiting|rework|information_loss|motion",
     "description":"string", "estimated_delay_sec":0}
  ],
  "redundancies": [
    {"processes_involved":["string"], "description":"string", "consolidation_opportunity":"string"}
  ],
  "recommendations": [
    {"id":"string","target_process_codes":["string"],
     "action_type":"ELIMINATE|AUTOMATE|SIMPLIFY|MERGE|PARALLELIZE|REASSIGN|STANDARDIZE",
     "description":"string","expected_benefit":"string",
     "implementation_complexity":"low|medium|high",
     "priority":0}
  ],
  "projected_macro_lead_time_sec": 0
}"""

def build_macroprocess_snapshot(db: Session, macroprocess_id: int) -> Dict[str, Any]:
    macro = db.query(models.Macroprocess).filter(models.Macroprocess.id == macroprocess_id).first()
    if not macro:
        raise ValueError(f"Macroprocess with id {macroprocess_id} not found")
        
    processes_data = []
    total_lead_time = 0.0
    total_va_time = 0.0
    total_handoffs = 0
    
    for process in macro.processes:
        try:
            p_snapshot = build_process_snapshot(db, process.id)
            p_metrics = calculate_process_metrics(db, process.id).model_dump()
            
            p_lead = p_metrics.get("lead_time_sec", 0)
            p_pce = p_metrics.get("pce_percentage", 0)
            p_va = (p_lead * p_pce) / 100.0 if p_lead > 0 else 0
            
            total_lead_time += p_lead
            total_va_time += p_va
            total_handoffs += p_metrics.get("structural", {}).get("handoffs_count", 0)
            
            processes_data.append({
                "process_id": process.id,
                "code": process.code,
                "name": process.name,
                "snapshot": p_snapshot,
                "metrics": p_metrics
            })
        except Exception:
            continue
        
    macro_pce = (total_va_time / total_lead_time * 100.0) if total_lead_time > 0 else 0.0

    # Conexiones estructurales reales entre procesos (no inferidas). Incluye el
    # semántico output→trigger para que el optimizador detecte desajustes de interfaz.
    proc_by_id = {str(p.id): p for p in macro.processes}
    connections = []
    for f in macro.macro_sequence_flows:
        src = proc_by_id.get(str(f.source_ref))
        tgt = proc_by_id.get(str(f.target_ref))
        connections.append({
            "from_process_code": src.code if src else f.source_ref,
            "from_output_result": src.output_result if src else None,
            "to_process_code": tgt.code if tgt else f.target_ref,
            "to_trigger_event": tgt.trigger_event if tgt else None,
            "condition": f.condition,
        })

    return {
        "macroprocess_id": str(macro.id),
        "code": macro.code,
        "name": macro.name,
        "processes": processes_data,
        "connections": connections,
        "metrics": {
            "total_macro_lead_time_sec": total_lead_time,
            "macro_pce": macro_pce,
            "total_handoffs": total_handoffs,
            "process_count": len(processes_data)
        }
    }

def run_macro_optimization(db: Session, macroprocess_id: int) -> models.MacroOptimizationRun:
    try:
        snapshot = build_macroprocess_snapshot(db, macroprocess_id)
    except ValueError as e:
        raise ValueError(str(e))

    if len(snapshot.get("processes", [])) < 2:
        db_run = models.MacroOptimizationRun(
            macroprocess_id=macroprocess_id,
            status=models.OptStatus.failed,
            model_used="gemini-2.5-flash",
            input_snapshot=snapshot,
            result={"error": "Se necesitan al menos 2 procesos con datos completos para optimizar el macroproceso."}
        )
        db.add(db_run)
        db.commit()
        db.refresh(db_run)
        return db_run

    db_run = models.MacroOptimizationRun(
        macroprocess_id=macroprocess_id,
        status=models.OptStatus.pending,
        model_used="gemini-2.5-flash",
        input_snapshot=snapshot
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    import httpx
    
    http_opts = None
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        # urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)  # Removido: suprimía warnings globalmente
        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)

    raw_response_text = ""
    validated_result = None

    try:
        contents_json = json.dumps(snapshot, default=str, indent=2)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"DATOS DEL MACROPROCESO:\n\n{contents_json}",
            config=types.GenerateContentConfig(
                system_instruction=MACRO_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=schemas.MacroOptimizationResult,
                temperature=0.2,
                max_output_tokens=32768,
                thinking_config=types.ThinkingConfig(thinking_budget=2048),
            )
        )
        
        raw_response_text = response.text if response.text else ""
        cleaned_json_str = clean_json_response(raw_response_text)
        parsed_json = json.loads(cleaned_json_str)
        validated_result = schemas.MacroOptimizationResult.model_validate(parsed_json).model_dump()

    except (json.JSONDecodeError, ValidationError, Exception) as first_err:
        print(f"First attempt failed in Macro Optimization: {first_err}. Waiting 2 seconds for rate limits before retrying...")
        # TODO: migrar a asyncio.sleep cuando el endpoint sea async
        time.sleep(2)
        
        try:
            retry_prompt = f"El JSON anterior falló en validación Pydantic o parseo por: {str(first_err)}. Corrige y devuelve un JSON válido de MacroOptimizationResult según el esquema original.\n\nJSON CON ERRORES:\n{raw_response_text}"
            
            retry_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=retry_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=MACRO_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=schemas.MacroOptimizationResult,
                    temperature=0.2,
                    max_output_tokens=32768,
                    thinking_config=types.ThinkingConfig(thinking_budget=2048),
                )
            )
            raw_response_text = retry_response.text if retry_response.text else ""
            cleaned_retry = clean_json_response(raw_response_text)
            parsed_json = json.loads(cleaned_retry)
            validated_result = schemas.MacroOptimizationResult.model_validate(parsed_json).model_dump()
        except Exception as retry_err:
            print(f"Second attempt failed in Macro Optimization: {retry_err}")
            db_run.status = models.OptStatus.failed
            db_run.result = {"error": str(retry_err), "raw_response": raw_response_text}
            db.commit()
            db.refresh(db_run)
            return db_run

    if validated_result:
        db_run.status = models.OptStatus.completed
        db_run.result = validated_result

        db_run.completed_at = func.now()
        db.commit()
        db.refresh(db_run)

    return db_run

def tutorial_chat(message: str, history: list | None = None, process_context: dict | None = None) -> str:
    """Asistente de consultas.

    Antes: sin memoria (cada pregunta partía de cero), sin contexto del proceso
    abierto, límite de "1-3 oraciones" y sin control de thinking — el modelo
    gastaba su presupuesto de salida pensando y devolvía texto vacío, que el
    usuario veía como "se sobrecarga y no completa la respuesta".
    """
    import httpx
    http_opts = None
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        # urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)  # Removido: suprimía warnings globalmente
        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)

    system_prompt = (
        "Eres el asistente experto de AiProces, una herramienta de mapeo y optimización de procesos "
        "(Lean / BPMN). Ayudas a personas que muchas veces NO tienen formación en procesos.\n\n"
        "CÓMO RESPONDER\n"
        "- Claro y conversacional, en español. Explica los términos técnicos con palabras simples "
        "y un ejemplo cotidiano cuando ayude.\n"
        "- Extensión según la pregunta: 1-2 oraciones para dudas simples; hasta ~2 párrafos o una "
        "lista corta de pasos si te piden un procedimiento o un diagnóstico. Nunca cortes una "
        "explicación a la mitad.\n"
        "- Si te preguntan CÓMO hacer algo en la app, responde con los pasos concretos de la interfaz "
        "(botones del panel izquierdo '+ Tarea' y '+ Compuerta', arrastrar entre los puntos de los "
        "nodos para conectar, el botón rojo de papelera sobre una flecha para borrarla, la pestaña "
        "'Optimización IA', el botón 'Versiones' para restaurar, 'Reporte' para el PDF).\n"
        "- Mantienes el hilo de la conversación: puedes referirte a lo que ya se habló.\n\n"
        "AYUDA A CORREGIR EL FLUJO\n"
        "- Si recibes 'CONTEXTO DEL PROCESO ABIERTO', úsalo para dar respuestas concretas sobre ESE "
        "proceso: nombra sus tareas y compuertas reales.\n"
        "- Si el contexto trae 'errores_de_flujo', explícalos en lenguaje simple y di exactamente qué "
        "hacer en el diagrama para corregir cada uno (qué nodo y qué conexión falta).\n"
        "- Si preguntan por qué sus métricas se ven raras y hay errores de flujo, explica que un flujo "
        "incompleto distorsiona los tiempos.\n\n"
        "LÍMITES\n"
        "- Si la pregunta no tiene relación con procesos, mejora continua o AiProces, dilo amablemente "
        "y reconduce. Nunca inventes funciones que no existen en la herramienta."
    )

    contents = []
    # Historial (memoria de la conversación) — sin esto no podía ser interactivo.
    for turn in (history or [])[-10:]:
        role = "model" if turn.get("role") in ("assistant", "model") else "user"
        text = (turn.get("text") or "").strip()
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text[:4000])]))

    user_text = message
    if process_context:
        try:
            ctx = json.dumps(process_context, ensure_ascii=False, default=str)[:6000]
            user_text = f"CONTEXTO DEL PROCESO ABIERTO (JSON):\n{ctx}\n\nPREGUNTA DEL USUARIO:\n{message}"
        except Exception:
            pass
    contents.append(types.Content(role="user", parts=[types.Part(text=user_text)]))

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3,
                # Techo alto + thinking acotado: el modelo ya no se queda sin
                # presupuesto a mitad de la respuesta.
                max_output_tokens=2048,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            )
        )
        text = (response.text or "").strip() if hasattr(response, "text") else ""
        if not text:
            # Rescate: recuperar el texto de las partes si .text viene vacío.
            try:
                parts = response.candidates[0].content.parts or []
                text = "".join(getattr(p, "text", "") or "" for p in parts).strip()
            except Exception:
                text = ""
        return text or ("No logré completar la respuesta. ¿Puedes reformular la pregunta "
                        "o hacerla en partes más pequeñas?")
    except Exception as e:
        return "Hubo un problema temporal con nuestra IA. ¡Intenta de nuevo en unos minutos!"
