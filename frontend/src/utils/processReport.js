import { VALUE, TYPES } from "../constants.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmt = (sec) => {
  const s = Number(sec) || 0;
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`;
  return `${(s / 86400).toFixed(1)} d`;
};

const money = (v) => (v == null ? "—" : "$" + Number(v).toLocaleString("es-CL", { maximumFractionDigits: 0 }));

/**
 * Abre una ventana con el reporte documental del proceso, listo para
 * Imprimir / Guardar como PDF desde el navegador. Sin dependencias.
 */
export function openProcessReport({ proc, tasks = [], gateways = [], sequenceFlows = [], metricsData = null, macroName = "" }) {
  const win = window.open("", "_blank");
  if (!win) return false; // popup bloqueado

  const taskRows = tasks.map((t, i) => {
    const v = VALUE[t.valueClass] || {};
    return `<tr>
      <td class="mono">${String(i + 1).padStart(2, "0")}</td>
      <td>${esc(t.name)}</td>
      <td>${esc(TYPES[t.type]?.label || t.type || "—")}</td>
      <td><span class="chip" style="background:${v.color || "#EEF3F0"}">${esc(v.short || "—")}</span></td>
      <td>${esc(t.responsible || "—")}</td>
      <td class="mono">${fmt(t.cycleTime)}</td>
      <td class="mono">${fmt(t.waitTime)}</td>
    </tr>`;
  }).join("");

  const gwRows = gateways.map((g) => {
    const outs = sequenceFlows.filter((f) => f.source_ref === g.bpmn_id);
    const branches = outs.map((f) => {
      const label = f.condition_expression || f.condition || "(sin etiqueta)";
      const prob = f.branch_probability != null ? ` — ${Number(f.branch_probability)}%` : "";
      return `${esc(label)}${prob}`;
    }).join(" · ") || "—";
    return `<tr>
      <td>${esc(g.name || "Compuerta")}</td>
      <td>${g.node_type === "exclusiveGateway" ? "Exclusiva (X)" : "Paralela (+)"}</td>
      <td>${branches}</td>
    </tr>`;
  }).join("");

  const m = metricsData;
  const metricsHtml = m ? `
    <div class="metrics">
      <div><span>Lead time${m.is_branch_weighted ? " (esperado)" : ""}</span><b>${fmt(m.lead_time_sec)}</b></div>
      <div><span>Tiempo de ciclo</span><b>${fmt(m.total_cycle_time_sec)}</b></div>
      <div><span>Tiempo de espera</span><b>${fmt(m.total_wait_time_sec)}</b></div>
      <div><span>Eficiencia de ciclo (PCE)</span><b>${Math.round(m.pce_percentage || 0)}%</b></div>
      ${m.main_path_lead_time_sec != null ? `<div><span>Lead time camino principal</span><b>${fmt(m.main_path_lead_time_sec)}</b></div>` : ""}
      ${m.cost?.total_cost ? `<div><span>Costo por ejecución</span><b>${money(m.cost.total_cost)}</b></div>` : ""}
      ${m.cost?.monthly_cost != null ? `<div><span>Costo mensual</span><b>${money(m.cost.monthly_cost)}</b></div>` : ""}
      ${m.cost?.annual_cost != null ? `<div><span>Costo anual</span><b>${money(m.cost.annual_cost)}</b></div>` : ""}
    </div>
    <table class="mini">
      <tr><td>Tareas VA / NNVA / NVA</td><td class="mono">${m.structural?.va_count ?? 0} / ${m.structural?.nnva_count ?? 0} / ${m.structural?.nva_count ?? 0}</td></tr>
      <tr><td>Traspasos entre roles (handoffs)</td><td class="mono">${m.structural?.handoffs_count ?? 0}</td></tr>
      <tr><td>Saltos entre sistemas</td><td class="mono">${m.structural?.system_jumps ?? 0}</td></tr>
      <tr><td>Tasa de retrabajo</td><td class="mono">${Math.round(m.structural?.rework_rate_percentage ?? 0)}%</td></tr>
    </table>` : `<p class="muted">Sin métricas calculadas.</p>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>Reporte — ${esc(proc.name || "Proceso")}</title>
  <style>
    :root{color-scheme:light}
    body{font-family:"Segoe UI",system-ui,sans-serif;color:#15232E;margin:0;padding:32px;max-width:900px;margin-inline:auto;font-size:13px;line-height:1.5}
    h1{font-size:22px;margin:0 0 2px}
    h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#0B7E7E;border-bottom:2px solid #D7F0F0;padding-bottom:6px;margin:28px 0 12px}
    .mono{font-family:"Consolas","IBM Plex Mono",monospace}
    .muted{color:#5C6B6B}
    .tag{display:inline-block;background:#EEF3F0;border-radius:6px;padding:2px 8px;font-size:11px;margin-left:8px;vertical-align:middle}
    .chip{display:inline-block;color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:1px 8px}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5C6B6B;border-bottom:1.5px solid #E2E7E3;padding:6px 8px}
    td{border-bottom:1px solid #EEF1EE;padding:7px 8px;vertical-align:top}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
    .metrics div{border:1px solid #E2E7E3;border-radius:10px;padding:9px 11px}
    .metrics span{display:block;font-size:10.5px;color:#5C6B6B}
    .metrics b{font-size:16px;font-family:"Consolas",monospace}
    .mini td:first-child{color:#5C6B6B}
    .head-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-top:12px}
    .head-grid span{display:block;font-size:10.5px;color:#5C6B6B;text-transform:uppercase;letter-spacing:.04em}
    .toolbar{position:fixed;top:12px;right:12px}
    .toolbar button{background:#0E9F9F;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer}
    footer{margin-top:36px;font-size:11px;color:#5C6B6B;border-top:1px solid #E2E7E3;padding-top:10px}
    @media print{.toolbar{display:none}body{padding:0}}
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <h1>${esc(proc.name || "Proceso")}<span class="tag mono">${esc(proc.code || "")}</span></h1>
  <div class="muted">${esc(macroName || "General")} · Generado el ${new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}</div>
  <div class="head-grid">
    <div><span>Objetivo</span>${esc(proc.objective || "—")}</div>
    <div><span>Volumen mensual</span>${proc.monthly_volume != null && proc.monthly_volume !== "" ? esc(proc.monthly_volume) + " ejecuciones/mes" : "—"}</div>
    <div><span>Evento de inicio</span>${esc(proc.trigger_event || "—")}</div>
    <div><span>Resultado final</span>${esc(proc.output_result || "—")}</div>
  </div>
  <h2>Métricas Lean</h2>
  ${metricsHtml}
  <h2>Tareas (${tasks.length})</h2>
  ${tasks.length ? `<table><tr><th>#</th><th>Tarea</th><th>Tipo</th><th>Valor</th><th>Responsable</th><th>Ciclo</th><th>Espera</th></tr>${taskRows}</table>` : `<p class="muted">Sin tareas mapeadas.</p>`}
  <h2>Compuertas de decisión (${gateways.length})</h2>
  ${gateways.length ? `<table><tr><th>Decisión</th><th>Tipo</th><th>Ramas (etiqueta — probabilidad)</th></tr>${gwRows}</table>` : `<p class="muted">Este proceso no tiene compuertas.</p>`}
  <footer>Documento generado por AiProces — mapa de procesos Lean/BPMN.</footer>
  </body></html>`;

  win.document.write(html);
  win.document.close();
  return true;
}
