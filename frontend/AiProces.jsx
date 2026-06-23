import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

import { apiFetch } from "./api.js";
import {
  ReactFlow, Background, Controls,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position, addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Download, Sparkles, Loader2,
  AlertTriangle, User, Wrench, PenLine, Gauge, X, ArrowRight, Lightbulb,
  ArrowLeft, FolderOpen, FileText, Copy, Clock, LogOut, Info, Check
} from "lucide-react";
import { useAuth } from './AuthContext';
import MacroprocessDiagram from "./MacroprocessDiagram.jsx";

/* ============================================================================
   VSM Component
   ============================================================================ */
function VSMLadder({ metrics }) {
  if (!metrics) return null;
  
  const { total_cycle_time_sec, total_wait_time_sec, lead_time_sec, pce_percentage } = metrics;
  
  if (lead_time_sec === 0) return null;
  
  const pce = Math.round(pce_percentage);
  const isPceGood = pce >= 25;
  const pceColor = isPceGood ? '#1FA463' : '#D9503C';
  
  const cyclePct = (total_cycle_time_sec / lead_time_sec) * 100;
  const waitPct = (total_wait_time_sec / lead_time_sec) * 100;

  return (
    <div className="pa-panel" style={{ marginTop: 16, padding: 18 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14, color: '#13202B' }}>Value Stream Mapping (VSM)</h3>
      
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, color: '#5C6B6B' }}>
          <span>Eficiencia de Ciclo (PCE)</span>
          <span style={{ fontWeight: 600, color: pceColor }}>{pce}%</span>
        </div>
        <div style={{ position: 'relative', height: 12, background: '#EBF0EC', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(pce, 100)}%`, background: pceColor, transition: 'width 0.3s ease' }} />
          {/* Reference marker at 25% */}
          <div style={{ position: 'absolute', top: 0, left: '25%', height: '100%', width: 2, background: '#13202B', zIndex: 1 }} title="Umbral Lean (25%)" />
        </div>
        <div style={{ position: 'relative', height: 16, fontSize: 10, color: '#9AA8A8', marginTop: 4 }}>
          <span style={{ position: 'absolute', left: '25%', transform: 'translateX(-50%)' }}>25%</span>
        </div>
      </div>
      
      <div>
        <div style={{ fontSize: 12, marginBottom: 8, color: '#5C6B6B' }}>Escalera de Tiempo (Lead Time: {fmtLong(lead_time_sec)})</div>
        
        {/* Ladder Visualization */}
        <div style={{ display: 'flex', height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E7E3' }}>
          {waitPct > 0 && (
            <div style={{ width: `${waitPct}%`, background: '#FFEBEE', display: 'flex', flexDirection: 'column', borderRight: '1px solid #fff' }}>
              <div style={{ height: '50%', background: '#D9503C', opacity: 0.8 }} />
              <div style={{ height: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#A4271A', fontWeight: 600 }}>
                {waitPct > 10 ? `Espera: ${fmtLong(total_wait_time_sec)}` : ''}
              </div>
            </div>
          )}
          {cyclePct > 0 && (
            <div style={{ width: `${cyclePct}%`, background: '#E8F5E9', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#1FA463', fontWeight: 600 }}>
                {cyclePct > 10 ? `VA: ${fmtLong(total_cycle_time_sec)}` : ''}
              </div>
              <div style={{ height: '50%', background: '#1FA463', opacity: 0.8 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

/* ============================================================================
   Value Class Wizard
   ============================================================================ */

const WASTE_QUESTIONS = [
  { value: "waiting", label: "Espera", question: "¿La tarea principal es solo esperar a que algo o alguien esté listo?" },
  { value: "defects", label: "Defectos", question: "¿Este paso existe para corregir un error o repetir algo que salió mal antes?" },
  { value: "overproduction", label: "Sobreproducción", question: "¿Se está haciendo o generando más de lo que realmente se necesita?" },
  { value: "non_utilized_talent", label: "Talento desaprovechado", question: "¿Una persona capacitada está haciendo algo muy por debajo de su capacidad?" },
  { value: "transportation", label: "Transporte", question: "¿El paso es mover físicamente algo de un lugar a otro sin transformarlo?" },
  { value: "inventory", label: "Inventario", question: "¿Es mantener o almacenar algo (físico o digital) en espera de ser usado?" },
  { value: "motion", label: "Movimiento", question: "¿La persona se mueve, busca o navega más de lo necesario para hacer el trabajo real?" },
  { value: "excess_processing", label: "Sobreproceso", question: "¿Se hace más trabajo, revisión o detalle del que el cliente realmente necesita?" }
];

function ValueClassWizard({ valueClass, wasteType, onChange, expertMode, setExpertMode }) {
  const [step, setStep] = useState(0);
  const [forceWizard, setForceWizard] = useState(!valueClass);
  const [wizardCompleted, setWizardCompleted] = useState(false);

  useEffect(() => {
    if (valueClass && !forceWizard) {
      setStep(0);
    }
  }, [valueClass, forceWizard]);

  useEffect(() => {
    if (!valueClass) {
      setWizardCompleted(false);
    }
  }, [valueClass]);

  if (expertMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Seg value={valueClass} onChange={(v) => onChange(v, v === "NVA" ? wasteType || "waiting" : "")}
             options={Object.entries(VALUE).map(([k, m]) => ({ value: k, label: m.short, color: m.color }))} />
        {valueClass === "NVA" && (
          <select className="pa-input" value={wasteType || "waiting"} onChange={(e) => onChange("NVA", e.target.value)}>
            {Object.entries(WASTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <div style={{ textAlign: 'right' }}>
          <button className="pa-btn pa-btn-ghost" onClick={() => { setExpertMode(false); setForceWizard(!valueClass); }} style={{ fontSize: '11px', padding: '4px 8px' }}>
            <Sparkles size={12} style={{marginRight: 4}} /> Usar asistente guiado
          </button>
        </div>
      </div>
    );
  }

  if (valueClass && !forceWizard) {
    const valObj = VALUE[valueClass];
    return (
      <div style={{ background: '#F8F9FA', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className="pa-badge" style={{ background: valObj?.color, color: '#fff', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}>
              {valObj?.short || valueClass}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
              {valueClass === "NVA" ? `Desperdicio: ${WASTE[wasteType] || wasteType}` : valObj?.label}
            </span>
          </div>
          <button className="pa-btn pa-btn-ghost" onClick={() => { setStep(0); setForceWizard(true); setWizardCompleted(false); }} style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--teal)' }}>
            {wizardCompleted ? "Cambiar respuesta" : "¿No estás seguro? Te ayudamos a decidir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--teal)', boxShadow: '0 4px 12px rgba(14, 159, 159, 0.1)' }}>
      {step === 0 && (
        <div className="wizard-step fade-in">
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '16px', lineHeight: 1.5, color: 'var(--text)' }}>
            Si tu cliente viera este paso, ¿pagaría con gusto por él? Es decir, ¿lo hace porque mejora directamente lo que va a recibir?
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="pa-btn pa-btn-primary" style={{ flex: 1, minHeight: '44px', fontSize: '14px' }} onClick={() => setStep(3)}>Sí, agrega valor</button>
            <button className="pa-btn pa-btn-ghost" style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }} onClick={() => setStep(1)}>
              No
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-step fade-in">
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '16px', lineHeight: 1.5, color: 'var(--text)' }}>
            ¿Este paso existe por una obligación externa (una ley, una norma, un contrato, una auditoría) y no porque el cliente lo pida?
          </p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button className="pa-btn pa-btn-primary" style={{ flex: 1, minHeight: '44px', fontSize: '14px' }} onClick={() => setStep(4)}>Sí, es obligatorio</button>
            <button className="pa-btn pa-btn-ghost" style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }} onClick={() => setStep(2)}>
              No, no es obligatorio
            </button>
          </div>
          <button className="pa-btn pa-btn-ghost" onClick={() => setStep(0)} style={{ fontSize: '13px', padding: 0, color: 'var(--muted)' }}>
            <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step fade-in">
          <div style={{ background: '#FFF3E0', color: '#B06000', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 500 }}>
            Este paso parece ser un desperdicio: no lo pide el cliente ni una obligación externa. Vamos a identificar de qué tipo es.
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text)' }}>
            Elige la descripción que más se parezca a tu caso:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px', marginBottom: '16px' }}>
            {WASTE_QUESTIONS.map(w => (
              <button key={w.value} 
                className="pa-btn pa-btn-ghost" 
                style={{ textAlign: 'left', display: 'block', height: 'auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '8px', whiteSpace: 'normal', lineHeight: 1.4 }}
                onClick={() => {
                  onChange("NVA", w.value);
                  setWizardCompleted(true);
                  setForceWizard(false);
                }}
              >
                <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--danger)' }}>{w.label}</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 400 }}>{w.question}</span>
              </button>
            ))}
          </div>
          <button className="pa-btn pa-btn-ghost" onClick={() => setStep(1)} style={{ fontSize: '13px', padding: 0, color: 'var(--muted)' }}>
            <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step fade-in" style={{ textAlign: 'center' }}>
          <div style={{ background: '#E8F5E9', color: '#1FA463', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '15px', fontWeight: 600 }}>
            Listo, este paso es de Valor Agregado.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="pa-btn pa-btn-ghost" onClick={() => setStep(0)} style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }}>
              <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
            </button>
            <button className="pa-btn pa-btn-primary" style={{ flex: 2, minHeight: '44px', fontSize: '14px' }} onClick={() => {
              onChange("VA", "");
              setWizardCompleted(true);
              setForceWizard(false);
            }}>Entendido</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wizard-step fade-in" style={{ textAlign: 'center' }}>
          <div style={{ background: '#FFF8E1', color: '#C98A12', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>
            Entendido, este paso es necesario por control o regulación, aunque no le agregue valor directo al cliente.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="pa-btn pa-btn-ghost" onClick={() => setStep(1)} style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }}>
              <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
            </button>
            <button className="pa-btn pa-btn-primary" style={{ flex: 2, minHeight: '44px', fontSize: '14px' }} onClick={() => {
              onChange("NNVA", "");
              setWizardCompleted(true);
              setForceWizard(false);
            }}>Entendido</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); setExpertMode(true); }} style={{ fontSize: '12px', color: 'var(--teal)', textDecoration: 'none' }}>
          Prefiero elegir directamente (Modo Experto)
        </a>
      </div>
    </div>
  );
}

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
      <Handle type="target" position={Position.Left} className="rf-handle" id="left" />
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
        {data.waitTime > 0 && <span>| espera {fmtShort(data.waitTime)}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="rf-handle" id="right" />
    </div>
  );
}

  function GatewayNode({ data }) {
    const isExclusive = data.gatewayType === "exclusive";
    return (
      <div
        className={`rf-task-node ${data.selected ? "selected" : ""}`}
        onClick={() => data.onSelect && data.onSelect(data.gatewayId)}
        style={{
          width: 60, height: 60, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          background: 'transparent', border: 'none', boxShadow: 'none'
        }}
      >
        <svg viewBox="0 0 100 100" style={{position:'absolute', width:'100%', height:'100%', pointerEvents: 'none'}}>
          <polygon points="50,5 95,50 50,95 5,50" fill="white" stroke={data.selected ? '#0E9F9F' : '#9AA8A8'} strokeWidth="4" />
          <text x="50" y="62" textAnchor="middle" fontSize="40" fontWeight="bold" fill="#0E9F9F">{isExclusive ? 'X' : '+'}</text>
        </svg>
        <div style={{
          position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', 
          fontSize: 10, whiteSpace: 'nowrap', color: '#666', background: 'rgba(255,255,255,0.8)', padding: '2px 4px', borderRadius: 4
        }}>
          {data.label}
        </div>
        <Handle type="target" position={Position.Left} className="rf-handle" id="left" />
        <Handle type="source" position={Position.Right} className="rf-handle" id="right" />
        <Handle type="source" position={Position.Bottom} className="rf-handle" id="bottom" />
        <Handle type="target" position={Position.Top} className="rf-handle" id="top" />
      </div>
    );
  }

const nodeTypes = { startNode: StartNode, endNode: EndNode, taskNode: TaskNode, gatewayNode: GatewayNode };

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
function buildFlowData(proc, tasks, gateways, sequenceFlows, selectedId, onSelect) {
  const rfNodes = [];
  const rfEdges = [];

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

  // Gateway nodes
  (gateways || []).forEach((gw) => {
    rfNodes.push({
      id: `gw-${gw.bpmn_id}`,
      type: "gatewayNode",
      data: {
        label: gw.name,
        gatewayType: gw.gateway_type,
        gatewayId: gw.bpmn_id,
        selected: gw.bpmn_id === selectedId,
        onSelect,
      },
      position: { x: 0, y: 0 },
    });
  });

  // Start event
  rfNodes.push({
    id: "start",
    type: "startNode",
    data: { label: proc.trigger || "Inicio" },
    position: { x: 0, y: 0 },
  });

  // End event
  rfNodes.push({
    id: "end",
    type: "endNode",
    data: { label: proc.output || "Fin" },
    position: { x: 0, y: 0 },
  });

  // Flow edges
  if (sequenceFlows && sequenceFlows.length > 0) {
    sequenceFlows.forEach((sf) => {
      let sourceId = sf.source_ref;
      if (tasks.some(t => t.id.toString() === sf.source_ref)) sourceId = `task-${sf.source_ref}`;
      else if ((gateways || []).some(g => g.bpmn_id === sf.source_ref)) sourceId = `gw-${sf.source_ref}`;
      
      let targetId = sf.target_ref;
      if (tasks.some(t => t.id.toString() === sf.target_ref)) targetId = `task-${sf.target_ref}`;
      else if ((gateways || []).some(g => g.bpmn_id === sf.target_ref)) targetId = `gw-${sf.target_ref}`;

      rfEdges.push({
        id: sf.id || `sf-${sf.source_ref}-${sf.target_ref}`,
        source: sourceId,
        target: targetId,
        type: "smoothstep",
        label: sf.condition || "",
        animated: false,
        style: { stroke: "#9AA8A8", strokeWidth: 1.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#9AA8A8", width: 16, height: 16 },
      });
    });
  } else {
    // Linear edges fallback if no sequence flows exist at all
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
  }

  return getLayoutedElements(rfNodes, rfEdges);
}

/* ============================================================================
   ReactFlow Diagram Component
   ============================================================================ */

function FlowDiagram({ proc, tasks, gateways, sequenceFlows, selectedId, onSelect, onGraphChange }) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildFlowData(proc, tasks, gateways, sequenceFlows, selectedId, onSelect),
    [proc, tasks, gateways, sequenceFlows, selectedId, onSelect]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params) => {
      const newFlow = {
        id: `sf-${Date.now()}`,
        source_ref: params.source.replace("task-", "").replace("gw-", ""),
        target_ref: params.target.replace("task-", "").replace("gw-", ""),
        condition: "",
      };
      setEdges((eds) => addEdge({ ...params, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#9AA8A8", width: 16, height: 16 }, style: { stroke: "#9AA8A8", strokeWidth: 1.8 } }, eds));
      if (onGraphChange) {
        onGraphChange(gateways, [...(sequenceFlows||[]), newFlow]);
      }
    },
    [gateways, sequenceFlows, onGraphChange, setEdges]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      const deletedIds = deletedEdges.map(e => e.id);
      const newFlows = (sequenceFlows||[]).filter(f => !deletedIds.includes(f.id));
      if (onGraphChange) {
        onGraphChange(gateways, newFlows);
      }
    },
    [gateways, sequenceFlows, onGraphChange]
  );

  return (
    <div style={{ height: 280, width: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={true}
        nodesConnectable={true}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#E7ECE8" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/* ============================================================================
   Small UI atoms
   ============================================================================ */

const Field = ({ label, tooltip, children }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div className="pa-field" style={{ position: 'relative' }}>
      <label className="pa-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {tooltip && (
          <button
            type="button"
            className="pa-icon pa-tooltip-btn"
            onClick={(e) => { e.preventDefault(); setOpen(!open); }}
            aria-label="Ayuda"
            style={{
              background: 'none', border: 'none', padding: 0, margin: 0,
              color: '#0E9F9F', cursor: 'pointer', outline: 'none', display: 'inline-flex'
            }}
          >
            <Info size={14} />
          </button>
        )}
      </label>
      {open && (
        <div ref={popoverRef} style={{
          position: 'absolute', top: 24, left: 0, zIndex: 100, 
          background: '#13202B', color: '#fff', padding: '10px 14px', 
          borderRadius: 8, fontSize: 13, fontWeight: 400, width: 'max-content', maxWidth: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', lineHeight: 1.5,
          whiteSpace: 'normal', pointerEvents: 'auto'
        }}>
          {tooltip}
        </div>
      )}
      {children}
    </div>
  );
};

const TimeField = ({ label, tooltip, valueSec, onChangeSec }) => {
  const [unit, setUnit] = useState(valueSec >= 86400 && valueSec % 86400 === 0 ? 86400 : valueSec >= 3600 && valueSec % 3600 === 0 ? 3600 : valueSec >= 60 && valueSec % 60 === 0 ? 60 : 1);
  const displayVal = valueSec / unit;
  return (
    <Field label={label} tooltip={tooltip}>
      <div style={{display: 'flex', gap: 4}}>
        <input className="pa-input" type="number" min="0" step="any" value={displayVal} onChange={e => onChangeSec((Number(e.target.value)||0) * unit)} style={{flex: 1}}/>
        <select className="pa-input" value={unit} onChange={e => {
          const newU = Number(e.target.value);
          setUnit(newU);
          // Auto-convert to keep the display value the same
          onChangeSec(displayVal * newU);
        }} style={{width: 70, padding: '0 4px'}}>
          <option value={1}>s</option>
          <option value={60}>m</option>
          <option value={3600}>h</option>
          <option value={86400}>d</option>
        </select>
      </div>
    </Field>
  );
};

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

function Editor({ task, onChange, onMove, onDelete, isFirst, isLast, saveState = { status: 'idle' }, expertMode, setExpertMode }) {
  if (!task)
    return <div className="pa-empty">Selecciona un paso en el diagrama o en la lista para ver y editar sus datos.</div>;
  const set = (patch) => onChange(task.id, patch);
  return (
    <div className="pa-editor">
      <div className="pa-editor-head">
        <span className="pa-tag" style={{ fontFamily: "var(--mono)" }}>{task.bpmnId}</span>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', marginRight: '16px', fontSize: '12px', color: saveState.status === 'error' ? 'var(--danger)' : 'var(--teal)', gap: '4px' }}>
          {saveState.status === 'saving' && <><Loader2 size={12} className="spin" /> Guardando...</>}
          {saveState.status === 'saved' && <><Check size={12} /> Guardado</>}
          {saveState.status === 'error' && <><AlertTriangle size={12} /> Error al guardar</>}
          {saveState.status === 'idle' && 'Guardado automático activado'}
        </div>
        <div className="pa-editor-actions">
          <button className="pa-icon" disabled={isFirst} onClick={() => onMove(task.id, -1)} title="Subir"><ChevronUp size={16} /></button>
          <button className="pa-icon" disabled={isLast} onClick={() => onMove(task.id, 1)} title="Bajar"><ChevronDown size={16} /></button>
          <button className="pa-icon danger" onClick={() => onDelete(task.id)} title="Eliminar"><Trash2 size={16} /></button>
        </div>
      </div>

      <Field label="Nombre de la tarea" tooltip="Nombre corto y descriptivo de la acción (Ej: 'Revisar factura').">
        <input className="pa-input" value={task.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>

      <div className="pa-row">
        <Field label="Tipo" tooltip="Define la naturaleza técnica de la tarea: si la hace un usuario, un sistema automático, o si es un envío/recepción de mensajes.">
          <Seg value={task.type} onChange={(v) => set({ type: v })}
            options={Object.entries(TYPES).map(([k, m]) => ({ value: k, label: m.label }))} />
        </Field>
      </div>

      <div className="pa-row two">
        <TimeField label="Tiempo de ciclo" tooltip="Tiempo real trabajando en la tarea (Processing Time)." valueSec={task.cycleTime} onChangeSec={(v) => set({ cycleTime: v })} />
        <TimeField label="Tiempo de espera" tooltip="Tiempo inactivo antes de que esta tarea comience (Wait Time)." valueSec={task.waitTime} onChangeSec={(v) => set({ waitTime: v })} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          Clasificación de valor 
          <Info size={14} style={{ color: 'var(--muted)' }} title="Valor Agregado (VA): El cliente lo valora. Necesario sin valor (NNVA): Regulaciones o control. Desperdicio (NVA): Tareas que podrían eliminarse."/>
        </div>
        <ValueClassWizard 
          valueClass={task.valueClass} 
          wasteType={task.wasteType} 
          onChange={(v, w) => set({ valueClass: v, wasteType: w })}
          expertMode={expertMode}
          setExpertMode={setExpertMode}
        />
      </div>

      <div className="pa-divider"><span>RACI</span></div>
      <div className="pa-row two">
        <Field label="Responsable (R)" tooltip="Quien ejecuta la tarea."><input className="pa-input" value={task.responsible} onChange={(e) => set({ responsible: e.target.value })} /></Field>
        <Field label="Accountable (A)" tooltip="Quien aprueba o responde por el éxito de la tarea."><input className="pa-input" value={task.accountable} onChange={(e) => set({ accountable: e.target.value })} /></Field>
      </div>
      <div className="pa-row two">
        <Field label="Consultado (C)" tooltip="Quien aporta información necesaria."><input className="pa-input" value={task.consulted} onChange={(e) => set({ consulted: e.target.value })} /></Field>
        <Field label="Informado (I)" tooltip="A quien se le notifica el resultado."><input className="pa-input" value={task.informed} onChange={(e) => set({ informed: e.target.value })} /></Field>
      </div>

      <div className="pa-divider"><span>Sistemas</span></div>
      <Field label="Sistemas / Herramientas" tooltip="Aplicaciones, ERPs o herramientas usadas en esta tarea.">
        <input className="pa-input" value={task.systems} onChange={(e) => set({ systems: e.target.value })} placeholder="Ej: SAP, Excel, Jira..." />
      </Field>

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#0E9F9F', marginRight: 'auto' }}>Guardado automático activado</span>
        <button className="pa-btn pa-btn-ghost" style={{ color: '#D9503C', borderColor: '#D9503C' }} onClick={() => onDelete(task.id)}>
          <Trash2 size={16} style={{ marginRight: 4 }} /> Borrar tarea
        </button>
        <button className="pa-btn" onClick={() => alert("Los cambios de la tarea se han guardado exitosamente.")}>
          Guardar
        </button>
      </div>
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
          {!!(d.bottlenecks || []).length && (
            <div style={{ background: 'var(--ink)', color: 'white', padding: 16, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: '50%', flexShrink: 0 }}>
                <Lightbulb size={24} style={{ color: '#0E9F9F' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--inv-muted)', marginBottom: 4, fontWeight: 600 }}>Mayor Impacto Identificado</div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
                  El paso <strong>{d.bottlenecks[0].node_name || d.bottlenecks[0].node_bpmn_id}</strong> genera la mayor restricción. {d.bottlenecks[0].impact_description || d.bottlenecks[0].impact}
                </div>
              </div>
            </div>
          )}

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

function Dashboard({ macroprocesses, processes, onSelect, onCreateProcess, onCreateMacro, onDeleteProcess, onDeleteMacro, macroOpts, runOptimizeMacro, onLoadDemo, openOpts, setOpenOpts, macroLongLoading }) {
  const [dashTab, setDashTab] = useState("jerarquia");
  const [search, setSearch] = useState("");

  const filteredProcesses = processes.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  if (macroprocesses.length === 0 && processes.length === 0) {
    return (
      <div className="pa-dashboard">
        <div className="pa-dash-header">
          <div>
            <h2>Bienvenido a AiProces</h2>
            <p>La herramienta inteligente para levantar, optimizar y exportar tus procesos.</p>
          </div>
        </div>
        
        <div className="pa-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: 800, margin: '40px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: '#EBF0EC', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E9F9F' }}>
              <Sparkles size={32} />
            </div>
          </div>
          <h3 style={{ fontSize: 24, marginBottom: 12, color: '#13202B' }}>Comienza a mapear tus flujos</h3>
          <p style={{ color: '#5C6B6B', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
            Sigue el flujo recomendado para optimizar operaciones:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left', marginBottom: 40, background: '#F5F7F5', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>1</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Define el macroproceso</b> y crea tu primer proceso SIPOC.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>2</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Levanta los pasos</b> con sus responsables, sistemas y tiempos.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>3</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Clasifica el valor</b> (VA, NNVA, NVA) de cada paso según principios Lean.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>4</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Optimiza con IA</b> para identificar cuellos de botella y oportunidades.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>5</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Exporta en BPMN 2.0</b> el diagrama optimizado.</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button className="pa-btn pa-btn-primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={onCreateMacro}>
              <Plus size={18} style={{ marginRight: 6 }}/> Crear mi primer proceso
            </button>
            {onLoadDemo && (
              <button className="pa-btn pa-btn-ghost" style={{ padding: '12px 24px', fontSize: 15, border: '1px solid var(--line)' }} onClick={onLoadDemo}>
                <FileText size={18} style={{ marginRight: 6 }}/> Cargar proceso de ejemplo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pa-dashboard">
      <div className="pa-dash-header">
        <div>
          <h2>Mis procesos</h2>
          <p>Organiza tus procesos en grandes macroprocesos o búscalos en la biblioteca unitaria.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pa-btn pa-btn-primary" onClick={onCreateMacro}>
            <Plus size={16} /> Nuevo macroproceso
          </button>
        </div>
      </div>
      
      <div className="pa-tabs" style={{ marginBottom: '24px', borderBottom: '1px solid var(--line)' }}>
        <button className={dashTab === "jerarquia" ? "on" : ""} onClick={() => setDashTab("jerarquia")}>
          <FolderOpen size={16} /> Vista Jerárquica
        </button>
        <button className={dashTab === "unitaria" ? "on" : ""} onClick={() => setDashTab("unitaria")}>
          <FileText size={16} /> Biblioteca Unitaria
        </button>
      </div>

      {dashTab === "jerarquia" && (
        <>
          {macroprocesses.length === 0 ? (
            <div className="pa-empty" style={{ textAlign: "center", padding: 40 }}>
              <FolderOpen size={40} style={{ color: "#9AA8A8", marginBottom: 12 }} />
              <div>No hay macroprocesos aún. Pulsa <b>Nuevo macroproceso</b> para comenzar.</div>
            </div>
          ) : (
            <div className="pa-dash-macros">
              {macroprocesses.map((m) => {
                const mProcs = processes.filter(p => p.macroprocess_id === m.id);
                return (
                  <div key={m.id} className="pa-dash-macro-sec">
                    <div className="pa-dash-macro-head">
                      <div className="pa-dash-macro-title">
                        <FolderOpen size={20} style={{ color: "#0E9F9F" }} />
                        <h3>{m.name}</h3>
                        <span className="pa-dash-code">{m.code}</span>
                      </div>
                      <div className="pa-dash-macro-actions">
                        {mProcs.length > 0 && (
                          <button className="pa-btn pa-btn-primary" onClick={() => runOptimizeMacro(m.id)} disabled={macroOpts[m.id]?.status === "loading"}>
                            {macroOpts[m.id]?.status === "loading" ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} 
                            {macroOpts[m.id]?.status === "loading" ? (macroLongLoading?.[m.id] ? "Analizando macroproceso..." : "Optimizando...") : "Optimizar End-to-End"}
                          </button>
                        )}
                        <button className="pa-btn pa-btn-ghost" style={{ color: '#0E9F9F', border: '1px solid #E2E7E3' }} onClick={() => onCreateProcess(m.id)}>
                          <Plus size={14} /> Añadir proceso
                        </button>
                        <button className="pa-icon danger" style={{position:"static", width:34, height:34}} onClick={() => onDeleteMacro(m.id)} title="Eliminar macroproceso">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {macroOpts[m.id]?.status === "error" && (
                      <div className="pa-alert" style={{margin: '16px 20px 0'}}>
                        <AlertTriangle size={18} style={{color:"var(--danger)"}}/>
                        <p>{macroOpts[m.id].error}</p>
                      </div>
                    )}
                    {macroOpts[m.id]?.status === "done" && macroOpts[m.id]?.data && (
                      <div className="pa-macro-opt-results" style={{ margin: '16px 20px 0', background: 'white', borderRadius: 8, border: '1px solid var(--teal)' }}>
                        <div 
                          style={{ padding: '12px 16px', background: 'var(--teal)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderRadius: openOpts[m.id] ? '8px 8px 0 0' : '8px' }}
                          onClick={() => setOpenOpts(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                        >
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Sparkles size={16} />
                            <strong style={{ fontSize: 14 }}>Insights de IA a Nivel Macroproceso</strong>
                          </div>
                          {openOpts[m.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                        
                        {openOpts[m.id] && (
                          <div style={{ padding: 20 }}>
                            {/* Insight Principal */}
                            {macroOpts[m.id].data.macro_bottlenecks?.length > 0 && (
                              <div style={{ background: 'var(--ink)', color: 'white', padding: 16, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: '50%' }}>
                                  <AlertTriangle size={24} style={{ color: 'var(--bg-nva)' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--inv-muted)', marginBottom: 4, fontWeight: 600 }}>Insight Principal</div>
                                  <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
                                    El cuello de botella más crítico está en el proceso <strong>{macroOpts[m.id].data.macro_bottlenecks[0].process_name}</strong>. Abordarlo reduciría significativamente el Lead Time total.
                                  </div>
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                              <div className="pa-stat">
                                <span className="pa-stat-label">Lead Time Total (Estimado)</span>
                                <span className="pa-stat-value">{macroOpts[m.id].data.summary.total_macro_lead_time_sec} s</span>
                              </div>
                              <div className="pa-stat">
                                <span className="pa-stat-label">Eficiencia (PCE) Macro</span>
                                <span className="pa-stat-value">{Math.round(macroOpts[m.id].data.summary.macro_pce_percentage)}%</span>
                              </div>
                              <div className="pa-stat">
                                <span className="pa-stat-label">Proyección Optimizada</span>
                                <span className="pa-stat-value" style={{color: 'var(--teal)'}}>{macroOpts[m.id].data.projected_macro_lead_time_sec} s</span>
                              </div>
                            </div>
                            
                            {macroOpts[m.id].data.macro_bottlenecks?.length > 0 && (
                              <div style={{marginBottom: 20}}>
                                <h4 style={{marginBottom: 8}}>Cuellos de Botella (TOC)</h4>
                                {macroOpts[m.id].data.macro_bottlenecks.map((b, i) => (
                                  <div key={i} className="pa-alert" style={{background: b.severity === 'critical' ? 'var(--bg-nva)' : 'var(--bg-nnva)'}}>
                                    <AlertTriangle size={16} style={{color: b.severity === 'critical' ? 'var(--danger)' : 'var(--nnva)'}}/>
                                    <div>
                                      <strong>{b.process_code} - {b.process_name}</strong>
                                      <p>{b.impact_description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
    
                            {macroOpts[m.id].data.interface_wastes?.length > 0 && (
                              <div style={{marginBottom: 20}}>
                                <h4 style={{marginBottom: 8}}>Desperdicios de Interfaz</h4>
                                <ul style={{paddingLeft: 20}}>
                                  {macroOpts[m.id].data.interface_wastes.map((w, i) => (
                                    <li key={i} style={{marginBottom: 4}}><strong>{w.from_process_code} &rarr; {w.to_process_code}:</strong> {w.description} (Retraso: {w.estimated_delay_sec}s)</li>
                                  ))}
                                </ul>
                              </div>
                            )}
    
                            {macroOpts[m.id].data.recommendations?.length > 0 && (
                              <div>
                                <h4 style={{marginBottom: 8}}>Recomendaciones Estratégicas</h4>
                                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                                  {macroOpts[m.id].data.recommendations.map((r, i) => (
                                    <div key={i} style={{padding: 12, background: '#F8F9FA', borderRadius: 4, border: '1px solid var(--line)'}}>
                                      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:4}}>
                                        <span className="pa-tag" style={{background:'var(--teal)', color:'white'}}>{r.action_type}</span>
                                        <strong>{r.target_process_codes.join(', ')}</strong>
                                      </div>
                                      <p style={{margin:0, fontSize:13}}>{r.description}</p>
                                      <p style={{margin:'4px 0 0', fontSize:12, color:'var(--muted)'}}>Beneficio: {r.expected_benefit}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {mProcs.length === 0 ? (
                      <div className="pa-empty" style={{ padding: 20 }}>
                        <p>No hay procesos en este macroproceso.</p>
                        <button className="pa-btn pa-btn-ghost" style={{ marginTop: 12 }} onClick={() => onCreateProcess(m.id)}>
                          <Plus size={16} style={{marginRight: 6}} /> Crear primer proceso
                        </button>
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '400px', marginTop: '16px' }}>
                        <MacroprocessDiagram macroprocessId={m.id} processes={mProcs} onProcessDoubleClick={onSelect} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {dashTab === "unitaria" && (
        <div className="pa-dash-unitary">
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              className="pa-input" 
              placeholder="Buscar por código o nombre..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '400px' }}
            />
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{filteredProcesses.length} procesos encontrados</span>
          </div>
          
          <div style={{ overflowX: 'auto', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F9FAFA', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Código</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre del Proceso</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Macroproceso</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Evento de Inicio</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Resultado Final</th>
                  <th style={{ padding: '12px 16px', width: '80px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.map(p => {
                  const macro = macroprocesses.find(m => m.id === p.macroprocess_id);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--line)', background: '#fff' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}><span className="pa-tag" style={{ margin: 0, fontSize: 11 }}>{p.code}</span></td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--teal-deep)' }}>{p.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{macro ? macro.name : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.trigger_event || p.trigger || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.output_result || p.output || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="pa-btn pa-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => onSelect(p)}>Abrir</button>
                          <button className="pa-icon danger small" onClick={() => onDeleteProcess(p.id)} title="Eliminar proceso"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      La biblioteca está vacía. Crea procesos desde la Vista Jerárquica para poblarla.
                    </td>
                  </tr>
                ) : filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      No se encontraron procesos que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Main App
   ============================================================================ */

export default function App() {
  const { user, logout } = useAuth();
  // Views: "dashboard" | "editor"
  const [view, setView] = useState("dashboard");
  const [allProcesses, setAllProcesses] = useState([]);
  const [macroprocesses, setMacroprocesses] = useState([]);
  const [proc, setProc] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [sequenceFlows, setSequenceFlows] = useState([]);
  const [metricsData, setMetricsData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("detalle");
  const [opt, setOpt] = useState({ status: "idle" });
  const [macroOpts, setMacroOpts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState({ status: 'idle' });
  const [openOpts, setOpenOpts] = useState({});
  const [optLongLoading, setOptLongLoading] = useState(false);
  const [macroLongLoading, setMacroLongLoading] = useState({});
  const [expertMode, setExpertMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileStep, setMobileStep] = useState(1);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const [resProc, resMac] = await Promise.all([
        apiFetch(`/processes`),
        apiFetch(`/macroprocesses`)
      ]);
      if (!resProc.ok || !resMac.ok) throw new Error("No se pudo conectar al backend.");
      const dataProc = await resProc.json();
      const dataMac = await resMac.json();
      setAllProcesses(dataProc.map(mapBackendProcessToFrontend));
      setMacroprocesses(dataMac);
    } catch (e) {
      setError("No se pudo conectar al backend. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = useCallback(async (processId) => {
    try {
      const res = await apiFetch(`/processes/${processId}/metrics`);
      if (res.ok) {
        const m = await res.json();
        setMetricsData(m);
      }
    } catch(e) {
      console.error(e);
    }
  }, []);

  const loadProcessTasks = async (process) => {
    setLoading(true);
    try {
      const resTasks = await apiFetch(`/processes/${process.id}/tasks`);
      if (!resTasks.ok) throw new Error(`Error ${resTasks.status} al cargar tareas`);
      const dbTasks = await resTasks.json();
      const mapped = dbTasks.map(mapBackendTaskToFrontend);
      setTasks(mapped);
      
      await loadMetrics(process.id);
      
      // Graph is optional — don't crash if it fails
      try {
        const resGraph = await apiFetch(`/processes/${process.id}/graph`);
        if (resGraph.ok) {
          const graphData = await resGraph.json();
          setGateways(graphData.gateways || []);
          setSequenceFlows(graphData.sequence_flows || []);
        } else {
          setGateways([]);
          setSequenceFlows([]);
        }
      } catch {
        setGateways([]);
        setSequenceFlows([]);
      }
      
      setSelectedId(mapped[0]?.id || null);
      setOpt({ status: "idle" });
    } catch (e) {
      setError("Error al cargar tareas: " + (e.message || ""));
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

  const loadDemoData = async () => {
    setLoading(true);
    try {
      const resM = await apiFetch(`/macroprocesses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "DEMO-01", name: "Alta de Cliente Demo", description: "Macroproceso de ejemplo generado automáticamente" }),
      });
      if (!resM.ok) throw new Error("No se pudo crear macroproceso");
      const mData = await resM.json();

      const resP = await apiFetch(`/processes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroprocess_id: mData.id, code: "PROC-DEMO", name: "Evaluación Crediticia",
          objective: "Evaluar y aprobar solicitud", trigger_event: "Recibe solicitud", output_result: "Cliente aprobado"
        }),
      });
      if (!resP.ok) throw new Error("No se pudo crear proceso");
      const pData = await resP.json();

      const tasksToCreate = [
        { bpmn_id: "T1", name: "Revisar documentos", task_type: "User Task", value_classification: "NVA", waste_type: "waiting", std_cycle_time_sec: 300, std_wait_time_sec: 3600 },
        { bpmn_id: "T2", name: "Consultar buró", task_type: "Service Task", value_classification: "NNVA", std_cycle_time_sec: 120, std_wait_time_sec: 0 },
        { bpmn_id: "T3", name: "Aprobar crédito", task_type: "User Task", value_classification: "VA", std_cycle_time_sec: 600, std_wait_time_sec: 1800 },
      ];

      for (let t of tasksToCreate) {
        await apiFetch(`/processes/${pData.id}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        });
      }
      
      await loadProcesses();
    } catch(e) {
      alert("Error creando datos demo: " + e.message);
      setLoading(false);
    }
  };

  const createNewProcess = async (macroprocessId) => {
    try {
      const code = "PROC-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const resProc = await apiFetch(`/processes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroprocess_id: macroprocessId, code, name: "Nuevo proceso",
          objective: "", trigger_event: "Inicio", output_result: "Fin",
        }),
      });
      if (!resProc.ok) {
        const errData = await resProc.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${resProc.status} al crear proceso`);
      }
      const newProc = await resProc.json();
      const mapped = mapBackendProcessToFrontend(newProc);
      setAllProcesses((prev) => [...prev, mapped]);
      selectProcess(mapped);
    } catch (e) {
      setError("Error al crear el proceso: " + (e.message || ""));
    }
  };

  const createNewMacroprocess = async () => {
    const name = prompt("Nombre del nuevo macroproceso:");
    if (!name) return;
    try {
      const code = "MAC-" + Math.random().toString(36).slice(2, 5).toUpperCase();
      const res = await apiFetch(`/macroprocesses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, owner_area: "General" }),
      });
      const m = await res.json();
      setMacroprocesses((prev) => [...prev, m]);
    } catch (e) {
      setError("Error al crear el macroproceso.");
    }
  };

  const deleteMacroprocess = async (id) => {
    if (!confirm("¿Eliminar este macroproceso y TODOS los procesos dentro de él?")) return;
    try {
      await apiFetch(`/macroprocesses/${id}`, { method: "DELETE" });
      setMacroprocesses((prev) => prev.filter((m) => m.id !== id));
      setAllProcesses((prev) => prev.filter((p) => p.macroprocess_id !== id));
    } catch (e) {
      setError("Error al eliminar el macroproceso.");
    }
  };

  const deleteProcess = async (id) => {
    if (!confirm("¿Eliminar este proceso y todas sus tareas?")) return;
    try {
      await apiFetch(`/processes/${id}`, { method: "DELETE" });
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

  const selectedTask = tasks.find((t) => t.id === selectedId) || null;
  const selectedGateway = gateways.find((g) => g.bpmn_id === selectedId) || null;

  const saveProcessDebounced = (updatedProc) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        await apiFetch(`/processes/${updatedProc.id}`, {
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
      
      setSaveState({ status: 'saving' });
      updateTaskTimeoutRefs.current[id] = setTimeout(async () => {
        const t = updatedTasks.find((x) => x.id === id);
        if (!t) return;
        try {
          await apiFetch(`/processes/${proc.id}/tasks/${id}`, {
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
          await loadMetrics(proc.id);
          setSaveState({ status: 'saved' });
          setTimeout(() => setSaveState(s => s.status === 'saved' ? { status: 'idle' } : s), 2000);
        } catch (e) {
          setSaveState({ status: 'error' });
        }
      }, 500);
      return updatedTasks;
    });
  };

  const addGateway = async () => {
    const newGw = {
      bpmn_id: "Gateway_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      node_type: "exclusiveGateway",
      name: "Nueva Decisión"
    };
    
    const newGateways = [...gateways, newGw];
    setGateways(newGateways);
    setSelectedId(newGw.bpmn_id);
    setTab("detalle");
    
    try {
      await apiFetch(`/processes/${proc.id}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: newGateways, sequence_flows: sequenceFlows })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateGateway = async (id, patch) => {
    setGateways((gws) => {
      const updated = gws.map(g => g.bpmn_id === id ? { ...g, ...patch } : g);
      if (updateTaskTimeoutRefs.current[id]) clearTimeout(updateTaskTimeoutRefs.current[id]);
      
      setSaveState({ status: 'saving' });
      updateTaskTimeoutRefs.current[id] = setTimeout(async () => {
        try {
          await apiFetch(`/processes/${proc.id}/graph`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gateways: updated, sequence_flows: sequenceFlows })
          });
          setSaveState({ status: 'saved' });
          setTimeout(() => setSaveState(s => s.status === 'saved' ? { status: 'idle' } : s), 2000);
        } catch (e) {
          console.error(e);
          setSaveState({ status: 'error' });
        }
      }, 800);
      return updated;
    });
  };

  const deleteGateway = async (id) => {
    const updated = gateways.filter(g => g.bpmn_id !== id);
    setGateways(updated);
    if (id === selectedId) setSelectedId(null);
    try {
      await apiFetch(`/processes/${proc.id}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: updated, sequence_flows: sequenceFlows })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const addTask = async () => {
    if (!proc) return;
    try {
      const res = await apiFetch(`/processes/${proc.id}/tasks`, {
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
      await apiFetch(`/processes/${proc.id}/tasks/${id}`, { method: "DELETE" });
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
          apiFetch(`/processes/${proc.id}/tasks/${task.id}`, {
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
      await Promise.all(tasks.map((t) => apiFetch(`/processes/${proc.id}/tasks/${t.id}`, { method: "DELETE" })));
      const mapped = [];
      for (let idx = 0; idx < steps.length; idx++) {
        const s = steps[idx];
        const valClass = s.value_classification || s.valueClass || "VA";
        const wType = valClass === "NVA" ? s.waste_type || "waiting" : null;
        const res = await apiFetch(`/processes/${proc.id}/tasks`, {
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

  // local nva count calculation since metricsData might not have it explicitly as a simple count
  const localNvaCount = tasks.filter((t) => t.valueClass === "NVA").length;

  async function runOptimize() {
    if (!proc) return;
    setOpt({ status: "loading" });
    setOptLongLoading(false);
    const t = setTimeout(() => setOptLongLoading(true), 2500);
    setTab("optim");
    try {
      const res = await apiFetch(`/processes/${proc.id}/optimize`, { method: "POST" });
      clearTimeout(t);
      setOptLongLoading(false);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail?.message || errorData.detail || "Error en el motor de optimización.");
      }
      const data = await res.json();
      setOpt({ status: "done", data });
    } catch (e) {
      clearTimeout(t);
      setOptLongLoading(false);
      setOpt({ status: "error", error: e.message || "Error de conexión." });
    }
  }

  async function runOptimizeMacro(mId) {
    setMacroOpts(prev => ({ ...prev, [mId]: { status: "loading" } }));
    setMacroLongLoading(prev => ({ ...prev, [mId]: false }));
    const t = setTimeout(() => setMacroLongLoading(prev => ({ ...prev, [mId]: true })), 2500);
    try {
      const res = await apiFetch(`/macroprocesses/${mId}/optimize`, { method: "POST", headers: { Authorization: `Bearer ${user.token}` } });
      clearTimeout(t);
      setMacroLongLoading(prev => ({ ...prev, [mId]: false }));
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail?.message || errorData.detail || "Error en el motor de optimización macro.");
      }
      const data = await res.json();
      setMacroOpts(prev => ({ ...prev, [mId]: { status: "done", data } }));
    } catch (e) {
      clearTimeout(t);
      setMacroLongLoading(prev => ({ ...prev, [mId]: false }));
      setMacroOpts(prev => ({ ...prev, [mId]: { status: "error", error: e.message || "Error de conexión." } }));
    }
  }

  async function exportBpmn() {
    if (!proc) return;
    try {
      const res = await apiFetch(`/processes/${proc.id}/bpmn`);
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
      const res = await apiFetch(`/processes/${proc.id}/mermaid`);
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
    setMobileStep(3);
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

      {view !== "editor" && (
        <header className="pa-topbar">
          <div className="pa-brand">
            <Logo size={36} />
            <div>
              <div className="pa-brand-name">AiProces</div>
              <div className="pa-brand-tag">Levanta · Optimiza · Exporta</div>
            </div>
          </div>
          <div className="pa-topbar-actions">
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '12px', lineHeight: '1.2' }}>
                <span style={{ fontWeight: 600 }}>{user?.email}</span>
                {user?.role === 'admin' && (
                  <span style={{ color: '#0E9F9F', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Admin</span>
                )}
              </div>
              <button className="pa-btn pa-btn-ghost" onClick={logout} title="Cerrar sesion">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
      )}

      {error && (
        <div className="pa-global-error">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {view === "dashboard" ? (
        <Dashboard
          macroprocesses={macroprocesses}
          processes={allProcesses}
          onSelect={selectProcess}
          onCreateProcess={createNewProcess}
          onCreateMacro={createNewMacroprocess}
          onDeleteProcess={deleteProcess}
          onDeleteMacro={deleteMacroprocess}
          macroOpts={macroOpts}
          runOptimizeMacro={runOptimizeMacro}
          onLoadDemo={loadDemoData}
          openOpts={openOpts}
          setOpenOpts={setOpenOpts}
          macroLongLoading={macroLongLoading}
        />
      ) : proc ? (
        <div className="pa-editor-layout">
          <div className="pa-topbar" style={{ maxWidth: '1320px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button className="pa-btn pa-btn-ghost" style={{ padding: '6px' }} onClick={() => setProc(null)} aria-label="Volver"><ArrowLeft size={16} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                <span 
                  style={{ cursor: 'pointer', color: 'var(--teal)', fontWeight: 500 }} 
                  onClick={() => setProc(null)}
                >
                  Mis procesos
                </span>
                <span style={{ opacity: 0.5 }}>/</span>
                <span 
                  style={{ cursor: 'pointer', color: 'var(--teal)', fontWeight: 500 }} 
                  onClick={() => setProc(null)}
                >
                  {macroprocesses.find(m => m.id === proc.macroprocess_id)?.name || "General"}
                </span>
                <span style={{ opacity: 0.5 }}>/</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 16, color: 'var(--inv)' }}>{proc.name}</h2>
                  <span className="pa-tag" style={{ margin: 0, color: 'var(--ink)' }}>{proc.code}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="pa-btn pa-btn-ghost" onClick={exportMermaid}>
                <Download size={16} /> .mermaid
              </button>
              <button className="pa-btn pa-btn-ghost" onClick={exportBpmn}>
                <Download size={16} /> .bpmn
              </button>
              <button className="pa-btn pa-btn-primary" onClick={runOptimize} disabled={opt.status === "loading"}>
                {opt.status === "loading" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} 
                {opt.status === "loading" ? (optLongLoading ? "Despertando modelo..." : "Optimizando...") : "Optimizar con IA"}
              </button>
            </div>
          </div>

          {isMobile && (
            <div className="pa-mobile-nav">
              <button className={mobileStep === 1 ? 'on' : ''} onClick={() => setMobileStep(1)}>1. Tareas</button>
              <button className={mobileStep === 2 ? 'on' : ''} onClick={() => setMobileStep(2)}>2. Diagrama</button>
              <button className={mobileStep === 3 ? 'on' : ''} onClick={() => setMobileStep(3)}>3. Detalle</button>
            </div>
          )}

          <div className="pa-shell">
            {(!isMobile || mobileStep === 1) && (
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
                    <button key={t.id} className={"pa-step" + (t.id === selectedId ? " sel" : "")} onClick={() => { setSelectedId(t.id); setTab("detalle"); setMobileStep(3); }}>
                      <span className="pa-step-bar" style={{ background: VALUE[t.valueClass]?.color || "#EEF3F0" }} />
                      <span className="pa-step-n mono">{String(i + 1).padStart(2, "0")}</span>
                      <span className="pa-step-name">{t.name}</span>
                      <span className="pa-step-t mono">{fmtShort((Number(t.cycleTime) || 0) + (Number(t.waitTime) || 0))}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="pa-btn pa-btn-ghost" style={{ flex: 1 }} onClick={addTask}><Plus size={14} /> Tarea</button>
                  <button className="pa-btn pa-btn-ghost" style={{ flex: 1 }} onClick={addGateway}><Plus size={14} /> Compuerta</button>
                </div>
              </div>
            </aside>
            )}

            {(!isMobile || mobileStep === 2 || mobileStep === 3) && (
            <main className="pa-main">
              {(!isMobile || mobileStep === 2) && (
              <div className="pa-diagram-wrapper">
              <div className="pa-diagram-card" style={isMobile ? { minHeight: '60vh' } : {}}>
                <div className="pa-diagram-head">
                  <span>Flujo del proceso</span>
                  <div className="pa-legend">
                    {Object.values(VALUE).map((v) => (
                      <span key={v.short}><i style={{ background: v.color }} />{v.label}</span>
                    ))}
                  </div>
                </div>
                <FlowDiagram 
                  proc={proc} 
                  tasks={tasks} 
                  gateways={gateways}
                  sequenceFlows={sequenceFlows}
                  selectedId={selectedId} 
                  onSelect={onNodeSelect}
                  onGraphChange={async (newGateways, newFlows) => {
                    setGateways(newGateways);
                    setSequenceFlows(newFlows);
                    await apiFetch(`/processes/${proc.id}/graph`, {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ gateways: newGateways, sequence_flows: newFlows })
                    });
                  }}
                />
              </div>

              <div className="pa-metrics">
                <div className="pa-metric"><span>Lead time</span><b className="mono">{metricsData ? fmtLong(metricsData.lead_time_sec) : '-'}</b></div>
                <div className="pa-metric"><span>Tiempo de ciclo</span><b className="mono">{metricsData ? fmtLong(metricsData.total_cycle_time_sec) : '-'}</b></div>
                <div className="pa-metric"><span>Tiempo de espera</span><b className="mono">{metricsData ? fmtLong(metricsData.total_wait_time_sec) : '-'}</b></div>
                <div className="pa-metric"><span>Pasos NVA</span><b className="mono" style={{ color: localNvaCount ? VALUE.NVA.color : undefined }}>{localNvaCount}</b></div>
                <div className="pa-metric wide">
                  <span>Eficiencia de ciclo (VA) <b className="mono">{metricsData ? Math.round(metricsData.pce_percentage) : 0}%</b></span>
                </div>
              </div>
              
              <VSMLadder metrics={metricsData} />
              </div>
              )}

              {(!isMobile || mobileStep === 3) && (
              <div className="pa-panel" style={{ marginTop: 16 }}>
                <div className="pa-tabs">
                  <button className={tab === "detalle" ? "on" : ""} onClick={() => setTab("detalle")}><Gauge size={15} /> Detalle del paso</button>
                  <button className={tab === "optim" ? "on" : ""} onClick={() => setTab("optim")}><Lightbulb size={15} /> Optimización IA</button>
                </div>
                <div className="pa-panel-body">
                  {tab === "detalle" ? (
                    selectedTask ? (
                      <Editor task={selectedTask} onChange={updateTask} onMove={moveTask} onDelete={deleteTask}
                        isFirst={selectedTask ? tasks[0]?.id === selectedTask.id : true}
                        isLast={selectedTask ? tasks[tasks.length - 1]?.id === selectedTask.id : true} 
                        saveState={saveState} expertMode={expertMode} setExpertMode={setExpertMode} />
                    ) : selectedGateway ? (
                      <div className="pa-editor">
                        <div className="pa-editor-head">
                          <span className="pa-editor-id mono">{selectedGateway.bpmn_id}</span>
                          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', marginRight: '16px', fontSize: '12px', color: saveState.status === 'error' ? 'var(--danger)' : 'var(--teal)', gap: '4px' }}>
                            {saveState.status === 'saving' && <><Loader2 size={12} className="spin" /> Guardando...</>}
                            {saveState.status === 'saved' && <><Check size={12} /> Guardado</>}
                            {saveState.status === 'error' && <><AlertTriangle size={12} /> Error al guardar</>}
                            {saveState.status === 'idle' && 'Guardado automático activado'}
                          </div>
                          <div className="pa-editor-actions">
                            <button className="pa-btn pa-btn-ghost" onClick={() => deleteGateway(selectedGateway.bpmn_id)}>Eliminar</button>
                          </div>
                        </div>
                        <div className="pa-form">
                          <Field label="Nombre de la decisión" tooltip="Nombre o pregunta que se evalúa (Ej: '¿Aprobado?').">
                            <input className="pa-input" value={selectedGateway.name || ""} onChange={(e) => updateGateway(selectedGateway.bpmn_id, { name: e.target.value })} />
                          </Field>
                        <Field label="Tipo de compuerta" tooltip="Exclusiva: Solo se toma un camino. Paralela: Se toman todos los caminos al mismo tiempo.">
                          <select className="pa-input" value={selectedGateway.node_type} onChange={(e) => updateGateway(selectedGateway.bpmn_id, { node_type: e.target.value })}>
                            <option value="exclusiveGateway">Exclusiva (X)</option>
                            <option value="parallelGateway">Paralela (+)</option>
                          </select>
                        </Field>
                        <div style={{ padding: '12px', background: '#F0F9F9', borderLeft: '3px solid #0E9F9F', borderRadius: '4px', fontSize: 13, color: '#3A4B4B', marginTop: 16 }}>
                          <strong><Info size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/> ¿Cómo conectar?</strong><br/>
                          Arrastra desde los puntos conectores de los nodos en el diagrama hacia esta compuerta para conectarla. Usa la tecla Retroceso (Backspace) para eliminar flechas erróneas.
                        </div>
                        
                        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#0E9F9F', marginRight: 'auto' }}>Guardado automático activado</span>
                          <button className="pa-btn pa-btn-ghost" style={{ color: '#D9503C', borderColor: '#D9503C' }} onClick={() => deleteGateway(selectedGateway.bpmn_id)}>
                            <Trash2 size={16} style={{ marginRight: 4 }} /> Borrar compuerta
                          </button>
                          <button className="pa-btn" onClick={() => alert("Los cambios de la compuerta se han guardado exitosamente.")}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#5C6B6B' }}>
                      Selecciona un nodo para ver sus detalles.
                    </div>
                  )
                ) : (
                  <Optimization state={opt} onRun={runOptimize} onApply={applyOptimized} />
                )}
              </div>
            </div>
            )}
          </main>
          )}
          </div>
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
.pa-dash-macros{display:flex;flex-direction:column;gap:32px}
.pa-dash-macro-sec{display:flex;flex-direction:column;gap:16px}
.pa-dash-macro-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap;gap:12px}
.pa-dash-macro-title{display:flex;align-items:center;gap:12px}
.pa-dash-macro-title h3{margin:0;font-family:var(--disp);font-size:18px;font-weight:700}
.pa-dash-macro-actions{display:flex;align-items:center;gap:8px}

/* ---- mobile nav ---- */
.pa-mobile-nav{display:flex;background:var(--card);border-bottom:1px solid var(--line);padding:0 12px;overflow-x:auto}
.pa-mobile-nav button{flex:1;background:transparent;border:none;padding:12px;font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap;border-bottom:2px solid transparent}
.pa-mobile-nav button.on{color:var(--teal);border-bottom-color:var(--teal)}

/* ---- shell ---- */
.pa-shell{display:grid;grid-template-columns:296px 1fr;gap:18px;padding:18px;max-width:1320px;margin:0 auto;align-items:start}
@media (max-width:880px){.pa-shell{grid-template-columns:1fr;padding:12px;gap:12px}}
@media (max-width:768px){.pa-shell{display:flex;flex-direction:column-reverse;padding:12px;gap:16px}}

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
@media (max-width:760px){.pa-metrics{grid-template-columns:1fr}.pa-metric.wide{grid-column:1/-1}}
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
.pa-input{box-sizing:border-box;width:100%;border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-size:13.5px;
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

/* ---- mobile optimizations ---- */
@media (max-width: 768px) {
  .pa-btn { min-height: 44px; justify-content: center; }
  .pa-input, .pa-step { min-height: 44px; }
  .pa-topbar { flex-wrap: wrap; }
  .pa-diagram-head { flex-wrap: wrap; }
  .pa-mobile-nav button { min-height: 44px; }
}
`;