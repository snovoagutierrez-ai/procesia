import { describe, it, expect } from "vitest";
import {
  canonicalRef,
  canonicalizeFlows,
  connectionError,
  detectFlowIssues,
} from "./flowGraph.js";

const TAREAS = [
  { id: 246, bpmnId: "Task_7sge", name: "Informar a superiores" },
  { id: 247, bpmnId: "Task_nnxi", name: "Enviar solicitud" },
];
const COMPUERTA = { bpmn_id: "Gateway_1EUSJ3", name: "¿NP con saldo suficiente?" };

const flow = (source_ref, target_ref, extra = {}) => ({
  bpmn_id: `F_${source_ref}_${target_ref}`, source_ref, target_ref, ...extra,
});

describe("canonicalRef", () => {
  it("traduce el id numérico al bpmn_id", () => {
    expect(canonicalRef("246", TAREAS)).toBe("Task_7sge");
    expect(canonicalRef(246, TAREAS)).toBe("Task_7sge");
  });

  it("deja intacto lo que ya es canónico", () => {
    expect(canonicalRef("Task_7sge", TAREAS)).toBe("Task_7sge");
    expect(canonicalRef("start", TAREAS)).toBe("start");
    expect(canonicalRef("end", TAREAS)).toBe("end");
    expect(canonicalRef("Gateway_1EUSJ3", TAREAS)).toBe("Gateway_1EUSJ3");
  });

  it("no inventa nada si la referencia no corresponde a ninguna tarea", () => {
    expect(canonicalRef("999", TAREAS)).toBe("999");
  });
});

describe("canonicalizeFlows", () => {
  it("corrige las referencias heredadas", () => {
    const [f] = canonicalizeFlows([flow("Gateway_1EUSJ3", "246")], TAREAS);
    expect(f.target_ref).toBe("Task_7sge");
  });

  it("corrige los dos extremos", () => {
    const [f] = canonicalizeFlows([flow("246", "247")], TAREAS);
    expect([f.source_ref, f.target_ref]).toEqual(["Task_7sge", "Task_nnxi"]);
  });

  it("conserva el resto de campos de la conexión", () => {
    const [f] = canonicalizeFlows(
      [flow("Gateway_1EUSJ3", "246", { condition_expression: "No", branch_probability: 15 })],
      TAREAS
    );
    expect(f.condition_expression).toBe("No");
    expect(f.branch_probability).toBe(15);
  });

  it("devuelve el mismo array si no había nada que corregir", () => {
    // Quien llama usa la identidad para no reguardar el grafo sin motivo.
    const entrada = [flow("start", "Task_7sge")];
    expect(canonicalizeFlows(entrada, TAREAS)).toBe(entrada);
  });

  it("aguanta entradas vacías", () => {
    expect(canonicalizeFlows([], TAREAS)).toEqual([]);
    expect(canonicalizeFlows(null, TAREAS)).toEqual([]);
    expect(canonicalizeFlows([flow("a", "b")], [])).toEqual([flow("a", "b")]);
  });
});

describe("connectionError", () => {
  it("acepta una conexión normal", () => {
    expect(connectionError("Task_7sge", "Task_nnxi", [])).toBeNull();
  });

  it("rechaza la auto-conexión", () => {
    expect(connectionError("Gateway_1EUSJ3", "Gateway_1EUSJ3", [])).toMatch(/consigo mismo/i);
  });

  it("rechaza entrar al Inicio y salir del Fin", () => {
    expect(connectionError("Task_7sge", "start", [])).toMatch(/Inicio/);
    expect(connectionError("end", "Task_7sge", [])).toMatch(/Fin/);
  });

  it("rechaza una conexión duplicada", () => {
    const existentes = [flow("Task_7sge", "Task_nnxi")];
    expect(connectionError("Task_7sge", "Task_nnxi", existentes)).toMatch(/ya existe/i);
  });

  it("rechaza extremos vacíos", () => {
    expect(connectionError("", "Task_7sge", [])).toBeTruthy();
    expect(connectionError("Task_7sge", null, [])).toBeTruthy();
  });
});

describe("detectFlowIssues", () => {
  it("no reporta nada en un flujo bien armado", () => {
    const flujos = [
      flow("start", "Task_7sge"),
      flow("Task_7sge", "Task_nnxi"),
      flow("Task_nnxi", "end"),
    ];
    expect(detectFlowIssues(TAREAS, [], flujos)).toEqual([]);
  });

  it("no acusa de 'sin entrada' a un nodo conectado por id numérico", () => {
    // Es el fallo que se veía en pantalla: la flecha estaba, el aviso también.
    const flujos = [
      flow("start", "246"),
      flow("246", "247"),
      flow("247", "end"),
    ];
    expect(detectFlowIssues(TAREAS, [], flujos)).toEqual([]);
  });

  it("detecta el nodo aislado y devuelve su id de canvas", () => {
    const issues = detectFlowIssues(TAREAS, [], [flow("start", "Task_7sge"), flow("Task_7sge", "end")]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: "isolated", name: "Enviar solicitud", nodeId: "task-247" });
  });

  it("distingue sin salida de sin entrada", () => {
    const soloEntrada = detectFlowIssues([TAREAS[0]], [], [flow("start", "Task_7sge")]);
    expect(soloEntrada[0].type).toBe("deadend");

    const soloSalida = detectFlowIssues([TAREAS[0]], [], [flow("Task_7sge", "end")]);
    expect(soloSalida[0].type).toBe("unreachable");
  });

  it("marca la compuerta que no ramifica", () => {
    const flujos = [
      flow("start", "Task_7sge"),
      flow("Task_7sge", "Gateway_1EUSJ3"),
      flow("Gateway_1EUSJ3", "Task_nnxi"),
      flow("Task_nnxi", "end"),
    ];
    const issues = detectFlowIssues(TAREAS, [COMPUERTA], flujos);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: "gateway", nodeId: "gw-Gateway_1EUSJ3" });
  });

  it("no marca la compuerta con dos ramas", () => {
    const flujos = [
      flow("start", "Gateway_1EUSJ3"),
      flow("Gateway_1EUSJ3", "Task_7sge"),
      flow("Gateway_1EUSJ3", "Task_nnxi"),
      flow("Task_7sge", "end"),
      flow("Task_nnxi", "end"),
    ];
    expect(detectFlowIssues(TAREAS, [COMPUERTA], flujos)).toEqual([]);
  });

  it("un proceso sin tareas no reporta nada", () => {
    expect(detectFlowIssues([], [COMPUERTA], [])).toEqual([]);
  });
});
