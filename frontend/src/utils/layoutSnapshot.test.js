import { describe, it, expect } from "vitest";
import { layoutPortable, layoutParaLienzo } from "./layoutSnapshot.js";

const ANTES = [
  { id: 42, bpmnId: "Task_aaa", name: "Revisar" },
  { id: 43, bpmnId: "Task_bbb", name: "Aprobar" },
];
// Tras restaurar, las tareas se recrean: mismo bpmn_id, id distinto.
const DESPUES = [
  { id: 77, bpmnId: "Task_aaa", name: "Revisar" },
  { id: 78, bpmnId: "Task_bbb", name: "Aprobar" },
];

const LIENZO = {
  "task-42": { x: 100, y: 50 },
  "task-43": { x: 400, y: 50 },
  "gw-Gateway_x": { x: 250, y: 120 },
  start: { x: 0, y: 50 },
  end: { x: 600, y: 50 },
};

describe("Posiciones que sobreviven a restaurar una versión", () => {
  it("el ida y vuelta devuelve las posiciones a las tareas correctas", () => {
    const portable = layoutPortable(LIENZO, ANTES);
    const recuperado = layoutParaLienzo(portable, DESPUES);

    // Las tareas cambiaron de id, pero cada una conserva SU posición.
    expect(recuperado["task-77"]).toEqual({ x: 100, y: 50 });
    expect(recuperado["task-78"]).toEqual({ x: 400, y: 50 });
  });

  it("compuertas, inicio y fin conservan su clave estable", () => {
    const recuperado = layoutParaLienzo(layoutPortable(LIENZO, ANTES), DESPUES);
    expect(recuperado["gw-Gateway_x"]).toEqual({ x: 250, y: 120 });
    expect(recuperado.start).toEqual({ x: 0, y: 50 });
    expect(recuperado.end).toEqual({ x: 600, y: 50 });
  });

  it("sin la traducción, las posiciones se perderían", () => {
    // Es exactamente lo que pasaba antes: aplicar el layout viejo tal cual.
    const aplicadoCrudo = Object.keys(LIENZO).filter((k) => DESPUES.some((t) => `task-${t.id}` === k));
    expect(aplicadoCrudo).toEqual([]);
  });

  it("una tarea borrada entre versiones no ensucia el layout", () => {
    const portable = layoutPortable(LIENZO, ANTES);
    const soloUna = layoutParaLienzo(portable, [DESPUES[0]]);
    expect(soloUna["task-77"]).toBeTruthy();
    expect(Object.keys(soloUna).some((k) => k === "task-78")).toBe(false);
  });

  it("guarda por bpmn_id, no por id numérico", () => {
    const portable = layoutPortable(LIENZO, ANTES);
    expect(portable["task:Task_aaa"]).toEqual({ x: 100, y: 50 });
    expect(portable["task-42"]).toBeUndefined();
  });

  it("descarta posiciones corruptas en vez de propagarlas", () => {
    const sucio = { "task-42": { x: 1, y: 2 }, "task-43": null, "gw-a": { x: "no" } };
    const portable = layoutPortable(sucio, ANTES);
    expect(Object.keys(portable)).toEqual(["task:Task_aaa"]);
  });

  it("sin layout no inventa nada", () => {
    expect(layoutPortable(null, ANTES)).toBeNull();
    expect(layoutPortable({}, ANTES)).toBeNull();
    expect(layoutParaLienzo(null, DESPUES)).toBeNull();
    expect(layoutParaLienzo({ "task:Task_zzz": { x: 1, y: 1 } }, DESPUES)).toBeNull();
  });
});
