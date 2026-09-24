/**
 * Fundamentos reemplaza al boton «Nomenclaturas».
 *
 * Se comprueba que abre en las metodologias y que el glosario del proceso
 * sigue accesible: quitar el boton no puede dejar las siglas sin editar.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

import FundamentosModal from "./FundamentosModal.jsx";
import { CAPITULOS } from "../shared/fundamentosDatos.js";
import { apiFetch } from "../../api.js";

vi.mock("../../api.js", () => ({ apiFetch: vi.fn(), apiMutate: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FundamentosModal", () => {
  it("abre en las metodologías, con todos los capítulos y sin pedir el glosario", () => {
    render(<FundamentosModal isOpen onClose={() => {}} processId={7} />);
    for (const cap of CAPITULOS) {
      expect(screen.getByText(cap.titulo)).toBeInTheDocument();
    }
    expect(screen.getByText("La restricción del sistema")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("la pestaña de nomenclaturas carga el glosario del proceso", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, term: "NP", meaning: "Nota de pedido", reference: null }],
    });
    render(<FundamentosModal isOpen onClose={() => {}} processId={7} />);
    fireEvent.click(screen.getByRole("tab", { name: /Nomenclaturas del proceso/ }));
    await waitFor(() => expect(screen.getByText("Nota de pedido")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith("/processes/7/glossary");
  });

  it("se cierra con Escape", () => {
    const onClose = vi.fn();
    render(<FundamentosModal isOpen onClose={onClose} processId={7} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
