import { describe, it, expect } from "vitest";
import { resumenNarrativo } from "./processNarrative.js";

const PROC = {
  name: "Solicitud de facturación",
  objective: "Emitir la factura al cliente sin errores",
  trigger_event: "Se recibe la solicitud",
  output_result: "Factura emitida",
  suppliers: "Área comercial",
  customers: "Cliente final",
};
const TAREAS = [
  { name: "Revisar documentos", valueClass: "NNVA" },
  { name: "Aprobar crédito", valueClass: "VA" },
  { name: "Corregir documentos", valueClass: "NVA" },
];
const COMPUERTAS = [
  { bpmn_id: "GW1", node_type: "exclusiveGateway" },
  { bpmn_id: "GW2", node_type: "parallelGateway" },
];
const METRICAS = {
  lead_time_sec: 6690,
  total_cycle_time_sec: 1290,
  total_wait_time_sec: 5400,
  pce_percentage: 9,
  constraint: { name: "Corregir documentos", cycle_time_sec: 900, theoretical_throughput_per_hour: 4 },
};

const texto = (args) => resumenNarrativo(args).join(" ");

describe("Resumen explicado del proceso (obs 08/09)", () => {
  it("cuenta de qué va, cuándo arranca y cómo termina", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/Solicitud de facturación/);
    expect(t).toMatch(/arranca cuando se recibe la solicitud/i);
    expect(t).toMatch(/termina con factura emitida/i);
  });

  it("dice quién provee y quién recibe", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/Área comercial/);
    expect(t).toMatch(/Cliente final/);
  });

  it("resume las etapas, distinguiendo decisión de paralelo", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/3 pasos/);
    expect(t).toMatch(/1 decisión/);
    expect(t).toMatch(/1 tramo que ocurre en paralelo/);
  });

  it("explica los tiempos en unidades legibles, no en segundos crudos", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/1\.9 h/);          // lead time
    expect(t).toMatch(/21\.5 min/);        // ciclo
    expect(t).toMatch(/81% del total esperando/);
    expect(t).not.toMatch(/\d{4,} s/);
  });

  it("interpreta la eficiencia en vez de soltar el número", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/9% de ese tiempo aporta valor/);
    expect(t).toMatch(/cifra baja/i);
  });

  it("señala el paso que marca el ritmo y por qué importa", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/«Corregir documentos»/);
    expect(t).toMatch(/4 unidades por hora/);
    expect(t).toMatch(/Acelerar cualquier otro paso no aumenta la capacidad/);
  });

  it("nombra los pasos marcados como desperdicio", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS, metricsData: METRICAS });
    expect(t).toMatch(/1 paso marcado como desperdicio/);
    expect(t).toMatch(/«Corregir documentos»/);
  });

  it("un proceso sin pasos lo dice, en vez de inventar cifras", () => {
    const t = texto({ proc: PROC, tasks: [], gateways: [], metricsData: null });
    expect(t).toMatch(/Aún no tiene pasos levantados/);
    expect(t).not.toMatch(/tarda/);
  });

  it("un proceso sin objetivo ni límites orienta sobre qué rellenar", () => {
    const t = texto({ proc: { name: "Nuevo proceso" }, tasks: [], gateways: [] });
    expect(t).toMatch(/rellenar el SIPOC/);
  });

  it("sin proceso no devuelve nada", () => {
    expect(resumenNarrativo({})).toEqual([]);
    expect(resumenNarrativo()).toEqual([]);
  });

  it("funciona sin métricas: el resumen nunca depende de la IA", () => {
    const t = texto({ proc: PROC, tasks: TAREAS, gateways: COMPUERTAS });
    expect(t).toMatch(/3 pasos/);
    expect(t).toMatch(/desperdicio/);
  });
});
