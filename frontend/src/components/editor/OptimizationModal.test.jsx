/**
 * La optimizacion dejo de ser una pestana del panel de detalle (donde disponia
 * de unos 300px y salia cortada) y pasa a una ventana propia dentro de la misma
 * pagina. Aqui se comprueba lo que ve y pulsa el usuario.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import OptimizationModal from "./OptimizationModal.jsx";

vi.mock("../../api.js", () => ({
  apiFetch: vi.fn(),
  apiMutate: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TAREAS = [{ id: 1, bpmnId: "Task_01", name: "Revisar", responsible: "Ana", valueClass: "VA", cycleTime: 300 }];

const montar = (props = {}) =>
  render(
    <OptimizationModal
      isOpen onClose={() => {}}
      state={{ status: "idle" }} onRun={() => {}} onApply={() => {}}
      tasks={TAREAS} onShowRecommendation={() => {}} longLoading={false}
      {...props}
    />
  );

describe("Optimización en ventana propia", () => {
  it("no se dibuja nada mientras está cerrada", () => {
    const { container } = montar({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("al abrirse muestra el panel de optimización", () => {
    montar();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Optimizar proceso/i })).toBeTruthy();
  });

  it("titula la ventana una sola vez", () => {
    // El panel traia su propio <h3> con el mismo texto y salia repetido.
    montar();
    expect(screen.getAllByText("Optimización con IA")).toHaveLength(1);
  });

  it("se cierra con la tecla Escape", () => {
    const onClose = vi.fn();
    montar({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deja de escuchar Escape cuando se cierra", () => {
    const onClose = vi.fn();
    const { rerender } = montar({ onClose });
    rerender(
      <OptimizationModal
        isOpen={false} onClose={onClose}
        state={{ status: "idle" }} onRun={() => {}} onApply={() => {}}
        tasks={TAREAS} onShowRecommendation={() => {}} longLoading={false}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("se cierra al pulsar el fondo, pero no al pulsar dentro", () => {
    const onClose = vi.fn();
    const { container } = montar({ onClose });
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector(".pa-modal-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("se cierra con el aspa de la cabecera", () => {
    const onClose = vi.fn();
    montar({ onClose });
    fireEvent.click(screen.getByRole("button", { name: /Cerrar optimización/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
