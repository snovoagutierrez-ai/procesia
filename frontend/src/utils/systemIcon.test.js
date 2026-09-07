import { describe, it, expect } from "vitest";
import { familiaDeSistema } from "./systemIcon.js";

const clave = (sistemas, tipo) => familiaDeSistema(sistemas, tipo)?.clave ?? null;

describe("Dónde ocurre la tarea, deducido del campo Sistemas (obs 08/09)", () => {
  it("reconoce una hoja de cálculo", () => {
    expect(clave("Excel")).toBe("hoja");
    expect(clave("Google Sheets")).toBe("hoja");
    expect(clave("planilla .xlsx del área")).toBe("hoja");
  });

  it("reconoce una base de datos o sistema de gestión", () => {
    expect(clave("SAP")).toBe("base");
    expect(clave("consulta SQL al datawarehouse")).toBe("base");
    expect(clave("Power BI")).toBe("base");
    expect(clave("CRM comercial")).toBe("base");
  });

  it("reconoce una página web", () => {
    expect(clave("Portal del proveedor")).toBe("web");
    expect(clave("intranet")).toBe("web");
  });

  it("reconoce correo, carpeta, documento y papel", () => {
    expect(clave("Outlook")).toBe("correo");
    expect(clave("SharePoint")).toBe("carpeta");
    expect(clave("Word")).toBe("documento");
    expect(clave("Se firma en papel")).toBe("papel");
  });

  it("con varias herramientas gana la primera reconocida", () => {
    expect(clave("Excel y correo")).toBe("hoja");
  });

  it("si hay herramienta pero no se reconoce, no se calla: dice que hay sistema", () => {
    expect(clave("SANP")).toBe("sistema");
    expect(clave("SIGEPAC")).toBe("sistema");
  });

  it("sin herramienta anotada, se apoya en el tipo de tarea", () => {
    expect(clave("", "manual")).toBe("papel");
    expect(clave("", "service")).toBe("sistema");
    expect(clave("", "user")).toBeNull();
  });

  it("no inventa nada cuando no hay dato alguno", () => {
    expect(familiaDeSistema(null)).toBeNull();
    expect(familiaDeSistema("   ")).toBeNull();
    expect(familiaDeSistema(undefined, undefined)).toBeNull();
  });

  it("cada familia trae una etiqueta legible para el usuario", () => {
    expect(familiaDeSistema("Excel").etiqueta).toBe("Hoja de cálculo");
    expect(familiaDeSistema("SQL").etiqueta).toBe("Base de datos");
  });
});
