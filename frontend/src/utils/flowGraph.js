/**
 * Reglas del grafo del proceso, en un solo sitio.
 *
 * Estaban repartidas entre `AiProces.jsx` (detección de problemas) y
 * `FlowDiagrams.jsx` (validación al conectar), cada una con su propia idea de
 * qué es una referencia válida. Esa discrepancia es la que hacía que el canvas
 * dibujara una flecha que después ningún chequeo reconocía. Al vivir aquí, son
 * la misma regla para todos y se pueden probar sin montar React.
 */

/** Nodos que existen siempre y no son ni tarea ni compuerta. */
export const START = "start";
export const END = "end";

/**
 * Índice id numérico -> bpmn_id. El canvas identifica los nodos como
 * `task-<id>`, pero el resto del sistema (barra lateral, avisos, IA y BPMN)
 * usa `bpmn_id`.
 */
function numericIndex(tasks) {
  const index = new Map();
  for (const t of tasks || []) {
    if (t.id != null && t.bpmnId) index.set(String(t.id), t.bpmnId);
  }
  return index;
}

/**
 * Traduce una referencia guardada a su forma canónica (`bpmn_id`).
 * Deja intactas las que ya lo son, y `start` / `end`.
 */
export function canonicalRef(ref, tasks) {
  return numericIndex(tasks).get(String(ref)) ?? ref;
}

/**
 * Normaliza una lista de conexiones. Devuelve el mismo array si no había nada
 * que corregir, para que quien llame pueda detectar el cambio por identidad y
 * no reguardar el grafo sin motivo.
 */
export function canonicalizeFlows(flows, tasks) {
  if (!flows || !flows.length) return flows || [];
  const index = numericIndex(tasks);
  if (!index.size) return flows;

  let changed = false;
  const result = flows.map((f) => {
    const source_ref = index.get(String(f.source_ref)) ?? f.source_ref;
    const target_ref = index.get(String(f.target_ref)) ?? f.target_ref;
    if (source_ref === f.source_ref && target_ref === f.target_ref) return f;
    changed = true;
    return { ...f, source_ref, target_ref };
  });
  return changed ? result : flows;
}

/**
 * Motivo por el que una conexión no es válida, o `null` si lo es.
 * Se evalúa mientras se arrastra, para marcar el destino en vez de dejar crear
 * una línea que el servidor va a descartar después.
 */
export function connectionError(sourceRef, targetRef, flows) {
  if (!sourceRef || !targetRef) return "Falta el origen o el destino de la conexión.";
  if (sourceRef === targetRef) return "Un paso no puede conectarse consigo mismo.";
  if (targetRef === START) return "El Inicio no puede recibir flechas.";
  if (sourceRef === END) return "El Fin no puede tener salidas.";
  const duplicada = (flows || []).some(
    (f) => f.source_ref === sourceRef && f.target_ref === targetRef
  );
  if (duplicada) return "Esa conexión ya existe.";
  return null;
}

/**
 * Problemas estructurales del diagrama. Mismos criterios que aplica el backend
 * antes de pasarle el proceso a la IA, para que el aviso de la pantalla y el de
 * la optimización nunca se contradigan.
 *
 * `nodeId` es el identificador del nodo en el canvas, para poder resaltarlo.
 */
export function detectFlowIssues(tasks, gateways, sequenceFlows) {
  const issues = [];
  const flows = canonicalizeFlows(sequenceFlows || [], tasks);
  if (!tasks || tasks.length === 0) return issues;

  const hasOut = (ref) => flows.some((f) => f.source_ref === ref);
  const hasIn = (ref) => flows.some((f) => f.target_ref === ref);

  for (const t of tasks) {
    const ref = t.bpmnId;
    const out = hasOut(ref);
    const inc = hasIn(ref);
    const nodeId = `task-${t.id}`;
    if (!out && !inc) issues.push({ type: "isolated", name: t.name, sev: "high", nodeId });
    else if (!out) issues.push({ type: "deadend", name: t.name, sev: "high", nodeId });
    else if (!inc) issues.push({ type: "unreachable", name: t.name, sev: "medium", nodeId });
  }

  for (const g of gateways || []) {
    const ramas = flows.filter((f) => f.source_ref === g.bpmn_id).length;
    if (ramas < 2) {
      issues.push({
        type: "gateway",
        name: g.name || "Compuerta",
        sev: "medium",
        nodeId: `gw-${g.bpmn_id}`,
      });
    }
  }

  return issues;
}
