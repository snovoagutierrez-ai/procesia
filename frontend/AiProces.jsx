import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Download, Sparkles, Loader2,
  AlertTriangle, User, Wrench, PenLine, Gauge, X, ArrowRight, Lightbulb,
  ArrowLeft, FolderOpen, FileText, Copy, Clock,
} from "lucide-react";

/* ============================================================================
   AiProces — levantamiento, optimización con IA y exportación BPMN 2.0
   Frontend integrado con FastAPI + PostgreSQL
   ============================================================================ */

const API = import.meta.env.VITE_API_URL;

const VALUE = {
  VA:   { label: "Valor agregado",     short: "VA",   color: "#1FA463", bg: "#E8F5E9" },
  NNVA: { label: "Necesario sin valor", short: "NNVA", color: "#C98A12", bg: "#FFF8E1" },
  NVA:  { label: "Desperdicio",         short: "NVA",  color: "#D9503C", bg: "#FFEBEE" },
};

const WASTE = {
  defects: "Defectos / reproceso",
  overproduction: "Sobreproducción",
  waiting: "Espera",
  non_utilized_talent: "Talento desaprovechado",
  transportation: "Transporte",
  inventory: "Inventario",
  motion: "Movimiento",
  excess_processing: "Sobreprocesamiento",
};

const TYPES = {
  user:    { label: "Persona",  Icon: User,    bpmn: "userTask" },
  manual:  { label: "Manual",   Icon: PenLine, bpmn: "manualTask" },
  service: { label: "Sistema",  Icon: Wrench,  bpmn: "serviceTask" },
};

const ACTION = {
  ELIMINATE:   { label: "Eliminar",     color: "#D9503C" },
  AUTOMATE:    { label: "Automatizar",  color: "#0E9F9F" },
  SIMPLIFY:    { label: "Simplificar",  color: "#0E9F9F" },
  MERGE:       { label: "Fusionar",     color: "#0E9F9F" },
  PARALLELIZE: { label: "Paralelizar",  color: "#7A5AF8" },
  REASSIGN:    { label: "Reasignar",    color: "#C98A12" },
  STANDARDIZE: { label: "Estandarizar", color: "#3B7DD8" },
};

const SEVERITY = {
  low:      { label: "Baja",     color: "#5C6B6B" },
  medium:   { label: "Media",    color: "#C98A12" },
  high:     { label: "Alta",     color: "#D9503C" },
  critical: { label: "Crítica",  color: "#A4271A" },
};

const SAMPLE = {
  proc: {
    name: "Alta de cliente nuevo",
    code: "OP-CLI-001",
    objective: "Dar de alta y activar la cuenta de un cliente desde la solicitud.",
    trigger: "Solicitud recibida",
    output: "Cuenta activada",
  },
  tasks: [
    { bpmnId: "Task_01", name: "Recepción de solicitud", type: "user", cycleTime: 300, waitTime: 0, valueClass: "VA", wasteType: "", responsible: "Atención al cliente", accountable: "Líder de atención", consulted: "", informed: "", systems: "CRM" },
    { bpmnId: "Task_02", name: "Espera de validación de crédito", type: "user", cycleTime: 120, waitTime: 7200, valueClass: "NVA", wasteType: "waiting", responsible: "Analista de riesgo", accountable: "Jefe de riesgo", consulted: "", informed: "", systems: "Core bancario" },
    { bpmnId: "Task_03", name: "Captura manual de datos en ERP", type: "manual", cycleTime: 900, waitTime: 0, valueClass: "NNVA", wasteType: "", responsible: "Back office", accountable: "Back office", consulted: "", informed: "", systems: "ERP" },
    { bpmnId: "Task_04", name: "Revisión documental", type: "user", cycleTime: 600, waitTime: 1800, valueClass: "NNVA", wasteType: "", responsible: "Cumplimiento", accountable: "Cumplimiento", consulted: "Legal", informed: "", systems: "Gestor documental" },
    { bpmnId: "Task_05", name: "Reproceso por datos incompletos", type: "manual", cycleTime: 700, waitTime: 0, valueClass: "NVA", wasteType: "defects", responsible: "Back office", accountable: "Back office", consulted: "", informed: "", systems: "ERP, CRM" },
    { bpmnId: "Task_06", name: "Activación de cuenta", type: "service", cycleTime: 60, waitTime: 0, valueClass: "VA", wasteType: "", responsible: "Sistema", accountable: "TI", consulted: "", informed: "Atención al cliente", systems: "Core bancario" },
  ],
};

/* ---------- helpers ---------- */
const newBpmnId = () => "Task_" + Math.random().toString(36).slice(2, 6);

function fmtShort(sec) {
  sec = Number(sec) || 0;
  if (sec === 0) return "0";
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.round(sec / 60) + "m";
  return (sec / 3600).toFixed(1).replace(/\.0$/, "") + "h";
}
function fmtLong(sec) {
  sec = Number(sec) || 0;
  if (sec < 60) return sec + " s";
  if (sec < 3600) return (sec / 60).toFixed(sec % 60 ? 1 : 0) + " min";
  return (sec / 3600).toFixed(1) + " h";
}

function mapBackendTaskToFrontend(t) {
  return {
    id: t.id, bpmnId: t.bpmn_id, name: t.name, type: t.task_type,
    cycleTime: Number(t.std_cycle_time_sec) || 0,
    waitTime: Number(t.std_wait_time_sec) || 0,
    valueClass: t.value_classification, wasteType: t.waste_type || "",
    responsible: t.responsible || "", accountable: t.accountable || "",
    consulted: t.consulted || "", informed: t.informed || "",
    systems: t.systems || "", position_order: t.position_order,
  };
}

function mapBackendProcessToFrontend(p) {
  return { ...p, trigger: p.trigger_event || "", output: p.output_result || "" };
}

/* ============================================================================
   ReactFlow Custom Nodes
   ============================================================================ */

function StartNode({ data }) {
  return (
    <div className="rf-start-node">
      <div className="rf-start-circle">
        <div className="rf-start-inner" />
      </div>
      <div className="rf-event-label">{data.label}</div>
      <Handle type="source" position={Position.Right} className="rf-handle" />
    </div>
  );
}

function EndNode({ data }) {
  return (
    <div className="rf-end-node">
      <div className="rf-end-circle">
        <div className="rf-end-inner" />
      </div>
      <div className="rf-event-label">{data.label}</div>
      <Handle type="target" position={Position.Left} className="rf-handle" />
    </div>
  );
}

