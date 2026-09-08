/**
 * Dibuja el flujo del proceso como SVG, a partir de los mismos datos que el
 * lienzo. Sirve para tres cosas: descargarlo en JPG, imprimirlo en PDF y
 * empotrarlo en el informe.
 *
 * Se genera desde los datos y no capturando la pantalla: así el resultado no
 * depende del zoom ni de la parte del diagrama que se vea, sale nítido a
 * cualquier tamaño y funciona aunque el lienzo no esté montado.
 */
import { buildFlowData } from "../components/diagram/FlowDiagrams.jsx";
import { VALUE, TYPES } from "../constants.js";

const ANCHO_TAREA = 200;
const ALTO_TAREA = 90;
const LADO_NODO = 60;
const MARGEN = 40;

const esc = (t) =>
  String(t ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const fmt = (sec) => {
  const s = Number(sec) || 0;
  const r = (n) => String(Math.round(n * 10) / 10);
  if (s === 0) return "0";
  if (s < 60) return `${r(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${r(s / 3600)}h`;
};

/** Corta un texto largo para que quepa en la tarjeta. */
const recorta = (texto, max) => {
  const t = String(texto || "");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

function medidas(nodo) {
  return nodo.type === "taskNode"
    ? { w: ANCHO_TAREA, h: ALTO_TAREA }
    : { w: LADO_NODO, h: LADO_NODO };
}

function dibujaTarea(n) {
  const { x, y } = n.position;
  const v = VALUE[n.data.valueClass] || VALUE.VA;
  const tipo = TYPES[n.data.taskType]?.label || n.data.taskType || "";
  const tiempos = `ciclo ${fmt(n.data.cycleTime)}${n.data.waitTime > 0 ? ` · espera ${fmt(n.data.waitTime)}` : ""}`;
  const orden = n.data.order != null ? String(n.data.order).padStart(2, "0") : "";
  return `
    <g>
      <rect x="${x}" y="${y}" width="${ANCHO_TAREA}" height="${ALTO_TAREA}" rx="10"
            fill="#ffffff" stroke="#E2E7E3" stroke-width="1.5"/>
      <rect x="${x}" y="${y}" width="5" height="${ALTO_TAREA}" rx="2.5" fill="${v.color}"/>
      ${orden ? `<text x="${x + 16}" y="${y + 25}" font-size="11" font-weight="700" fill="#5C6B6B" font-family="monospace">${orden}</text>` : ""}
      <text x="${x + (orden ? 40 : 16)}" y="${y + 25}" font-size="13" font-weight="600" fill="#15232E">${esc(recorta(n.data.label, 22))}</text>
      <text x="${x + 16}" y="${y + 46}" font-size="10.5" fill="#5C6B6B">${esc(tipo)}</text>
      <rect x="${x + 16 + tipo.length * 5.6 + 8}" y="${y + 36}" width="${v.short.length * 7 + 12}" height="14" rx="4" fill="${v.color}"/>
      <text x="${x + 16 + tipo.length * 5.6 + 14}" y="${y + 46.5}" font-size="9" font-weight="700" fill="#ffffff">${v.short}</text>
      <text x="${x + 16}" y="${y + 66}" font-size="10.5" fill="#5C6B6B" font-family="monospace">${esc(tiempos)}</text>
      ${n.data.isConstraint ? `<text x="${x + 16}" y="${y + 82}" font-size="9" font-weight="700" fill="#A4271A">MARCA EL RITMO</text>` : ""}
    </g>`;
}

function dibujaCompuerta(n) {
  const { x, y } = n.position;
  const cx = x + LADO_NODO / 2;
  const cy = y + LADO_NODO / 2;
  const exclusiva = String(n.data.gatewayType || "").startsWith("exclusive");
  const forma = exclusiva
    ? `<polygon points="${cx},${y + 3} ${x + LADO_NODO - 3},${cy} ${cx},${y + LADO_NODO - 3} ${x + 3},${cy}"
               fill="#ffffff" stroke="#9AA8A8" stroke-width="2.5"/>
       <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="22" font-weight="700" fill="#0E9F9F">X</text>`
    : `<rect x="${x + 6}" y="${y + 11}" width="${LADO_NODO - 12}" height="${LADO_NODO - 22}" rx="6"
             fill="#ffffff" stroke="#9AA8A8" stroke-width="2.5"/>
       <g stroke="#0E9F9F" stroke-width="3.5" stroke-linecap="round" fill="none">
         <path d="M${x + 16} ${cy - 7} H${x + 40}"/><path d="M${x + 35} ${cy - 12} l6 5 l-6 5"/>
         <path d="M${x + 16} ${cy + 7} H${x + 40}"/><path d="M${x + 35} ${cy + 2} l6 5 l-6 5"/>
       </g>`;
  return `
    <g>
      ${forma}
      <text x="${cx}" y="${y + LADO_NODO + 13}" text-anchor="middle" font-size="10" fill="#5C6B6B">${esc(recorta(n.data.label, 26))}</text>
    </g>`;
}

function dibujaEvento(n, esInicio) {
  const { x, y } = n.position;
  const cx = x + LADO_NODO / 2;
  const cy = y + LADO_NODO / 2;
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="16" fill="#ffffff" stroke="${esInicio ? "#0E9F9F" : "#15232E"}" stroke-width="${esInicio ? 2.5 : 4}"/>
      ${esInicio ? "" : `<circle cx="${cx}" cy="${cy}" r="7" fill="#15232E"/>`}
      <text x="${cx}" y="${y + LADO_NODO + 13}" text-anchor="middle" font-size="10" fill="#5C6B6B">${esc(recorta(n.data.label, 24))}</text>
    </g>`;
}

/** Punto de salida y de entrada de cada nodo, para trazar la conexión. */
function anclas(nodo) {
  const { w, h } = medidas(nodo);
  const { x, y } = nodo.position;
  return { sale: { x: x + w, y: y + h / 2 }, entra: { x, y: y + h / 2 } };
}

function dibujaConexion(origen, destino, etiqueta) {
  const a = anclas(origen).sale;
  const b = anclas(destino).entra;
  const medio = (a.x + b.x) / 2;
  // Trazado en escalera, igual que en el lienzo.
  const d = `M ${a.x} ${a.y} H ${medio} V ${b.y} H ${b.x}`;
  const etiquetaSvg = etiqueta
    ? `<g>
         <rect x="${medio - etiqueta.length * 3.4 - 6}" y="${(a.y + b.y) / 2 - 9}"
               width="${etiqueta.length * 6.8 + 12}" height="17" rx="8" fill="#E6F6F6" stroke="#BFE6E6"/>
         <text x="${medio}" y="${(a.y + b.y) / 2 + 3.5}" text-anchor="middle" font-size="10"
               font-weight="600" fill="#0B5E5E">${esc(etiqueta)}</text>
       </g>`
    : "";
  return `<path d="${d}" fill="none" stroke="#9AA8A8" stroke-width="1.8"
                stroke-dasharray="5 4" marker-end="url(#punta)"/>${etiquetaSvg}`;
}

/**
 * Devuelve el SVG del flujo, o null si no hay nada que dibujar.
 * @returns {{svg: string, ancho: number, alto: number}|null}
 */
export function diagramaSvg({ proc, tasks, gateways, sequenceFlows, layout, constraintBpmnId } = {}) {
  if (!proc || !tasks || tasks.length === 0) return null;

  const { nodes, edges } = buildFlowData(
    proc, tasks, gateways || [], sequenceFlows || [],
    () => {}, () => {}, layout || null, false, constraintBpmnId || null, null
  );
  const utiles = nodes.filter((n) => n.type !== "laneNode");
  if (!utiles.length) return null;

  const porId = new Map(utiles.map((n) => [n.id, n]));
  let maxX = 0;
  let maxY = 0;
  let minX = Infinity;
  let minY = Infinity;
  for (const n of utiles) {
    const { w, h } = medidas(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h + 18); // 18 = etiqueta bajo el nodo
  }

  const ancho = Math.ceil(maxX - minX + MARGEN * 2);
  const alto = Math.ceil(maxY - minY + MARGEN * 2);
  const dx = MARGEN - minX;
  const dy = MARGEN - minY;

  const conexiones = edges
    .map((e) => {
      const o = porId.get(e.source);
      const d = porId.get(e.target);
      return o && d ? dibujaConexion(o, d, e.label) : "";
    })
    .join("");

  const cajas = utiles
    .map((n) => {
      if (n.type === "taskNode") return dibujaTarea(n);
      if (n.type === "gatewayNode") return dibujaCompuerta(n);
      if (n.type === "startNode") return dibujaEvento(n, true);
      if (n.type === "endNode") return dibujaEvento(n, false);
      return "";
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" font-family="'IBM Plex Sans',system-ui,sans-serif">
  <defs>
    <marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#9AA8A8"/>
    </marker>
  </defs>
  <rect width="${ancho}" height="${alto}" fill="#ffffff"/>
  <g transform="translate(${dx}, ${dy})">${conexiones}${cajas}</g>
</svg>`;

  return { svg, ancho, alto };
}
