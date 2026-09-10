/**
 * Respaldo del flujo en un archivo propio.
 *
 * Observacion del 10/09: hacia falta un guardado adicional, fuera de la
 * aplicacion, por si se borra o se pierde el flujo entero. Las versiones que ya
 * existian viven en la misma base de datos: si esa base se pierde, se pierden
 * con ella. Un archivo que la persona guarda donde quiera es lo unico que
 * sobrevive a eso.
 *
 * El contenido es el MISMO formato que una version guardada, a proposito: asi
 * restaurar un respaldo reutiliza el camino ya probado de restaurar una version
 * en vez de abrir un segundo camino que se desincronizaria con el primero.
 */

/** Formato del archivo. Se sube si algun dia el contenido deja de ser compatible. */
export const VERSION_RESPALDO = 1;

export function construirRespaldo({ proc, tasks = [], gateways = [], sequenceFlows = [], layout = null }) {
  return {
    aiproces_respaldo: VERSION_RESPALDO,
    generado: new Date().toISOString(),
    proceso: {
      code: proc?.code || null,
      name: proc?.name || null,
      objective: proc?.objective || null,
      suppliers: proc?.suppliers || null,
      trigger_event: proc?.trigger_event || null,
      output_result: proc?.output_result || null,
      customers: proc?.customers || null,
      monthly_volume: proc?.monthly_volume ?? null,
    },
    // Esta parte es literalmente un snapshot: la consume restoreSnapshot.
    snapshot: {
      label: `Respaldo ${new Date().toLocaleString()}`,
      tasks,
      gateways,
      sequence_flows: sequenceFlows,
      layout,
    },
  };
}

function nombreArchivo(proc) {
  const base = (proc?.code || proc?.name || "proceso")
    .toString().trim().replace(/[^\w\-]+/g, "_").slice(0, 60) || "proceso";
  const dia = new Date().toISOString().slice(0, 10);
  return `respaldo_${base}_${dia}.json`;
}

/** Descarga el respaldo como archivo. */
export function descargarRespaldo(datos) {
  const respaldo = construirRespaldo(datos);
  if (!respaldo.snapshot.tasks.length) {
    return { ok: false, motivo: "Este flujo todavía no tiene pasos que respaldar." };
  }
  const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo(datos.proc);
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, nombre: a.download };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Lee un archivo de respaldo y devuelve el snapshot que contiene.
 *
 * Se valida antes de devolverlo: restaurar reemplaza TODO el flujo actual, asi
 * que un archivo equivocado o corrupto tiene que detenerse aqui y no a mitad
 * de la restauracion, cuando ya se han borrado las tareas.
 */
export async function leerRespaldo(archivo) {
  if (!archivo) return { ok: false, motivo: "No se eligió ningún archivo." };
  let crudo;
  try {
    crudo = JSON.parse(await archivo.text());
  } catch {
    return { ok: false, motivo: "El archivo no es un respaldo válido (no se pudo leer su contenido)." };
  }
  return validarRespaldo(crudo);
}

export function validarRespaldo(crudo) {
  if (!crudo || typeof crudo !== "object") {
    return { ok: false, motivo: "El archivo no es un respaldo de AiProces." };
  }
  if (!crudo.aiproces_respaldo) {
    return { ok: false, motivo: "El archivo no es un respaldo de AiProces." };
  }
  if (Number(crudo.aiproces_respaldo) > VERSION_RESPALDO) {
    return { ok: false, motivo: "El respaldo se creó con una versión más nueva de AiProces." };
  }
  const snap = crudo.snapshot;
  if (!snap || !Array.isArray(snap.tasks)) {
    return { ok: false, motivo: "El respaldo está incompleto: no contiene los pasos del flujo." };
  }
  if (!snap.tasks.length) {
    return { ok: false, motivo: "El respaldo no contiene ningún paso." };
  }
  return {
    ok: true,
    snapshot: {
      label: snap.label || "Respaldo restaurado",
      tasks: snap.tasks,
      gateways: Array.isArray(snap.gateways) ? snap.gateways : [],
      sequence_flows: Array.isArray(snap.sequence_flows) ? snap.sequence_flows : [],
      layout: snap.layout || null,
    },
    proceso: crudo.proceso || {},
    generado: crudo.generado || null,
  };
}
