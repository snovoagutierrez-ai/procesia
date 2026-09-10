/**
 * Respaldo del flujo en archivo (observacion del 10/09).
 *
 * El peso de estos tests esta en la VALIDACION: restaurar reemplaza todo el
 * flujo actual, asi que un archivo equivocado tiene que detenerse antes de
 * tocar nada, no a mitad de camino con las tareas ya borradas.
 */
import { describe, it, expect } from "vitest";
import { construirRespaldo, validarRespaldo, VERSION_RESPALDO } from "./respaldo.js";

const PROC = { code: "P-01", name: "Evaluación crediticia", objective: "Aprobar o rechazar",
               trigger_event: "Solicitud", output_result: "Cliente aprobado", monthly_volume: 120 };
const TAREAS = [{ id: 1, bpmnId: "T1", name: "Revisar", cycleTime: 300 }];
const FLUJOS = [{ bpmn_id: "F1", source_ref: "start", target_ref: "T1" }];

const respaldoValido = () => construirRespaldo({
  proc: PROC, tasks: TAREAS, gateways: [], sequenceFlows: FLUJOS,
  layout: { "task:T1": { x: 10, y: 20 } },
});

describe("Construir el respaldo", () => {
  it("lleva la ficha del proceso y su contenido completo", () => {
    const r = respaldoValido();
    expect(r.aiproces_respaldo).toBe(VERSION_RESPALDO);
    expect(r.proceso.code).toBe("P-01");
    expect(r.proceso.trigger_event).toBe("Solicitud");
    expect(r.snapshot.tasks).toHaveLength(1);
    expect(r.snapshot.sequence_flows).toHaveLength(1);
    expect(r.snapshot.layout).toEqual({ "task:T1": { x: 10, y: 20 } });
  });

  it("usa el mismo formato que una versión guardada", () => {
    // A proposito: restaurar un respaldo reutiliza el camino ya probado de
    // restaurar una version, en vez de abrir un segundo camino paralelo.
    const r = respaldoValido();
    expect(Object.keys(r.snapshot).sort()).toEqual(
      ["gateways", "label", "layout", "sequence_flows", "tasks"]);
  });

  it("anota cuándo se generó", () => {
    expect(() => new Date(respaldoValido().generado).toISOString()).not.toThrow();
  });
});

describe("Validar un archivo antes de restaurar", () => {
  it("acepta un respaldo bien formado", () => {
    const r = validarRespaldo(respaldoValido());
    expect(r.ok).toBe(true);
    expect(r.snapshot.tasks).toHaveLength(1);
    expect(r.proceso.name).toBe("Evaluación crediticia");
  });

  it("rechaza un archivo que no es de AiProces", () => {
    expect(validarRespaldo({ hola: "mundo" }).ok).toBe(false);
    expect(validarRespaldo(null).ok).toBe(false);
    expect(validarRespaldo("texto suelto").ok).toBe(false);
  });

  it("rechaza un respaldo de una versión más nueva", () => {
    // Restaurarlo a ciegas podria perder datos que esta version no entiende.
    const r = validarRespaldo({ ...respaldoValido(), aiproces_respaldo: VERSION_RESPALDO + 1 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/más nueva/);
  });

  it("rechaza un respaldo sin pasos, que dejaría el flujo vacío", () => {
    const base = respaldoValido();
    expect(validarRespaldo({ ...base, snapshot: { ...base.snapshot, tasks: [] } }).ok).toBe(false);
    expect(validarRespaldo({ ...base, snapshot: { ...base.snapshot, tasks: null } }).ok).toBe(false);
    expect(validarRespaldo({ ...base, snapshot: null }).ok).toBe(false);
  });

  it("tolera un respaldo sin compuertas ni conexiones", () => {
    const base = respaldoValido();
    const r = validarRespaldo({ ...base, snapshot: { tasks: TAREAS } });
    expect(r.ok).toBe(true);
    expect(r.snapshot.gateways).toEqual([]);
    expect(r.snapshot.sequence_flows).toEqual([]);
    expect(r.snapshot.layout).toBeNull();
  });

  it("da un motivo legible en cada rechazo", () => {
    for (const malo of [{ hola: 1 }, null, { aiproces_respaldo: 1 }]) {
      const r = validarRespaldo(malo);
      expect(r.ok).toBe(false);
      expect(typeof r.motivo).toBe("string");
      expect(r.motivo.length).toBeGreaterThan(10);
    }
  });
});