function TaskNode({ data }) {
  const v = VALUE[data.valueClass] || VALUE.VA;
  const TypeIcon = TYPES[data.taskType]?.Icon || User;
  return (
    <div
      className={`rf-task-node ${data.selected ? "selected" : ""}`}
      style={{ borderLeftColor: v.color }}
      onClick={() => data.onSelect && data.onSelect(data.taskId)}
    >
      <Handle type="target" position={Position.Left} className="rf-handle" />
      <div className="rf-task-header">
        <span className="rf-task-name">{data.label}</span>
      </div>
      <div className="rf-task-meta">
        <TypeIcon size={12} />
        <span>{TYPES[data.taskType]?.label || data.taskType}</span>
        <span className="rf-task-badge" style={{ background: v.color }}>{v.short}</span>
      </div>
      <div className="rf-task-times">
        <Clock size={10} />
        <span>ciclo {fmtShort(data.cycleTime)}</span>
        {data.waitTime > 0 && <span>· espera {fmtShort(data.waitTime)}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="rf-handle" />
    </div>
  );
}

const nodeTypes = { startNode: StartNode, endNode: EndNode, taskNode: TaskNode };

/* ---------- Dagre layout ---------- */
function getLayoutedElements(rfNodes, rfEdges, direction = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 30, marginy: 30 });

  rfNodes.forEach((node) => {
    const w = node.type === "taskNode" ? 200 : 60;
    const h = node.type === "taskNode" ? 90 : 60;
    g.setNode(node.id, { width: w, height: h });
  });
  rfEdges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);

  const layouted = rfNodes.map((node) => {
    const pos = g.node(node.id);
    const w = node.type === "taskNode" ? 200 : 60;
    const h = node.type === "taskNode" ? 90 : 60;
    return { ...node, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
  });
  return { nodes: layouted, edges: rfEdges };
}

/* ---------- Build ReactFlow data from tasks ---------- */
function buildFlowData(proc, tasks, selectedId, onSelect) {
  const rfNodes = [];
  const rfEdges = [];

  // Start event
  rfNodes.push({
    id: "start",
    type: "startNode",
    data: { label: proc.trigger || "Inicio" },
    position: { x: 0, y: 0 },
  });

  // Task nodes
  tasks.forEach((t) => {
    rfNodes.push({
      id: `task-${t.id}`,
      type: "taskNode",
      data: {
        label: t.name,
        taskId: t.id,
        taskType: t.type,
        valueClass: t.valueClass,
        cycleTime: t.cycleTime,
        waitTime: t.waitTime,
        selected: t.id === selectedId,
        onSelect,
      },
      position: { x: 0, y: 0 },
    });
  });

  // End event
  rfNodes.push({
    id: "end",
    type: "endNode",
    data: { label: proc.output || "Fin" },
    position: { x: 0, y: 0 },
  });

  // Linear edges
  const allIds = ["start", ...tasks.map((t) => `task-${t.id}`), "end"];
  for (let i = 0; i < allIds.length - 1; i++) {
    rfEdges.push({
      id: `edge-${i}`,
      source: allIds[i],
      target: allIds[i + 1],
      type: "smoothstep",
      animated: false,
      style: { stroke: "#9AA8A8", strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#9AA8A8", width: 16, height: 16 },
    });
  }

  return getLayoutedElements(rfNodes, rfEdges);
}

/* ============================================================================
   ReactFlow Diagram Component
   ============================================================================ */

function FlowDiagram({ proc, tasks, selectedId, onSelect }) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildFlowData(proc, tasks, selectedId, onSelect),
    [proc, tasks, selectedId, onSelect]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  return (
    <div style={{ height: 280, width: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#E7ECE8" gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "startNode") return "#0E9F9F";
            if (node.type === "endNode") return "#15232E";
            const vc = node.data?.valueClass;
            return VALUE[vc]?.color || "#ccc";
          }}
          maskColor="rgba(245,247,245,0.7)"
          style={{ background: "#fff", border: "1px solid #E2E7E3", borderRadius: 8 }}
        />
      </ReactFlow>
    </div>
  );
}

/* ============================================================================
   Small UI atoms
   ============================================================================ */

const Field = ({ label, children }) => (
  <label className="pa-field"><span className="pa-label">{label}</span>{children}</label>
);
const Seg = ({ value, options, onChange }) => (
  <div className="pa-seg">
    {options.map((o) => (
      <button key={o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}
        style={value === o.value && o.color ? { background: o.color, borderColor: o.color, color: "#fff" } : undefined}>
        {o.label}
      </button>
    ))}
  </div>
);

/* ============================================================================
   Step Editor
   ============================================================================ */

