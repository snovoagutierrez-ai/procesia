/**
 * Observacion del 10/09: los tiempos del panel derecho no coincidian con los de
 * las tarjetas del diagrama.
 *
 * Las dos vistas leen el MISMO dato (segundos), asi que la diferencia estaba en
 * como lo presenta el panel: TimeField elegia la unidad una sola vez, al
 * montarse, y React reutiliza el componente al cambiar de tarea. La unidad se
 * quedaba pegada de la tarea anterior y el numero mostrado (valor / unidad)
 * dejaba de corresponder con el de la tarjeta.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { TimeField } from "./uiAtoms.jsx";

afterEach(cleanup);

const montar = (props) =>
  render(<TimeField label="Tiempo de ciclo" valueSec={0} onChangeSec={() => {}} resetKey={1} {...props} />);

const campo = () => screen.getByRole("spinbutton");
const unidad = () => screen.getByRole("combobox");

describe("TimeField · unidad coherente con el valor", () => {
  it("elige la unidad legible segun el valor", () => {
    montar({ valueSec: 840 });          // 14 min
    expect(campo().value).toBe("14");
    expect(unidad().value).toBe("60");
  });

  it("muestra las horas como horas", () => {
    montar({ valueSec: 86400 });        // 24 h
    expect(campo().value).toBe("24");
    expect(unidad().value).toBe("3600");
  });

  it("al cambiar de tarea recalcula la unidad en vez de arrastrar la anterior", () => {
    // Es el caso de la observacion: se venia de una tarea en minutos y al pasar
    // a una de 24 h el panel seguia en minutos y mostraba otro numero.
    const { rerender } = montar({ valueSec: 840 });
    expect(campo().value).toBe("14");
    fireEvent.change(unidad(), { target: { value: "1" } });  // la persona toca la unidad

    // Se selecciona OTRO paso: cambia resetKey.
    rerender(<TimeField label="Tiempo de ciclo" valueSec={86400} onChangeSec={() => {}} resetKey={2} />);
    expect(unidad().value).toBe("3600");
    expect(campo().value).toBe("24");
  });

  it("respeta la unidad que elige la persona mientras edita esa tarea", () => {
    // Escribir "90" en minutos no debe saltar sola a "1.5 h" bajo los dedos.
    const onChangeSec = vi.fn();
    const { rerender } = montar({ valueSec: 840, onChangeSec });
    fireEvent.change(campo(), { target: { value: "90" } });
    expect(onChangeSec).toHaveBeenCalledWith(5400);

    rerender(<TimeField label="Tiempo de ciclo" valueSec={5400} onChangeSec={onChangeSec} resetKey={1} />);
    expect(unidad().value).toBe("60");
    expect(campo().value).toBe("90");
  });

  it("cambiar la unidad conserva el numero escrito", () => {
    const onChangeSec = vi.fn();
    montar({ valueSec: 840, onChangeSec });   // 14 m
    fireEvent.change(unidad(), { target: { value: "3600" } });
    expect(onChangeSec).toHaveBeenCalledWith(50400); // 14 h
  });

  it("un valor vacio deja el campo en blanco, no en cero", () => {
    montar({ valueSec: 0 });
    expect(campo().value).toBe("");
  });

  it("reinicia la unidad tambien bajo StrictMode", () => {
    // La aplicacion corre dentro de <React.StrictMode>, que renderiza dos veces.
    // Una version anterior guardaba la clave del paso en una referencia mutada
    // durante el render: la segunda pasada ya no detectaba el cambio y la
    // unidad se quedaba pegada de la tarea anterior. Solo se veia en la app,
    // nunca en un test que montara el componente suelto.
    const enModoEstricto = (props) => (
      <React.StrictMode>
        <TimeField label="Tiempo de ciclo" onChangeSec={() => {}} {...props} />
      </React.StrictMode>
    );
    const { rerender } = render(enModoEstricto({ valueSec: 86400, resetKey: 1 }));
    fireEvent.change(unidad(), { target: { value: "86400" } });   // la persona elige días
    expect(unidad().value).toBe("86400");

    rerender(enModoEstricto({ valueSec: 300, resetKey: 2 }));     // otro paso: 5 min
    expect(unidad().value).toBe("60");
    expect(campo().value).toBe("5");
  });
});
