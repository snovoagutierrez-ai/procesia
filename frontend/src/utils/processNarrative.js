/**
 * Obs 08/09: "Aplicar un resumen explicado del proceso en cuestión [...] un
 * resumen en que consta, sus etapas, tiempos, etc."
 *
 * El resumen actual es un volcado: casillas de SIPOC, cifras sueltas y una lista
 * numerada de tareas. Aquí se redacta en prosa a partir de esos mismos datos.
 *
 * Es deterministe a propósito: no depende de que la IA responda ni de que haya
 * clave configurada, así que el resumen existe siempre. La IA puede añadir su
 * lectura encima, pero nunca es requisito para leer de qué va el proceso.
 */

const fmt = (sec) => {
  const s = Number(sec) || 0;
  const r = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d);
  if (s < 60) return `${r(s)} s`;
  if (s < 3600) return `${r(s / 60)} min`;
  return `${r(s / 3600)} h`;
};

const lista = (nombres) => {
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
};

/**
 * Devuelve párrafos de texto llano describiendo el proceso.
 * @returns {string[]} un párrafo por elemento; vacío si no hay nada que contar.
 */
export function resumenNarrativo({ proc, tasks = [], gateways = [], metricsData } = {}) {
  if (!proc) return [];
  const parrafos = [];

  // --- de qué va y entre qué límites -------------------------------------
  const nombre = proc.name || "Este proceso";
  const partes = [];
  if (proc.objective) partes.push(`existe para ${proc.objective.charAt(0).toLowerCase()}${proc.objective.slice(1).replace(/\.$/, "")}`);
  if (proc.trigger_event) partes.push(`arranca cuando ${proc.trigger_event.charAt(0).toLowerCase()}${proc.trigger_event.slice(1).replace(/\.$/, "")}`);
  if (proc.output_result) partes.push(`y termina con ${proc.output_result.charAt(0).toLowerCase()}${proc.output_result.slice(1).replace(/\.$/, "")}`);
  parrafos.push(partes.length
    ? `${nombre} ${partes.join(", ")}.`
    : `${nombre} todavía no tiene objetivo ni límites definidos: conviene rellenar el SIPOC del panel izquierdo para poder interpretarlo.`);

  if (proc.suppliers || proc.customers) {
    const quien = [];
    if (proc.suppliers) quien.push(`recibe lo que necesita de ${proc.suppliers}`);
    if (proc.customers) quien.push(`entrega su resultado a ${proc.customers}`);
    parrafos.push(`${quien.join(" y ")}.`.replace(/^./, (c) => c.toUpperCase()));
  }

  // --- cuántas etapas y de qué tipo ---------------------------------------
  if (tasks.length === 0) {
    parrafos.push("Aún no tiene pasos levantados, así que no se puede calcular nada sobre él.");
    return parrafos;
  }

  const decisiones = (gateways || []).filter((g) => String(g.node_type || "").startsWith("exclusive")).length;
  const paralelas = (gateways || []).length - decisiones;
  const trozos = [`Consta de ${tasks.length} ${tasks.length === 1 ? "paso" : "pasos"}`];
  if (decisiones) trozos.push(`${decisiones} ${decisiones === 1 ? "decisión" : "decisiones"}`);
  if (paralelas > 0) trozos.push(`${paralelas} ${paralelas === 1 ? "tramo que ocurre en paralelo" : "tramos que ocurren en paralelo"}`);
  parrafos.push(`${lista(trozos)}.`);

  // --- cuánto tarda -------------------------------------------------------
  if (metricsData) {
    const lead = Number(metricsData.lead_time_sec) || 0;
    const ciclo = Number(metricsData.total_cycle_time_sec) || 0;
    const espera = Number(metricsData.total_wait_time_sec) || 0;
    if (lead > 0) {
      let t = `De principio a fin tarda ${fmt(lead)}`;
      if (espera > 0) {
        const pct = Math.round((espera / lead) * 100);
        t += `, de los cuales ${fmt(ciclo)} son de trabajo real y ${fmt(espera)} de espera (${pct}% del total esperando)`;
      }
      parrafos.push(`${t}.`);
    }

    const pce = Number(metricsData.pce_percentage);
    if (!Number.isNaN(pce) && pce > 0) {
      parrafos.push(
        `Un ${Math.round(pce)}% de ese tiempo aporta valor al cliente. ` +
        (pce < 10
          ? "Es una cifra baja incluso para un proceso administrativo: casi todo el tiempo se va en esperas y trabajo que el cliente no percibe."
          : pce < 50
            ? "Está dentro de lo habitual en procesos administrativos, y deja margen claro de mejora."
            : "Es una cifra buena: la mayor parte del tiempo se dedica a lo que el cliente valora.")
      );
    }

    if (metricsData.constraint?.name) {
      const c = metricsData.constraint;
      let t = `El paso más lento es «${c.name}» (${fmt(c.cycle_time_sec)})`;
      if (c.theoretical_throughput_per_hour) {
        t += `, y es el que fija el ritmo: como mucho salen ${Math.round(c.theoretical_throughput_per_hour * 10) / 10} unidades por hora`;
      }
      parrafos.push(`${t}. Acelerar cualquier otro paso no aumenta la capacidad total.`);
    }
  }

  // --- dónde se pierde ----------------------------------------------------
  const nva = tasks.filter((t) => t.valueClass === "NVA");
  if (nva.length) {
    parrafos.push(
      `Hay ${nva.length} ${nva.length === 1 ? "paso marcado como desperdicio" : "pasos marcados como desperdicio"}: ` +
      `${lista(nva.map((t) => `«${t.name}»`))}. Son los primeros candidatos a revisar.`
    );
  }

  return parrafos;
}