function Editor({ task, onChange, onMove, onDelete, isFirst, isLast }) {
  if (!task)
    return <div className="pa-empty">Selecciona un paso en el diagrama o en la lista para ver y editar sus datos.</div>;
  const set = (patch) => onChange(task.id, patch);
  return (
    <div className="pa-editor">
      <div className="pa-editor-head">
        <span className="pa-tag" style={{ fontFamily: "var(--mono)" }}>{task.bpmnId}</span>
        <div className="pa-editor-actions">
          <button className="pa-icon" disabled={isFirst} onClick={() => onMove(task.id, -1)} title="Subir"><ChevronUp size={16} /></button>
          <button className="pa-icon" disabled={isLast} onClick={() => onMove(task.id, 1)} title="Bajar"><ChevronDown size={16} /></button>
          <button className="pa-icon danger" onClick={() => onDelete(task.id)} title="Eliminar"><Trash2 size={16} /></button>
        </div>
      </div>

      <Field label="Nombre de la tarea">
        <input className="pa-input" value={task.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>

      <div className="pa-row">
        <Field label="Tipo">
          <Seg value={task.type} onChange={(v) => set({ type: v })}
            options={Object.entries(TYPES).map(([k, m]) => ({ value: k, label: m.label }))} />
        </Field>
      </div>

      <div className="pa-row two">
        <Field label="Tiempo de ciclo (s)">
          <input className="pa-input" type="number" min="0" value={task.cycleTime} onChange={(e) => set({ cycleTime: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Tiempo de espera (s)">
          <input className="pa-input" type="number" min="0" value={task.waitTime} onChange={(e) => set({ waitTime: Number(e.target.value) || 0 })} />
        </Field>
      </div>

      <Field label="Clasificación de valor">
        <Seg value={task.valueClass} onChange={(v) => set({ valueClass: v, wasteType: v === "NVA" ? task.wasteType || "waiting" : "" })}
          options={Object.entries(VALUE).map(([k, m]) => ({ value: k, label: m.short, color: m.color }))} />
      </Field>

      {task.valueClass === "NVA" && (
        <Field label="Tipo de desperdicio (Lean)">
          <select className="pa-input" value={task.wasteType || "waiting"} onChange={(e) => set({ wasteType: e.target.value })}>
            {Object.entries(WASTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      )}

      <div className="pa-divider"><span>RACI</span></div>
      <div className="pa-row two">
        <Field label="Responsable (R)"><input className="pa-input" value={task.responsible} onChange={(e) => set({ responsible: e.target.value })} /></Field>
        <Field label="Aprobador (A)"><input className="pa-input" value={task.accountable} onChange={(e) => set({ accountable: e.target.value })} /></Field>
      </div>
      <div className="pa-row two">
        <Field label="Consultado (C)"><input className="pa-input" value={task.consulted} onChange={(e) => set({ consulted: e.target.value })} /></Field>
        <Field label="Informado (I)"><input className="pa-input" value={task.informed} onChange={(e) => set({ informed: e.target.value })} /></Field>
      </div>

      <Field label="Sistemas involucrados">
        <input className="pa-input" value={task.systems} onChange={(e) => set({ systems: e.target.value })} placeholder="ERP, CRM…" />
      </Field>
    </div>
  );
}

/* ============================================================================
   Optimization panel
   ============================================================================ */

function Optimization({ state, onRun, onApply }) {
  const d = state.data;
  return (
    <div className="pa-opt">
      <div className="pa-opt-head">
        <div>
          <h3>Optimización con IA</h3>
          <p>El motor analiza tiempos, RACI, sistemas y valor para detectar cuellos de botella y desperdicios.</p>
        </div>
        <button className="pa-btn pa-btn-primary" onClick={onRun} disabled={state.status === "loading"}>
          {state.status === "loading" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          {state.status === "loading" ? "Analizando…" : "Optimizar proceso"}
        </button>
      </div>

      {state.status === "error" && (
        <div className="pa-alert">
          <AlertTriangle size={16} />
          <div>
            <strong>No se pudo completar el análisis.</strong> {state.error}
            <div className="pa-alert-sub">Este paso llama a la API de Gemini desde el backend.</div>
          </div>
        </div>
      )}

      {state.status === "idle" && (
        <div className="pa-empty">Pulsa <b>Optimizar proceso</b> para recibir hallazgos y recomendaciones.</div>
      )}

      {state.status === "done" && d && (
        <div className="pa-opt-body">
          {d.summary && (
            <div className="pa-opt-summary">
              <div><span>Eficiencia (VA)</span><b>{Math.round((d.summary.value_added_ratio || 0) * 100)}%</b></div>
              <div><span>Pasos NVA</span><b>{d.summary.nva_task_count ?? "—"}</b></div>
              <div><span>Confianza</span><b>{Math.round((d.analysis_confidence || 0) * 100)}%</b></div>
            </div>
          )}

          {!!(d.bottlenecks || []).length && (
            <section>
              <h4>Cuellos de botella</h4>
              {d.bottlenecks.map((b, i) => {
                const sv = SEVERITY[b.severity] || SEVERITY.medium;
                return (
                  <div key={i} className="pa-card">
                    <div className="pa-card-top">
                      <strong>{b.node_name || b.node_bpmn_id}</strong>
                      <span className="pa-badge" style={{ background: sv.color }}>{sv.label}</span>
                    </div>
                    <p>{b.impact_description || b.impact}</p>
                    <div className="pa-meta">
                      {b.metric === "wait_time" ? "Espera" : "Ciclo"}: <b>{fmtLong(b.value_sec)}</b>
                      {b.deviation_factor ? <> · <b>{Number(b.deviation_factor).toFixed(1)}×</b> sobre la media</> : null}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!!(d.inefficiencies || []).length && (
            <section>
              <h4>Desperdicios</h4>
              {d.inefficiencies.map((it, i) => (
                <div key={i} className="pa-card">
                  <div className="pa-card-top">
                    <strong>{WASTE[it.waste_type] || it.waste_type}</strong>
                    <span className="pa-badge" style={{ background: VALUE.NVA.color }}>NVA</span>
                  </div>
                  <p>{it.description}</p>
                  {it.root_cause && <div className="pa-meta">Causa raíz: {it.root_cause}</div>}
                </div>
              ))}
            </section>
          )}

          {!!(d.recommendations || []).length && (
            <section>
              <h4>Recomendaciones</h4>
              {[...d.recommendations].sort((a, b) => (a.priority || 9) - (b.priority || 9)).map((r, i) => {
                const ac = ACTION[r.action_type] || { label: r.action_type, color: "#0E9F9F" };
                return (
                  <div key={i} className="pa-card">
                    <div className="pa-card-top">
                      <span className="pa-chip" style={{ borderColor: ac.color, color: ac.color }}>{ac.label}</span>
                      {r.estimated_time_saving_pct ? <span className="pa-save">↓{Math.round(r.estimated_time_saving_pct)}% tiempo</span> : null}
                    </div>
                    <p>{r.description}</p>
                    <div className="pa-meta">Complejidad: {r.implementation_complexity || "—"}</div>
                  </div>
                );
              })}
            </section>
          )}

          {d.optimized_flow?.applies && !!(d.optimized_flow.nodes || d.optimized_flow.steps || []).length && (
            <button className="pa-btn pa-btn-ghost full" onClick={() => onApply(d.optimized_flow.nodes || d.optimized_flow.steps)}>
              <ArrowRight size={16} /> Aplicar flujo optimizado al diagrama
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Logo
   ============================================================================ */

function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AiProces">
      <rect width="32" height="32" rx="8" fill="#1E293B" />
      <path d="M11 22V10H17C19.2091 10 21 11.7909 21 14C21 16.2091 19.2091 18 17 18H11" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="14" r="2.5" fill="#38BDF8" />
    </svg>
  );
}

/* ============================================================================
   Dashboard (multi-process selector)
   ============================================================================ */

function Dashboard({ processes, onSelect, onCreate, onDelete }) {
  return (
    <div className="pa-dashboard">
      <div className="pa-dash-header">
        <div>
          <h2>Mis procesos</h2>
          <p>Selecciona un proceso para editarlo o crea uno nuevo.</p>
        </div>
        <button className="pa-btn pa-btn-primary" onClick={onCreate}>
          <Plus size={16} /> Nuevo proceso
        </button>
      </div>
      {processes.length === 0 ? (
        <div className="pa-empty" style={{ textAlign: "center", padding: 40 }}>
          <FolderOpen size={40} style={{ color: "#9AA8A8", marginBottom: 12 }} />
          <div>No hay procesos aún. Pulsa <b>Nuevo proceso</b> para comenzar.</div>
        </div>
      ) : (
        <div className="pa-dash-grid">
          {processes.map((p) => (
            <div key={p.id} className="pa-dash-card" onClick={() => onSelect(p)}>
              <div className="pa-dash-card-head">
                <FileText size={18} style={{ color: "#0E9F9F" }} />
                <span className="pa-dash-code">{p.code}</span>
                <button className="pa-icon danger small" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} title="Eliminar proceso">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="pa-dash-card-name">{p.name}</div>
              {p.objective && <div className="pa-dash-card-obj">{p.objective}</div>}
              <div className="pa-dash-card-foot">
                <span>{p.trigger_event || p.trigger || "—"}</span>
                <ArrowRight size={12} />
                <span>{p.output_result || p.output || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Main App
   ============================================================================ */

export default function App() {
  // Views: "dashboard" | "editor"
  const [view, setView] = useState("dashboard");
  const [allProcesses, setAllProcesses] = useState([]);
  const [proc, setProc] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("detalle");
  const [opt, setOpt] = useState({ status: "idle" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const debounceTimeoutRef = useRef(null);
  const updateTaskTimeoutRefs = useRef({});

  // Load fonts
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch (e) {} };
  }, []);

  // Load all processes on mount
  useEffect(() => { loadProcesses(); }, []);

  const loadProcesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/processes`);
      if (!res.ok) throw new Error("No se pudo conectar al backend.");
      const data = await res.json();
      setAllProcesses(data.map(mapBackendProcessToFrontend));
    } catch (e) {
      setError("No se pudo conectar al backend. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  };

  const loadProcessTasks = async (process) => {
    setLoading(true);
    try {
      const resTasks = await fetch(`${API}/processes/${process.id}/tasks`);
      const dbTasks = await resTasks.json();
      const mapped = dbTasks.map(mapBackendTaskToFrontend);
      setTasks(mapped);
      setSelectedId(mapped[0]?.id || null);
      setOpt({ status: "idle" });
    } catch (e) {
      setError("Error al cargar tareas del proceso.");
    } finally {
      setLoading(false);
    }
  };

  const selectProcess = (p) => {
    setProc(p);
    setView("editor");
    setTab("detalle");
    loadProcessTasks(p);
  };

  const createNewProcess = async () => {
    try {
      // Ensure a macroprocess exists
      let macroRes = await fetch(`${API}/macroprocesses`);
      let macros = await macroRes.json();
      let macroId;
      if (macros.length > 0) {
        macroId = macros[0].id;
      } else {
        const newMacro = await fetch(`${API}/macroprocesses`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "MAC-01", name: "Macroproceso General", owner_area: "Operaciones" }),
        });
        const m = await newMacro.json();
        macroId = m.id;
      }

      const code = "PROC-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const resProc = await fetch(`${API}/processes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroprocess_id: macroId, code, name: "Nuevo proceso",
          objective: "", trigger_event: "Inicio", output_result: "Fin",
        }),
      });
      const newProc = await resProc.json();
      const mapped = mapBackendProcessToFrontend(newProc);
      setAllProcesses((prev) => [...prev, mapped]);
      selectProcess(mapped);
    } catch (e) {
      setError("Error al crear el proceso.");
    }
  };

  const deleteProcess = async (id) => {
    if (!confirm("¿Eliminar este proceso y todas sus tareas?")) return;
    try {
      await fetch(`${API}/processes/${id}`, { method: "DELETE" });
      setAllProcesses((prev) => prev.filter((p) => p.id !== id));
      if (proc?.id === id) { setProc(null); setView("dashboard"); }
    } catch (e) {
      setError("Error al eliminar el proceso.");
    }
  };

  const goBackToDashboard = () => {
    setView("dashboard");
    setProc(null);
    setTasks([]);
    setSelectedId(null);
    setOpt({ status: "idle" });
    loadProcesses();
  };

  const selected = tasks.find((t) => t.id === selectedId) || null;

  const saveProcessDebounced = (updatedProc) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API}/processes/${updatedProc.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            macroprocess_id: updatedProc.macroprocess_id, code: updatedProc.code,
            name: updatedProc.name, objective: updatedProc.objective,
            trigger_event: updatedProc.trigger_event || updatedProc.trigger,
            output_result: updatedProc.output_result || updatedProc.output,
          }),
        });
      } catch (e) { /* silent */ }
    }, 800);
  };

  const setProcField = (k, v) => {
    let backendKey = k;
    if (k === "trigger") backendKey = "trigger_event";
    if (k === "output") backendKey = "output_result";
    setProc((p) => {
      const next = { ...p, [k]: v, [backendKey]: v };
      saveProcessDebounced(next);
      return next;
    });
  };

  const updateTask = (id, patch) => {
    setTasks((ts) => {
      const updatedTasks = ts.map((t) => (t.id === id ? { ...t, ...patch } : t));
      if (updateTaskTimeoutRefs.current[id]) clearTimeout(updateTaskTimeoutRefs.current[id]);
      updateTaskTimeoutRefs.current[id] = setTimeout(async () => {
        const t = updatedTasks.find((x) => x.id === id);
        if (!t) return;
        try {
          await fetch(`${API}/processes/${proc.id}/tasks/${id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bpmn_id: t.bpmnId, name: t.name, description: t.description || "",
              position_order: t.position_order || 1, task_type: t.type,
              value_classification: t.valueClass, waste_type: t.wasteType || null,
              std_cycle_time_sec: Number(t.cycleTime) || 0, std_wait_time_sec: Number(t.waitTime) || 0,
              responsible: t.responsible, accountable: t.accountable,
              consulted: t.consulted, informed: t.informed, systems: t.systems,
            }),
          });
        } catch (e) { /* silent */ }
      }, 500);
      return updatedTasks;
    });
  };

  const addTask = async () => {
    if (!proc) return;
    try {
      const res = await fetch(`${API}/processes/${proc.id}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bpmn_id: newBpmnId(), name: "Nueva tarea", description: "",
          position_order: tasks.length + 1, task_type: "user",
          value_classification: "VA", waste_type: null,
          std_cycle_time_sec: 60, std_wait_time_sec: 0,
          responsible: "", accountable: "", consulted: "", informed: "", systems: "",
        }),
      });
      const data = await res.json();
      const mapped = mapBackendTaskToFrontend(data);
      setTasks((ts) => [...ts, mapped]);
      setSelectedId(mapped.id);
      setTab("detalle");
    } catch (e) {
      setError("Error al añadir tarea.");
    }
  };

  const deleteTask = async (id) => {
    if (!proc) return;
    try {
      await fetch(`${API}/processes/${proc.id}/tasks/${id}`, { method: "DELETE" });
      setTasks((ts) => {
        const r = ts.filter((t) => t.id !== id);
        if (id === selectedId) setSelectedId(r[0]?.id || null);
        return r;
      });
    } catch (e) {
      setError("Error al eliminar tarea.");
    }
  };

  const moveTask = async (id, dir) => {
    if (!proc) return;
    const i = tasks.findIndex((t) => t.id === id);
    const j = i + dir;
    if (j < 0 || j >= tasks.length) return;
    const updatedTasks = [...tasks];
    [updatedTasks[i], updatedTasks[j]] = [updatedTasks[j], updatedTasks[i]];
    updatedTasks.forEach((t, idx) => { t.position_order = idx + 1; });
    setTasks(updatedTasks);
    try {
      await Promise.all(
        [updatedTasks[i], updatedTasks[j]].map((task) =>
          fetch(`${API}/processes/${proc.id}/tasks/${task.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              position_order: task.position_order, bpmn_id: task.bpmnId, name: task.name,
              task_type: task.type, value_classification: task.valueClass,
              waste_type: task.wasteType || null, std_cycle_time_sec: Number(task.cycleTime) || 0,
              std_wait_time_sec: Number(task.waitTime) || 0, responsible: task.responsible,
              accountable: task.accountable, consulted: task.consulted, informed: task.informed,
              systems: task.systems,
            }),
          })
        )
      );
    } catch (e) { /* silent */ }
  };

  const applyOptimized = async (steps) => {
    if (!proc) return;
    setLoading(true);
    try {
      await Promise.all(tasks.map((t) => fetch(`${API}/processes/${proc.id}/tasks/${t.id}`, { method: "DELETE" })));
      const mapped = [];
      for (let idx = 0; idx < steps.length; idx++) {
        const s = steps[idx];
        const valClass = s.value_classification || s.valueClass || "VA";
        const wType = valClass === "NVA" ? s.waste_type || "waiting" : null;
        const res = await fetch(`${API}/processes/${proc.id}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bpmn_id: s.bpmn_id || s.bpmnId || newBpmnId(), name: s.name || s.node_name || "Paso",
            description: "", position_order: idx + 1,
            task_type: s.type && TYPES[s.type] ? s.type : "user",
            value_classification: valClass, waste_type: wType,
            std_cycle_time_sec: Number(s.cycle_time_sec) || Number(s.cycleTime) || 60,
            std_wait_time_sec: Number(s.wait_time_sec) || Number(s.waitTime) || 0,
            responsible: "", accountable: "", consulted: "", informed: "", systems: "",
          }),
        });
        const data = await res.json();
        mapped.push(mapBackendTaskToFrontend(data));
      }
      setTasks(mapped);
      setSelectedId(mapped[0]?.id || null);
      setTab("detalle");
    } catch (e) {
      alert("No se pudo aplicar el flujo optimizado por completo.");
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    const tc = tasks.reduce((a, t) => a + (Number(t.cycleTime) || 0), 0);
    const tw = tasks.reduce((a, t) => a + (Number(t.waitTime) || 0), 0);
    const lead = tc + tw;
    const va = tasks.filter((t) => t.valueClass === "VA").reduce((a, t) => a + (Number(t.cycleTime) || 0), 0);
    return { tc, tw, lead, ratio: lead ? va / lead : 0, nva: tasks.filter((t) => t.valueClass === "NVA").length };
  }, [tasks]);

  async function runOptimize() {
    if (!proc) return;
    setOpt({ status: "loading" });
    setTab("optim");
    try {
      const res = await fetch(`${API}/processes/${proc.id}/optimize`, { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail?.message || errorData.detail || "Error en el motor de optimización.");
      }
      const data = await res.json();
      setOpt({ status: "done", data });
    } catch (e) {
      setOpt({ status: "error", error: e.message || "Error de conexión." });
    }
  }

  async function exportBpmn() {
    if (!proc) return;
    try {
      const res = await fetch(`${API}/processes/${proc.id}/bpmn`);
      if (!res.ok) throw new Error("No se pudo compilar el archivo BPMN en el servidor.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (proc.code || "proceso") + ".bpmn";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al exportar BPMN: " + e.message);
    }
  }

  async function exportMermaid() {
    if (!proc) return;
    try {
      const res = await fetch(`${API}/processes/${proc.id}/mermaid`);
      if (!res.ok) throw new Error("No se pudo generar la sintaxis Mermaid.");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (proc.code || "proceso") + ".mmd";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al exportar Mermaid: " + e.message);
    }
  }

  const onNodeSelect = useCallback((taskId) => {
    setSelectedId(taskId);
    setTab("detalle");
  }, []);

  // Loading screen
  if (loading && !proc && allProcesses.length === 0) {
    return (
      <div className="pa-loading-screen" style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#13202B", color: "#EAF1EF", fontFamily: "sans-serif",
      }}>
        <Loader2 size={40} className="spin" style={{ color: "#0E9F9F", marginBottom: "16px" }} />
        <div>Iniciando y conectando con el backend...</div>
      </div>
    );
  }

  // Error screen
  if (error && !proc && allProcesses.length === 0) {
    return (
      <div className="pa-loading-screen" style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#13202B", color: "#EAF1EF", fontFamily: "sans-serif", gap: 16,
      }}>
        <AlertTriangle size={40} style={{ color: "#D9503C" }} />
        <div style={{ maxWidth: 400, textAlign: "center" }}>{error}</div>
        <button className="pa-btn pa-btn-primary" onClick={loadProcesses}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="pa-root">
      <style>{CSS}</style>

      <header className="pa-topbar">
        <div className="pa-brand">
          <Logo size={36} />
          <div>
            <div className="pa-brand-name">AiProces</div>
            <div className="pa-brand-tag">Levanta · Optimiza · Exporta</div>
          </div>
        </div>
        <div className="pa-topbar-actions">
          {view === "editor" && (
            <>
              <button className="pa-btn pa-btn-ghost" onClick={goBackToDashboard}>
                <ArrowLeft size={16} /> Procesos
              </button>
              <button className="pa-btn pa-btn-ghost" onClick={exportMermaid}>
                <Download size={16} /> .mermaid
              </button>
              <button className="pa-btn pa-btn-ghost" onClick={exportBpmn}>
                <Download size={16} /> .bpmn
              </button>
              <button className="pa-btn pa-btn-primary" onClick={runOptimize} disabled={opt.status === "loading"}>
                {opt.status === "loading" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Optimizar con IA
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="pa-global-error">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {view === "dashboard" ? (
        <Dashboard
          processes={allProcesses}
          onSelect={selectProcess}
          onCreate={createNewProcess}
          onDelete={deleteProcess}
        />
      ) : proc ? (
        <div className="pa-shell">
          <aside className="pa-side">
            <div className="pa-side-sec">
              <div className="pa-side-title">Proceso</div>
              <input className="pa-input ink" value={proc.name || ""} onChange={(e) => setProcField("name", e.target.value)} placeholder="Nombre del proceso" />
              <input className="pa-input ink mono" value={proc.code || ""} onChange={(e) => setProcField("code", e.target.value)} placeholder="Código" />
              <textarea className="pa-input ink" rows={2} value={proc.objective || ""} onChange={(e) => setProcField("objective", e.target.value)} placeholder="Objetivo" />
            </div>

            <div className="pa-side-sec grow">
              <div className="pa-side-title">Tareas <span className="pa-count">{tasks.length}</span></div>
              <div className="pa-steplist">
                {tasks.map((t, i) => (
                  <button key={t.id} className={"pa-step" + (t.id === selectedId ? " sel" : "")} onClick={() => { setSelectedId(t.id); setTab("detalle"); }}>
                    <span className="pa-step-bar" style={{ background: VALUE[t.valueClass]?.color || "#EEF3F0" }} />
                    <span className="pa-step-n mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="pa-step-name">{t.name}</span>
                    <span className="pa-step-t mono">{fmtShort((Number(t.cycleTime) || 0) + (Number(t.waitTime) || 0))}</span>
                  </button>
                ))}
              </div>
              <button className="pa-btn pa-btn-ghost full" onClick={addTask}><Plus size={16} /> Añadir tarea</button>
            </div>
          </aside>

          <main className="pa-main">
            <div className="pa-diagram-card">
              <div className="pa-diagram-head">
                <span>Flujo del proceso</span>
                <div className="pa-legend">
                  {Object.values(VALUE).map((v) => (
                    <span key={v.short}><i style={{ background: v.color }} />{v.label}</span>
                  ))}
                </div>
              </div>
              <FlowDiagram proc={proc} tasks={tasks} selectedId={selectedId} onSelect={onNodeSelect} />
            </div>

            <div className="pa-metrics">
              <div className="pa-metric"><span>Lead time</span><b className="mono">{fmtLong(metrics.lead)}</b></div>
              <div className="pa-metric"><span>Tiempo de ciclo</span><b className="mono">{fmtLong(metrics.tc)}</b></div>
              <div className="pa-metric"><span>Tiempo de espera</span><b className="mono">{fmtLong(metrics.tw)}</b></div>
              <div className="pa-metric"><span>Pasos NVA</span><b className="mono" style={{ color: metrics.nva ? VALUE.NVA.color : undefined }}>{metrics.nva}</b></div>
              <div className="pa-metric wide">
                <span>Eficiencia de ciclo (VA) <b className="mono">{Math.round(metrics.ratio * 100)}%</b></span>
                <div className="pa-effbar"><i style={{ width: Math.round(metrics.ratio * 100) + "%" }} /></div>
              </div>
            </div>

            <div className="pa-panel">
              <div className="pa-tabs">
                <button className={tab === "detalle" ? "on" : ""} onClick={() => setTab("detalle")}><Gauge size={15} /> Detalle del paso</button>
                <button className={tab === "optim" ? "on" : ""} onClick={() => setTab("optim")}><Lightbulb size={15} /> Optimización IA</button>
              </div>
              <div className="pa-panel-body">
                {tab === "detalle" ? (
                  <Editor task={selected} onChange={updateTask} onMove={moveTask} onDelete={deleteTask}
                    isFirst={selected ? tasks[0]?.id === selected.id : true}
                    isLast={selected ? tasks[tasks.length - 1]?.id === selected.id : true} />
                ) : (
                  <Optimization state={opt} onRun={runOptimize} onApply={applyOptimized} />
                )}
              </div>
            </div>
          </main>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================================
   Styles
   ============================================================================ */

const CSS = `
.pa-root{
  --ink:#13202B; --ink2:#1B2D3A; --paper:#F5F7F5; --card:#fff;
  --line:#E2E7E3; --line-ink:rgba(255,255,255,.09);
  --teal:#0E9F9F; --teal-deep:#0B7E7E;
  --text:#15232E; --muted:#5C6B6B; --inv:#EAF1EF; --inv-muted:#9DB0B0;
  --body:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
  --disp:'Space Grotesk','IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace;
  font-family:var(--body); color:var(--text); background:var(--paper);
  min-height:100vh; -webkit-font-smoothing:antialiased;
}
.pa-root *{box-sizing:border-box}
.mono{font-family:var(--mono)}
button{font-family:inherit}
.spin{animation:pa-spin 1s linear infinite}
@keyframes pa-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}

/* ---- topbar ---- */
.pa-topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;
  gap:16px;padding:12px 20px;background:var(--ink);border-bottom:1px solid var(--line-ink)}
.pa-brand{display:flex;align-items:center;gap:11px}
.pa-brand-name{font-family:var(--disp);font-weight:700;font-size:19px;color:var(--inv);letter-spacing:-.01em;line-height:1}
.pa-brand-tag{font-size:10.5px;color:var(--inv-muted);letter-spacing:.16em;text-transform:uppercase;margin-top:3px}
.pa-topbar-actions{display:flex;gap:9px;flex-wrap:wrap}

/* ---- buttons ---- */
.pa-btn{display:inline-flex;align-items:center;gap:7px;border-radius:9px;padding:9px 14px;font-size:13.5px;
  font-weight:600;cursor:pointer;border:1px solid transparent;transition:.15s;white-space:nowrap}
.pa-btn:disabled{opacity:.55;cursor:default}
.pa-btn-primary{background:var(--teal);color:#fff}
.pa-btn-primary:hover:not(:disabled){background:var(--teal-deep)}
.pa-btn-ghost{background:transparent;color:var(--inv);border-color:var(--line-ink)}
.pa-btn-ghost:hover{background:rgba(255,255,255,.06)}
.pa-main .pa-btn-ghost,.pa-side .pa-btn-ghost{color:var(--teal-deep);border-color:var(--line);background:var(--card)}
.pa-main .pa-btn-ghost:hover,.pa-side .pa-btn-ghost:hover{background:#F0FAFA;border-color:#BFE6E6}
.pa-btn.full{width:100%;justify-content:center;margin-top:10px}

/* ---- global error bar ---- */
.pa-global-error{display:flex;align-items:center;gap:8px;padding:8px 20px;background:#FCEDEA;color:#A4271A;
  font-size:13px;font-weight:500}
.pa-global-error button{background:none;border:none;cursor:pointer;color:#A4271A;margin-left:auto}

/* ---- dashboard ---- */
.pa-dashboard{max-width:1100px;margin:0 auto;padding:32px 20px}
.pa-dash-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}
.pa-dash-header h2{font-family:var(--disp);font-size:22px;margin:0 0 4px;font-weight:700}
.pa-dash-header p{margin:0;color:var(--muted);font-size:14px}
.pa-dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.pa-dash-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;cursor:pointer;
  transition:.15s;position:relative}
.pa-dash-card:hover{border-color:#BFE6E6;box-shadow:0 4px 20px rgba(14,159,159,.08)}
.pa-dash-card-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.pa-dash-code{font-family:var(--mono);font-size:12px;color:var(--muted);background:#EEF3F0;padding:2px 8px;border-radius:5px}
.pa-dash-card-name{font-weight:600;font-size:15px;margin-bottom:4px}
.pa-dash-card-obj{font-size:12.5px;color:var(--muted);line-height:1.4;margin-bottom:8px;
  overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.pa-dash-card-foot{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--teal-deep);font-weight:500}
.pa-icon.danger.small{width:26px;height:26px;border-radius:6px;position:absolute;top:12px;right:12px}

/* ---- shell ---- */
.pa-shell{display:grid;grid-template-columns:296px 1fr;gap:18px;padding:18px;max-width:1320px;margin:0 auto}
@media (max-width:880px){.pa-shell{grid-template-columns:1fr;padding:12px;gap:12px}}

/* ---- sidebar ---- */
.pa-side{background:var(--ink);border-radius:14px;padding:6px;display:flex;flex-direction:column;gap:6px;
  align-self:start;position:sticky;top:76px;max-height:calc(100vh - 92px)}
@media (max-width:880px){.pa-side{position:static;max-height:none}}
.pa-side-sec{padding:12px 12px 14px}
.pa-side-sec.grow{display:flex;flex-direction:column;flex:1;min-height:0;border-top:1px solid var(--line-ink)}
.pa-side-title{font-family:var(--disp);font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--inv-muted);margin-bottom:10px;display:flex;align-items:center;gap:8px}
.pa-count{margin-left:auto;background:rgba(255,255,255,.08);color:var(--inv);border-radius:20px;padding:1px 8px;font-size:11px;font-family:var(--mono)}
.pa-input.ink{background:var(--ink2);border-color:var(--line-ink);color:var(--inv);margin-bottom:8px}
.pa-input.ink::placeholder{color:var(--inv-muted)}
.pa-input.ink:focus{border-color:var(--teal)}

.pa-steplist{display:flex;flex-direction:column;gap:5px;overflow-y:auto;flex:1;min-height:0;padding-right:2px}
.pa-step{display:flex;align-items:center;gap:9px;text-align:left;background:transparent;border:1px solid transparent;
  border-radius:9px;padding:9px 10px 9px 0;cursor:pointer;color:var(--inv);position:relative;overflow:hidden}
.pa-step:hover{background:rgba(255,255,255,.05)}
.pa-step.sel{background:rgba(14,159,159,.16);border-color:rgba(14,159,159,.5)}
.pa-step-bar{width:4px;align-self:stretch;border-radius:0 3px 3px 0}
.pa-step-n{font-size:11px;color:var(--inv-muted);min-width:18px}
.pa-step-name{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pa-step-t{font-size:11px;color:var(--inv-muted)}

/* ---- main ---- */
.pa-main{display:flex;flex-direction:column;gap:14px;min-width:0}
.pa-diagram-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pa-diagram-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  padding:13px 16px;border-bottom:1px solid var(--line)}
.pa-diagram-head>span{font-family:var(--disp);font-weight:600;font-size:14px}
.pa-legend{display:flex;gap:14px;flex-wrap:wrap}
.pa-legend span{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted)}
.pa-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}

/* ---- ReactFlow custom nodes ---- */
.rf-start-node,.rf-end-node{display:flex;flex-direction:column;align-items:center;gap:6px}
.rf-start-circle{width:40px;height:40px;border-radius:50%;border:2.5px solid #0E9F9F;background:#fff;
  display:flex;align-items:center;justify-content:center}
.rf-start-inner{width:16px;height:16px;border-radius:50%;background:rgba(14,159,159,.15)}
.rf-end-circle{width:40px;height:40px;border-radius:50%;border:3px solid #15232E;background:#fff;
  display:flex;align-items:center;justify-content:center}
.rf-end-inner{width:16px;height:16px;border-radius:50%;background:#15232E}
.rf-event-label{font-size:10px;color:var(--muted);font-family:var(--mono);white-space:nowrap;max-width:100px;
  overflow:hidden;text-overflow:ellipsis;text-align:center}
.rf-handle{background:#9AA8A8 !important;width:8px !important;height:8px !important;border:2px solid #fff !important}

.rf-task-node{background:#fff;border:1.5px solid #E2E7E3;border-left:5px solid #1FA463;border-radius:10px;
  padding:10px 14px;min-width:180px;max-width:220px;cursor:pointer;transition:.15s;font-family:var(--body)}
.rf-task-node:hover{border-color:#BFE6E6;box-shadow:0 2px 12px rgba(14,159,159,.1)}
.rf-task-node.selected{border-color:#0E9F9F;background:#F1FBFB;box-shadow:0 0 0 2px rgba(14,159,159,.2)}
.rf-task-header{margin-bottom:6px}
.rf-task-name{font-size:12.5px;font-weight:600;color:#15232E;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rf-task-meta{display:flex;align-items:center;gap:5px;font-size:10.5px;color:var(--muted);margin-bottom:4px}
.rf-task-badge{color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:10px;letter-spacing:.03em}
.rf-task-times{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted);font-family:var(--mono)}

/* ---- metrics ---- */
.pa-metrics{display:grid;grid-template-columns:repeat(4,1fr) 1.6fr;gap:10px}
@media (max-width:760px){.pa-metrics{grid-template-columns:repeat(2,1fr)}.pa-metric.wide{grid-column:1/-1}}
.pa-metric{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;display:flex;flex-direction:column;gap:5px}
.pa-metric>span{font-size:11px;color:var(--muted);letter-spacing:.02em;display:flex;justify-content:space-between;gap:8px}
.pa-metric>b{font-size:18px;font-weight:600}
.pa-metric.wide{justify-content:center}
.pa-effbar{height:8px;background:#EBF0EC;border-radius:6px;overflow:hidden}
.pa-effbar i{display:block;height:100%;background:linear-gradient(90deg,#1FA463,#2CC07A);border-radius:6px;transition:width .3s}

/* ---- panel ---- */
.pa-panel{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pa-tabs{display:flex;border-bottom:1px solid var(--line)}
.pa-tabs button{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;background:transparent;border:none;
  padding:13px 18px;font-size:13.5px;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent}
.pa-tabs button.on{color:var(--teal-deep);border-bottom-color:var(--teal)}
.pa-panel-body{padding:18px}

/* ---- form fields ---- */
.pa-field{display:flex;flex-direction:column;gap:6px;margin-bottom:13px}
.pa-label{font-size:11.5px;font-weight:600;color:var(--muted);letter-spacing:.02em}
.pa-input{width:100%;border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-size:13.5px;
  color:var(--text);background:#fff;outline:none;transition:.15s;font-family:inherit}
.pa-input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(14,159,159,.12)}
.pa-input.mono{font-family:var(--mono);font-size:12.5px}
textarea.pa-input{resize:vertical;line-height:1.45}
.pa-row.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:520px){.pa-row.two{grid-template-columns:1fr}}

.pa-seg{display:inline-flex;flex-wrap:wrap;gap:6px}
.pa-seg button{border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:8px;padding:8px 13px;
  font-size:12.5px;font-weight:600;cursor:pointer;transition:.12s}
.pa-seg button:hover{border-color:#BFE6E6}
.pa-seg button.on{background:var(--teal);border-color:var(--teal);color:#fff}

.pa-editor-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.pa-tag{font-size:11px;background:#EEF3F0;color:var(--muted);border-radius:6px;padding:3px 8px}
.pa-editor-actions{display:flex;gap:6px}
.pa-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;
  border:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer}
.pa-icon:hover:not(:disabled){background:#F5F7F5}
.pa-icon:disabled{opacity:.4;cursor:default}
.pa-icon.danger:hover{background:#FCEDEA;color:#D9503C;border-color:#F1C7BF}
.pa-divider{display:flex;align-items:center;gap:10px;margin:6px 0 13px;color:var(--muted);font-size:11px;
  font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.pa-divider:after{content:"";flex:1;height:1px;background:var(--line)}

.pa-empty{color:var(--muted);font-size:13.5px;line-height:1.5;padding:14px;background:#F8FAF8;border:1px dashed var(--line);border-radius:10px}

/* ---- optimization ---- */
.pa-opt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.pa-opt-head h3{font-family:var(--disp);font-size:16px;margin:0 0 3px}
.pa-opt-head p{margin:0;font-size:12.5px;color:var(--muted);max-width:42ch;line-height:1.45}
.pa-opt-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.pa-opt-summary>div{background:#F6FAFA;border:1px solid #DCECEC;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.pa-opt-summary span{font-size:11px;color:var(--muted)}
.pa-opt-summary b{font-size:18px;font-family:var(--mono);color:var(--teal-deep)}
.pa-opt-body section{margin-bottom:18px}
.pa-opt-body h4{font-family:var(--disp);font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:0 0 9px}
.pa-card{border:1px solid var(--line);border-radius:11px;padding:12px 13px;margin-bottom:9px;background:#fff}
.pa-card-top{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.pa-card-top strong{font-size:13.5px}
.pa-card p{margin:0 0 6px;font-size:13px;line-height:1.5;color:#2A3742}
.pa-meta{font-size:11.5px;color:var(--muted);font-family:var(--mono)}
.pa-badge{color:#fff;font-size:10.5px;font-weight:700;border-radius:20px;padding:2px 9px;letter-spacing:.03em}
.pa-chip{border:1.4px solid;border-radius:7px;padding:3px 9px;font-size:11.5px;font-weight:700;letter-spacing:.02em}
.pa-save{margin-left:auto;font-size:11.5px;font-weight:700;color:#1FA463;font-family:var(--mono)}

.pa-alert{display:flex;gap:10px;background:#FCF3E8;border:1px solid #F0D6AE;border-radius:10px;padding:12px 13px;color:#7A5A12;font-size:13px;line-height:1.5}
.pa-alert svg{flex:0 0 auto;margin-top:1px;color:#C98A12}
.pa-alert-sub{font-size:11.5px;color:#9A7A2E;margin-top:4px}

/* ---- accessibility ---- */
.pa-root :focus-visible{outline:2px solid var(--teal);outline-offset:2px}
button:hover,.pa-icon:hover{filter:brightness(1.05)}
button:active,.pa-icon:active{filter:brightness(0.95);transform:scale(0.98)}
button:disabled,.pa-icon:disabled{opacity:0.6;cursor:not-allowed;filter:none;transform:none}

/* ---- scrollbars ---- */
.pa-steplist::-webkit-scrollbar{width:8px}
.pa-steplist::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:8px}

/* ---- ReactFlow overrides ---- */
.react-flow__panel{font-family:var(--body) !important}
.react-flow__controls{border-radius:8px !important;overflow:hidden;border:1px solid var(--line) !important;box-shadow:0 2px 8px rgba(0,0,0,.06) !important}
.react-flow__controls button{background:#fff !important;border-bottom:1px solid var(--line) !important}
.react-flow__controls button:hover{background:#F5F7F5 !important}
`;