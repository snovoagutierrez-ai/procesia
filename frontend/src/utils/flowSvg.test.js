import { describe, it, expect } from "vitest";
import { diagramaSvg } from "./flowSvg.js";

const PROC = { name: "Evaluación crediticia", code: "P-01",
               trigger_event: "Se recibe la solicitud", output_result: "Cliente aprobado" };
const TAREAS = [
  { id: 1, bpmnId: "T1", name: "Revisar documentos", type: "user", valueClass: "NNVA", cycleTime: 300, waitTime: 3600 },
  { id: 2, bpmnId: "T2", name: "Aprobar crédito", type: "user", valueClass: "VA", cycleTime: 600, waitTime: 0 },
];
const COMPUERTAS = [
  { bpmn_id: "GW", name: "¿Completa?", node_type: "exclusiveGateway" },
  { bpmn_id: "GP", name: "En paralelo", node_type: "parallelGateway" },
];
const FLUJOS = [
  { bpmn_id: "F1", source_ref: "start", target_ref: "T1" },
  { bpmn_id: "F2", source_ref: "T1", target_ref: "GW" },
  { bpmn_id: "F3", source_ref: "GW", target_ref: "T2", condition_expression: "Sí", branch_probability: 80 },
  { bpmn_id: "F4", source_ref: "T2", target_ref: "end" },
];

const generar = (extra = {}) =>
  diagramaSvg({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, sequenceFlows: FLUJOS, ...extra });

describe("Diagrama exportable en SVG", () => {
  it("produce un SVG bien formado y con tamaño propio", () => {
    const r = generar();
    expect(r.svg.startsWith("<svg")).toBe(true);
    expect(r.svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(r.ancho).toBeGreaterThan(0);
    expect(r.alto).toBeGreaterThan(0);
    expect(r.svg).toContain(`viewBox="0 0 ${r.ancho} ${r.alto}"`);
  });

  it("incluye todos los pasos con su nombre", () => {
    const svg = generar().svg;
    expect(svg).toContain("Revisar documentos");
    expect(svg).toContain("Aprobar crédito");
  });

  it("dibuja el rombo de la decisión y el rectángulo del paralelo", () => {
    const svg = generar().svg;
    expect(svg).toMatch(/<polygon points=/);   // exclusiva
    expect(svg).toMatch(/<rect x="\d+" y="\d+" width="48"/);  // paralela
  });

  it("traza una conexión por cada flujo, con punta de flecha", () => {
    const svg = generar().svg;
    expect((svg.match(/marker-end="url\(#punta\)"/g) || []).length).toBe(FLUJOS.length);
  });

  it("muestra la etiqueta de la rama con su probabilidad", () => {
    expect(generar().svg).toContain("Sí (80%)");
  });

  it("marca el paso que fija el ritmo cuando se le indica", () => {
    expect(generar({ constraintBpmnId: "T2" }).svg).toContain("MARCA EL RITMO");
    expect(generar().svg).not.toContain("MARCA EL RITMO");
  });

  it("escapa el texto para no romper el SVG", () => {
    const conAngulos = [{ ...TAREAS[0], name: 'A & B <b>c</b>' }];
    const svg = diagramaSvg({ proc: PROC, tasks: conAngulos, gateways: [], sequenceFlows: [] }).svg;
    expect(svg).not.toMatch(/<b>/);
    expect(svg).toContain("&lt;b&gt;");
    expect(svg).toContain("&amp;");
  });

  it("respeta las posiciones manuales si se le pasan", () => {
    const sinLayout = generar();
    const conLayout = generar({ layout: { "task-1": { x: 900, y: 400 }, "task-2": { x: 1200, y: 400 } } });
    expect(conLayout.ancho).not.toBe(sinLayout.ancho);
  });

  it("no dibuja nada si no hay pasos", () => {
    expect(diagramaSvg({ proc: PROC, tasks: [], gateways: [], sequenceFlows: [] })).toBeNull();
    expect(diagramaSvg({})).toBeNull();
  });
});
