/**
 * Verificación de las observaciones del 04/09 que viven en la interfaz.
 *
 * Se montan los componentes reales y se comprueba lo que ve y pulsa el usuario,
 * no el estado interno: es la única forma de demostrar que estos puntos quedaron
 * cerrados, porque ninguno se manifiesta en la API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import { Optimization, NodeComments, BranchRow } from "./Editors.jsx";
import { apiFetch } from "../../api.js";

vi.mock("../../api.js", () => ({
  apiFetch: vi.fn(),
  apiMutate: vi.fn(),
}));

const respuesta = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => body,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Punto 3 — "Ver el paso en el diagrama" y "Aplicar por mí" llevaban al mismo
// sitio y no ejecutaban nada. Debe quedar una sola acción, y honesta.
// ---------------------------------------------------------------------------

const estadoConRecomendacion = (accion = "SIMPLIFY") => ({
  status: "done",
  data: {
    recommendations: [{
      action_type: accion,
      title: "Reducir la revisión",
      description: "Conecta la salida de 'Revisar' con la entrada de 'Aprobar'.",
      target_node_bpmn_id: "Task_01",
      priority: 1,
      implementation_complexity: "low",
    }],
    inefficiencies: [],
    bottlenecks: [],
  },
});

const TAREAS = [{ id: 1, bpmnId: "Task_01", name: "Revisar", responsible: "Ana", valueClass: "VA", cycleTime: 300 }];

describe("Optimización · una sola acción por recomendación (punto 3)", () => {
  it("no ofrece dos botones que hagan lo mismo", () => {
    render(<Optimization state={estadoConRecomendacion()} onRun={() => {}} onApply={() => {}}
      onShowRecommendation={() => {}} tasks={TAREAS} />);

    expect(screen.queryByRole("button", { name: /aplicar por m/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^ver el paso en el diagrama$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /ver el paso y cómo aplicarlo/i })).toBeTruthy();
  });

  it("la acción lleva al paso que la recomendación menciona", () => {
    const onShow = vi.fn();
    render(<Optimization state={estadoConRecomendacion()} onRun={() => {}} onApply={() => {}}
      onShowRecommendation={onShow} tasks={TAREAS} />);

    fireEvent.click(screen.getByRole("button", { name: /ver el paso y cómo aplicarlo/i }));

    expect(onShow).toHaveBeenCalledTimes(1);
    expect(onShow.mock.calls[0][0].target_node_bpmn_id).toBe("Task_01");
  });

  it("una recomendación de eliminar tampoco ofrece ejecutarla", () => {
    // La IA orienta; borrar un paso es decisión de la persona.
    render(<Optimization state={estadoConRecomendacion("ELIMINATE")} onRun={() => {}} onApply={() => {}}
      onShowRecommendation={() => {}} tasks={TAREAS} />);

    const botones = screen.getAllByRole("button").map(b => b.textContent.toLowerCase());
    expect(botones.some(t => /aplicar por m/.test(t))).toBe(false);
    expect(botones.some(t => /elimina|borrar/.test(t))).toBe(false);
  });

  it("avisa cuando el análisis tarda, en vez de dejar el botón girando sin más", () => {
    const { rerender } = render(<Optimization state={{ status: "loading" }} onRun={() => {}} onApply={() => {}}
      onShowRecommendation={() => {}} tasks={TAREAS} longLoading={false} />);
    expect(screen.queryByText(/tardando más de lo normal/i)).toBeNull();

    rerender(<Optimization state={{ status: "loading" }} onRun={() => {}} onApply={() => {}}
      onShowRecommendation={() => {}} tasks={TAREAS} longLoading={true} />);
    expect(screen.getByText(/tardando más de lo normal/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Punto 1 — editar el comentario propio; sobre el ajeno, sugerir un cambio.
// ---------------------------------------------------------------------------

const COMENTARIO_PROPIO = { id: 1, node_bpmn_id: "T1", text: "Revisar con Legal", author_email: "yo@x.com", is_mine: true };
const COMENTARIO_AJENO = { id: 2, node_bpmn_id: "T1", text: "No me convence", author_email: "otro@x.com", is_mine: false };

async function montarComentarios(items) {
  apiFetch.mockResolvedValue(respuesta(items));
  render(<NodeComments processId={7} nodeBpmnId="T1" />);
  // el panel arranca plegado
  fireEvent.click(screen.getByRole("button", { name: /comentarios/i }));
  await waitFor(() => expect(screen.getByText(items[0].text)).toBeTruthy());
}

describe("Comentarios · editar el propio, sugerir sobre el ajeno (punto 1)", () => {
  beforeEach(() => apiFetch.mockReset());

  it("el comentario propio se puede editar y borrar", async () => {
    await montarComentarios([COMENTARIO_PROPIO]);
    expect(screen.getByRole("button", { name: /editar comentario/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /eliminar comentario/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sugerir cambio/i })).toBeNull();
  });

  it("el comentario de otra persona no se edita: se sugiere un cambio", async () => {
    await montarComentarios([COMENTARIO_AJENO]);
    expect(screen.queryByRole("button", { name: /editar comentario/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /eliminar comentario/i })).toBeNull();
    expect(screen.getByRole("button", { name: /sugerir cambio/i })).toBeTruthy();
  });

  it("guardar la edición manda un PUT con el texto nuevo", async () => {
    await montarComentarios([COMENTARIO_PROPIO]);
    fireEvent.click(screen.getByRole("button", { name: /editar comentario/i }));

    const campo = screen.getByLabelText(/editar comentario/i);
    expect(campo.value).toBe("Revisar con Legal");
    fireEvent.change(campo, { target: { value: "Revisar con Legal y Cumplimiento" } });

    apiFetch.mockResolvedValueOnce(respuesta({ ...COMENTARIO_PROPIO, text: "Revisar con Legal y Cumplimiento" }));
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      const llamada = apiFetch.mock.calls.find(c => c[1]?.method === "PUT");
      expect(llamada).toBeTruthy();
      expect(llamada[0]).toBe("/processes/7/comments/1");
      expect(JSON.parse(llamada[1].body).text).toBe("Revisar con Legal y Cumplimiento");
    });
  });

  it("la sugerencia se envía como comentario nuevo y cita el original", async () => {
    await montarComentarios([COMENTARIO_AJENO]);
    fireEvent.click(screen.getByRole("button", { name: /sugerir cambio/i }));

    fireEvent.change(screen.getByLabelText(/sugerencia de cambio/i), {
      target: { value: "Yo lo diría al revés" },
    });
    apiFetch.mockResolvedValueOnce(respuesta({ id: 3, text: "…", is_mine: true }));
    fireEvent.click(screen.getByRole("button", { name: /enviar/i }));

    await waitFor(() => {
      const llamada = apiFetch.mock.calls.find(c => c[1]?.method === "POST");
      expect(llamada).toBeTruthy();
      const enviado = JSON.parse(llamada[1].body).text;
      // No modifica el texto ajeno: deja constancia de quién y de qué se sugiere.
      expect(enviado).toMatch(/otro@x\.com/);
      expect(enviado).toMatch(/No me convence/);
      expect(enviado).toMatch(/Yo lo diría al revés/);
    });
  });
});

// ---------------------------------------------------------------------------
// Ramas de la compuerta: borrar una sola, sin tocar las demás.
// ---------------------------------------------------------------------------

describe("Ramas de la compuerta · borrado individual", () => {
  it("ofrece borrar esta rama concreta, nombrando su destino", () => {
    const onRemove = vi.fn();
    const flujo = { bpmn_id: "F1", source_ref: "GW", target_ref: "T2", condition_expression: "No", branch_probability: 20 };
    render(<BranchRow flow={flujo} targetName="Corregir documentos" isExclusive onCommit={() => {}} onRemove={onRemove} />);

    const btn = screen.getByRole("button", { name: /eliminar la rama hacia corregir documentos/i });
    fireEvent.click(btn);

    expect(onRemove).toHaveBeenCalledWith(flujo);
  });
});

// ---------------------------------------------------------------------------
// Formato de tiempos — visto en el resumen: "10.350000000000001 s"
// ---------------------------------------------------------------------------

import { fmtShort, fmtLong } from "./Editors.jsx";

describe("Formato de tiempos", () => {
  it("no derrama decimales de coma flotante", () => {
    // El valor exacto que aparecia en pantalla.
    expect(fmtLong(10.350000000000001)).toBe("10.4 s");
    expect(fmtShort(10.350000000000001)).toBe("10.4s");
  });

  it("redondea a un decimal como máximo", () => {
    expect(fmtLong(0.1 + 0.2)).toBe("0.3 s");
    expect(fmtLong(59.99)).toBe("60 s");
  });

  it("usa la unidad adecuada a cada magnitud", () => {
    expect(fmtLong(30)).toBe("30 s");
    expect(fmtLong(600)).toBe("10 min");
    expect(fmtLong(5400)).toBe("1.5 h");
    expect(fmtShort(0)).toBe("0");
    expect(fmtShort(120)).toBe("2m");
    expect(fmtShort(3600)).toBe("1h");
  });

  it("aguanta valores no numéricos", () => {
    expect(fmtLong(null)).toBe("0 s");
    expect(fmtLong(undefined)).toBe("0 s");
    expect(fmtShort("no es un número")).toBe("0");
  });
});
