/**
 * Lo que se ve en el diagrama: orden de los pasos, conectores diferenciados y
 * marcado del nodo con problemas. Son las observaciones del 04/09 sobre el mapa.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";

import { buildFlowData, TaskNode, GatewayNode } from "./FlowDiagrams.jsx";

afterEach(cleanup);

const PROC = { trigger_event: "Se recibe la solicitud", output_result: "Cliente aprobado" };
const TAREAS = [
  { id: 1, bpmnId: "T1", name: "Revisar", type: "user", valueClass: "VA", cycleTime: 300, waitTime: 0 },
  { id: 2, bpmnId: "T2", name: "Aprobar", type: "user", valueClass: "VA", cycleTime: 600, waitTime: 0 },
  { id: 3, bpmnId: "T3", name: "Corregir", type: "manual", valueClass: "NVA", wasteType: "defects", cycleTime: 900, waitTime: 0 },
];
const COMPUERTAS = [{ bpmn_id: "GW", name: "¿Completa?", gateway_type: "exclusive" }];
const flujo = (s, t, extra = {}) => ({ bpmn_id: `F_${s}_${t}`, source_ref: s, target_ref: t, ...extra });

const construir = (flows) => buildFlowData(PROC, TAREAS, COMPUERTAS, flows, () => {}, () => {}, null, false);
const nodoTarea = (data, id) => data.nodes.find((n) => n.id === id);

// ---------------------------------------------------------------------------
// Punto 6 — seguir el flujo: numero de orden y direccion
// ---------------------------------------------------------------------------

describe("Seguimiento del flujo (punto 6)", () => {
  it("cada tarea lleva su número de orden, el mismo de la lista lateral", () => {
    const d = construir([]);
    expect(nodoTarea(d, "task-1").data.order).toBe(1);
    expect(nodoTarea(d, "task-2").data.order).toBe(2);
    expect(nodoTarea(d, "task-3").data.order).toBe(3);
  });

  it("el número se pinta en la tarjeta con dos dígitos", () => {
    render(<ReactFlowProvider><TaskNode data={{ ...TAREAS[0], label: "Revisar", order: 4, taskType: "user", valueClass: "VA", cycleTime: 300 }} /></ReactFlowProvider>);
    expect(screen.getByText("04")).toBeInTheDocument();
    expect(screen.getByText("Revisar")).toBeInTheDocument();
  });

  it("las conexiones llevan punta de flecha en el extremo", () => {
    const d = construir([flujo("T1", "T2")]);
    expect(d.edges[0].markerEnd?.type).toBeTruthy();
  });

  it("la etiqueta de la rama muestra condición y probabilidad juntas", () => {
    const d = construir([flujo("GW", "T2", { condition_expression: "Sí", branch_probability: 80 })]);
    expect(d.edges[0].label).toBe("Sí (80%)");
  });
});

// ---------------------------------------------------------------------------
// Punto 7 (03/09) — distinguir entrada de salida
// ---------------------------------------------------------------------------

describe("Conectores de entrada y salida", () => {
  it("la tarea tiene un conector de entrada y otro de salida, distinguibles", () => {
    const { container } = render(
      <ReactFlowProvider><TaskNode data={{ label: "Revisar", taskType: "user", valueClass: "VA", cycleTime: 60 }} /></ReactFlowProvider>
    );
    expect(container.querySelector(".rf-handle-in")).toBeTruthy();
    expect(container.querySelector(".rf-handle-out")).toBeTruthy();
  });

  it("cada conector explica qué hacer con él", () => {
    const { container } = render(
      <ReactFlowProvider><TaskNode data={{ label: "Revisar", taskType: "user", valueClass: "VA", cycleTime: 60 }} /></ReactFlowProvider>
    );
    expect(container.querySelector(".rf-handle-in").getAttribute("title")).toMatch(/entrada/i);
    expect(container.querySelector(".rf-handle-out").getAttribute("title")).toMatch(/salida/i);
  });

  it("la compuerta ofrece sus cuatro puntos, dos de entrada y dos de salida", () => {
    const { container } = render(
      <ReactFlowProvider><GatewayNode data={{ label: "¿Completa?", gatewayType: "exclusive", gatewayId: "GW" }} /></ReactFlowProvider>
    );
    expect(container.querySelectorAll(".rf-handle-in").length).toBe(2);
    expect(container.querySelectorAll(".rf-handle-out").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Punto 4 — el nodo con problema se marca en el propio mapa
// ---------------------------------------------------------------------------

describe("Marcado del nodo con problema (punto 4)", () => {
  it("la tarjeta se marca y lo explica al pasar el ratón", () => {
    const { container } = render(
      <ReactFlowProvider><TaskNode data={{ label: "Corregir", taskType: "manual", valueClass: "NVA", cycleTime: 900, hasIssue: true }} /></ReactFlowProvider>
    );
    const tarjeta = container.querySelector(".rf-task-node");
    expect(tarjeta.classList.contains("has-issue")).toBe(true);
    expect(tarjeta.getAttribute("title")).toMatch(/problema de conexión/i);
  });

  it("una tarjeta sana no se marca", () => {
    const { container } = render(
      <ReactFlowProvider><TaskNode data={{ label: "Revisar", taskType: "user", valueClass: "VA", cycleTime: 300 }} /></ReactFlowProvider>
    );
    expect(container.querySelector(".rf-task-node").classList.contains("has-issue")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Punto 5 — las conexiones se reconocen aunque vengan con el id antiguo
// ---------------------------------------------------------------------------

describe("Conexiones heredadas (punto 5)", () => {
  it("una conexión guardada con el id numérico se dibuja igual", () => {
    // Es el dato que dejaron los procesos antiguos: target_ref = "2".
    const d = construir([flujo("T1", "2")]);
    expect(d.edges).toHaveLength(1);
    expect(d.edges[0].source).toBe("task-1");
    expect(d.edges[0].target).toBe("task-2");
  });

  it("el punto por el que se dibujó cada conexión se conserva", () => {
    const d = construir([flujo("GW", "T2", { source_handle: "bottom", target_handle: "left" })]);
    expect(d.edges[0].sourceHandle).toBe("bottom");
    expect(d.edges[0].targetHandle).toBe("left");
  });

  it("los nodos de Inicio y Fin existen siempre", () => {
    const d = construir([]);
    expect(d.nodes.find((n) => n.id === "start")).toBeTruthy();
    expect(d.nodes.find((n) => n.id === "end")).toBeTruthy();
  });
});
