/**
 * Posiciones manuales de los nodos, a prueba de restauraciones.
 *
 * El problema: `layout_json` guarda la posición de cada nodo con la clave que
 * usa el lienzo — `task-42`, `gw-Gateway_ab`, `start`, `end` —. Al restaurar una
 * versión las tareas se borran y se vuelven a crear, así que reciben ids nuevos:
 * `task-42` deja de existir y el diagrama se recoloca solo. De ahí que al
 * restaurar «se desordene por completo».
 *
 * La solución es guardar el layout dentro de la versión con una clave que SÍ
 * sobrevive: el `bpmn_id`, que se conserva al recrear la tarea. Al restaurar se
 * vuelve a traducir a los ids nuevos.
 */

const PREFIJO = "task:";

/**
 * Layout del lienzo -> layout portable (claves por bpmn_id).
 * Los nodos que no son tareas (compuertas, inicio y fin) ya tienen una clave
 * estable, así que se copian tal cual.
 */
export function layoutPortable(layout, tasks) {
  if (!layout || typeof layout !== "object") return null;
  const bpmnPorId = new Map();
  for (const t of tasks || []) {
    if (t.id != null && t.bpmnId) bpmnPorId.set(`task-${t.id}`, t.bpmnId);
  }

  const salida = {};
  for (const [clave, pos] of Object.entries(layout)) {
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") continue;
    const bpmn = bpmnPorId.get(clave);
    // Una tarea cuyo id ya no está en la lista se descarta: su posición no se
    // podría volver a aplicar y solo ensuciaría la versión guardada.
    if (clave.startsWith("task-")) {
      if (bpmn) salida[PREFIJO + bpmn] = { x: pos.x, y: pos.y };
    } else {
      salida[clave] = { x: pos.x, y: pos.y };
    }
  }
  return Object.keys(salida).length ? salida : null;
}

/**
 * Layout portable -> layout del lienzo, con los ids que las tareas tienen ahora.
 */
export function layoutParaLienzo(portable, tasks) {
  if (!portable || typeof portable !== "object") return null;
  const idPorBpmn = new Map();
  for (const t of tasks || []) {
    if (t.id != null && t.bpmnId) idPorBpmn.set(t.bpmnId, `task-${t.id}`);
  }

  const salida = {};
  for (const [clave, pos] of Object.entries(portable)) {
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") continue;
    if (clave.startsWith(PREFIJO)) {
      const nodo = idPorBpmn.get(clave.slice(PREFIJO.length));
      if (nodo) salida[nodo] = { x: pos.x, y: pos.y };
    } else {
      salida[clave] = { x: pos.x, y: pos.y };
    }
  }
  return Object.keys(salida).length ? salida : null;
}
