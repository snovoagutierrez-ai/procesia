/**
 * Las conexiones desaparecian («las tareas quedan en el aire») cada vez que el
 * diagrama reconstruia sus nodos: llegaban sin `measured` y React Flow descartaba
 * los puntos de enganche de las flechas, sin volver a medirlos nunca.
 */
import { describe, it, expect } from "vitest";
import { conservarMedidas } from "./reactFlowNodos.js";

const medido = { width: 240, height: 110 };

describe("conservarMedidas", () => {
  it("arrastra la medicion del nodo anterior con el mismo id", () => {
    const previos = [{ id: "task-1", position: { x: 0, y: 0 }, measured: medido }];
    const nuevos = [{ id: "task-1", position: { x: 300, y: 80 } }];
    const [n] = conservarMedidas(nuevos, previos);
    expect(n.measured).toEqual(medido);
  });

  it("no toca la posicion: la nueva disposicion manda", () => {
    const previos = [{ id: "task-1", position: { x: 0, y: 0 }, measured: medido }];
    const [n] = conservarMedidas([{ id: "task-1", position: { x: 300, y: 80 } }], previos);
    expect(n.position).toEqual({ x: 300, y: 80 });
  });

  it("un nodo que no existia antes llega sin medicion, para que se mida", () => {
    const previos = [{ id: "task-1", measured: medido }];
    const [, nuevo] = conservarMedidas([{ id: "task-1" }, { id: "task-2" }], previos);
    expect(nuevo.measured).toBeUndefined();
  });

  it("si el nodo nuevo ya trae su medicion, se respeta", () => {
    const propia = { width: 60, height: 60 };
    const [n] = conservarMedidas([{ id: "gw-A", measured: propia }], [{ id: "gw-A", measured: medido }]);
    expect(n.measured).toEqual(propia);
  });

  it("sin nodos previos devuelve la lista tal cual", () => {
    const nuevos = [{ id: "task-1" }];
    expect(conservarMedidas(nuevos, [])).toBe(nuevos);
    expect(conservarMedidas(nuevos, undefined)).toBe(nuevos);
  });
});
