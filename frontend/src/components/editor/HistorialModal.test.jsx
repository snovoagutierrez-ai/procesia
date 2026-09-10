/**
 * Historial del flujo (observaciones del 10/09).
 *
 * Lo que se comprueba aqui es lo que el usuario pidio poder responder de un
 * vistazo: quien entro, quien cambio que, y poder saltar al objeto tocado.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import HistorialModal, { haceCuanto } from "./HistorialModal.jsx";
import { apiFetch } from "../../api.js";

vi.mock("../../api.js", () => ({ apiFetch: vi.fn(), apiMutate: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const ahora = new Date("2026-09-10T12:00:00Z");

const RESPUESTA = {
  owner_email: "johan.garrido@dts.cl",
  soy_el_dueno: true,
  ultima_entrada: { id: 3, action: "abrir", author_email: "ana@dts.cl", is_mine: false,
                    summary: "Abrió el flujo", created_at: "2026-09-10T11:30:00Z", ip_address: "203.0.113.9" },
  ultimo_cambio: { id: 2, action: "editar", target_type: "tarea", target_bpmn_id: "Task_7",
                   author_email: "ana@dts.cl", is_mine: false,
                   summary: "Editó el paso «Revisar documentos»", created_at: "2026-09-10T11:45:00Z" },
  entries: [
    { id: 3, action: "abrir", author_email: "ana@dts.cl", is_mine: false,
      summary: "Abrió el flujo", created_at: "2026-09-10T11:30:00Z", ip_address: "203.0.113.9" },
    { id: 2, action: "editar", target_type: "tarea", target_bpmn_id: "Task_7",
      author_email: "ana@dts.cl", is_mine: false,
      summary: "Editó el paso «Revisar documentos»", created_at: "2026-09-10T11:45:00Z" },
    { id: 1, action: "crear", target_type: "tarea", target_bpmn_id: "Task_7", is_mine: true,
      author_email: "johan.garrido@dts.cl", summary: "Creó el paso «Revisar documentos»",
      created_at: "2026-09-09T09:00:00Z" },
  ],
};

const responde = (body) => apiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });

const montar = (props = {}) =>
  render(<HistorialModal isOpen onClose={() => {}} processId={7} {...props} />);

describe("Historial del flujo", () => {
  it("no pide nada mientras está cerrado", () => {
    render(<HistorialModal isOpen={false} onClose={() => {}} processId={7} />);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("dice quién responde por el flujo", async () => {
    responde(RESPUESTA);
    montar();
    expect(await screen.findByText(/johan.garrido@dts.cl/)).toBeTruthy();
    expect(screen.getByText(/Responsable del flujo/)).toBeTruthy();
  });

  it("separa el último en entrar del último en cambiar", async () => {
    // Entrar a mirar no es tocar nada: mezclarlos daria por modificado un flujo
    // que solo se consulto.
    responde(RESPUESTA);
    montar();
    await screen.findByText(/Último en entrar/);
    expect(screen.getByText(/Último cambio/)).toBeTruthy();
  });

  it("lleva al objeto tocado cuando la anotación apunta a uno", async () => {
    responde(RESPUESTA);
    const onIrAlObjeto = vi.fn();
    const onClose = vi.fn();
    montar({ onIrAlObjeto, onClose });

    const fila = await screen.findByText("Editó el paso «Revisar documentos»");
    fireEvent.click(fila.closest("li"));
    expect(onIrAlObjeto).toHaveBeenCalledWith("Task_7");
    expect(onClose).toHaveBeenCalled();   // para dejar ver el diagrama
  });

  it("una anotación sin objeto no lleva a ninguna parte", async () => {
    responde(RESPUESTA);
    const onIrAlObjeto = vi.fn();
    montar({ onIrAlObjeto });

    const fila = await screen.findByText("Abrió el flujo");
    fireEvent.click(fila.closest("li"));
    expect(onIrAlObjeto).not.toHaveBeenCalled();
  });

  it("muestra la dirección de conexión y explica por qué la ve", async () => {
    responde(RESPUESTA);
    montar();
    expect(await screen.findByText(/203.0.113.9/)).toBeTruthy();
    expect(screen.getByText(/El resto de\s+colaboradores no las ve/)).toBeTruthy();
  });

  it("no inventa direcciones cuando el servidor no las envía", async () => {
    responde({ ...RESPUESTA, soy_el_dueno: false,
               entries: RESPUESTA.entries.map(e => ({ ...e, ip_address: null })) });
    montar();
    await screen.findByText(/Responsable del flujo/);
    expect(screen.queryByText(/203.0.113.9/)).toBeNull();
    expect(screen.queryByText(/direcciones de conexión/)).toBeNull();
  });

  it("un flujo recién creado lo dice en vez de quedarse en blanco", async () => {
    responde({ owner_email: "yo@dts.cl", soy_el_dueno: true,
               ultima_entrada: null, ultimo_cambio: null, entries: [] });
    montar();
    expect(await screen.findByText(/Todavía no hay movimientos/)).toBeTruthy();
    expect(screen.getByText("Sin cambios aún")).toBeTruthy();
  });

  it("avisa si el historial no se puede cargar", async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    montar();
    expect(await screen.findByText(/No se pudo cargar el historial/)).toBeTruthy();
  });
});

describe("haceCuanto", () => {
  const t = (iso) => haceCuanto(iso, ahora.getTime());

  it("usa lenguaje relativo, que es el que se lee sin calcular", () => {
    expect(t("2026-09-10T11:59:30Z")).toBe("hace un momento");
    expect(t("2026-09-10T11:45:00Z")).toBe("hace 15 min");
    expect(t("2026-09-10T09:00:00Z")).toBe("hace 3 h");
    expect(t("2026-09-09T12:00:00Z")).toBe("ayer");
    expect(t("2026-09-05T12:00:00Z")).toBe("hace 5 días");
  });

  it("no se rompe con una fecha ausente o ilegible", () => {
    expect(t(null)).toBe("");
    expect(t("no es una fecha")).toBe("");
  });
});
