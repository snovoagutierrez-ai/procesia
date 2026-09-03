import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

import { apiFetch, apiMutate } from "./api.js";
import { VALUE, WASTE, TYPES, ACTION, SEVERITY, WASTE_QUESTIONS } from "./constants.js";
// Los componentes de React Flow y dagre viven en FlowDiagrams.jsx; aquí solo se
// usa el CSS de la librería, por eso no se importan sus símbolos.
import "@xyflow/react/dist/style.css";
import {
  Plus, Trash2, ChevronRight, ChevronLeft, Download, Sparkles, Loader2,
  AlertTriangle, Gauge, X, ArrowRight, Lightbulb,
  ArrowLeft, FileText, Clock, LogOut, Info, Check,
  MessageSquare, MoreVertical
} from "lucide-react";
import { useAuth } from './components/auth/AuthContext.jsx';
import { useConfirm, useInputDialog } from './components/shared/ConfirmDialog.jsx';
import MacroprocessDiagram from "./components/diagram/MacroprocessDiagram.jsx";
import Logo from "./components/shared/Logo.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import './styles/main.css';
import { Editor, GatewayEditor, Optimization, fmtShort, fmtLong } from "./components/editor/Editors.jsx";
import { VSMLadder, FlowDiagram } from "./components/diagram/FlowDiagrams.jsx";
import WelcomeModal from "./components/shared/WelcomeModal.jsx";
import SnapshotsModal from "./components/editor/SnapshotsModal.jsx";
import ConsultAssistantModal from "./components/editor/ConsultAssistantModal.jsx";
import { openProcessReport } from "./utils/processReport.js";

function Banner({ type, message, actionText, onAction, onClose }) {
  const bg = type === 'success' ? '#E8F5E9' : type === 'warning' ? '#FFF8E1' : '#E8F4F8';
  const color = type === 'success' ? '#1FA463' : type === 'warning' ? '#C98A12' : 'var(--teal)';
  return (
    <div style={{ background: bg, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${color}30` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, fontSize: 13, fontWeight: 500 }}>
        <Sparkles size={16} />
        {message}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {actionText && onAction && (
          <button className="pa-btn pa-btn-sm" onClick={onAction} style={{ background: '#fff', color, border: `1px solid ${color}` }}>
            {actionText}
          </button>
        )}
        {onClose && <button className="pa-btn-icon" onClick={onClose}><X size={16} style={{ color }} /></button>}
      </div>
    </div>
  );
}


/* ============================================================================
   VSM Component
   ============================================================================ */
















































































/* ============================================================================
   AiProces — levantamiento, optimización con IA y exportación BPMN 2.0
   Frontend integrado con FastAPI + PostgreSQL
   ============================================================================ */

const API = import.meta.env.VITE_API_URL;

// VALUE, WASTE, TYPES, ACTION, SEVERITY imported from ./constants.js

/* ============================================================================
   Value Class Wizard
   ============================================================================ */
// WASTE_QUESTIONS imported from ./constants.js











































































































































































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















// Guia de practica: cada paso dice donde hacer clic y que va a pasar despues,
// para alguien que nunca ha modelado un proceso. Los 5 pasos coinciden con las
// acciones reales del editor, que son las que hacen avanzar la guia sola.
const GUIDE_STEPS = [
  {
    icon: "➕",
    text: <>Abajo a la izquierda, pulsa <strong>+ Tarea</strong>. Cada tarea es un paso real del trabajo, como "Revisar documentos". Aparecerá en la lista y en el diagrama.</>,
  },
  {
    icon: "✏️",
    text: <>En el panel derecho ponle <strong>nombre</strong> y responde la pregunta de <strong>valor</strong>: si el cliente pagaría por ese paso es <strong>VA</strong>; si no, pero hace falta (un control, la ley), es <strong>NNVA</strong>; si sobra, es <strong>NVA</strong>. De aquí sale tu eficiencia.</>,
  },
  {
    icon: "⏱️",
    text: <>En ese mismo panel anota el <strong>tiempo de ciclo</strong> (lo que dura el paso) y el <strong>tiempo de espera</strong> (lo que el trabajo pasa detenido antes de empezarlo). Sin esos dos números no hay métricas.</>,
  },
  {
    icon: "🔀",
    text: <>¿El proceso se bifurca? Pulsa <strong>+ Compuerta</strong> y ponle la pregunta ("¿Está aprobado?"). Después, en <strong>Ramas de salida</strong>, etiqueta cada camino <strong>Sí / No</strong> y el % de casos que toma cada uno.</>,
  },
  {
    icon: "🔗",
    text: <>Une los pasos en el diagrama: arrastra desde el <strong>punto relleno</strong> del borde derecho (salida) hasta el <strong>punto hueco</strong> del siguiente (entrada). Cuando todo esté unido, pulsa <strong>4. Ir a Optimización IA</strong>.</>,
  },
];

function GuideTicket({ step, onStep, onDismiss }) {
  if (!step || step < 1 || step > GUIDE_STEPS.length) return null;
  const { icon, text } = GUIDE_STEPS[step - 1];
  const total = GUIDE_STEPS.length;
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: 28, zIndex: 1000,
      background: '#0B7A7A', color: '#fff',
      borderRadius: 12, padding: '12px 14px 12px 16px',
      boxShadow: '0 6px 24px rgba(11,122,122,0.45)',
      maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 10,
      animation: 'fadeInUp 0.3s ease',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Paso {step} de {total}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>{text}</div>
        </div>
        <button onClick={onDismiss} title="Cerrar guía"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', padding: 2, flexShrink: 0, display: 'flex' }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onStep(step - 1)} disabled={step === 1} title="Paso anterior"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, cursor: step === 1 ? 'default' : 'pointer', color: '#fff', opacity: step === 1 ? 0.35 : 1, padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'center' }}>
          {GUIDE_STEPS.map((_, i) => (
            <div key={i} onClick={() => onStep(i + 1)} style={{ width: i + 1 === step ? 18 : 6, height: 6, borderRadius: 3, background: i + 1 === step ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.2s' }} />
          ))}
        </div>
        <button onClick={() => step === total ? onDismiss() : onStep(step + 1)} title={step === total ? 'Finalizar guía' : 'Paso siguiente'}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
          {step === total ? <Check size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>
    </div>
  );
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

function fmtMoney(v) {
  const n = Number(v) || 0;
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + n.toFixed(0);
}

/* ============================================================================
   ReactFlow Custom Nodes
   ============================================================================ */





















































  































/* ---------- Dagre layout ---------- */






















/* ---------- Build ReactFlow data from tasks ---------- */
































































































/* ============================================================================
   ReactFlow Diagram Component
   ============================================================================ */





































































/* ============================================================================
   Small UI atoms — imported from ./components/shared/uiAtoms.jsx
   ============================================================================ */

/* ============================================================================
   Step Editor
   ============================================================================ */












































































































































/* ============================================================================
   Optimization panel
   ============================================================================ */


































































































































/* ============================================================================
   Logo
   ============================================================================ */


/* ============================================================================
   Dashboard (multi-process selector)
   ============================================================================ */

export default function App() {
  const { user, logout: baseLogout } = useAuth();
  // Views: "dashboard" | "editor"
  const [view, setView] = useState("dashboard");
  const [dashTab, setDashTab] = useState("jerarquia");
  const [allProcesses, setAllProcesses] = useState([]);
  const [macroprocesses, setMacroprocesses] = useState([]);
  const [proc, setProc] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [sequenceFlows, setSequenceFlows] = useState([]);
  const [mergeData, setMergeData] = useState(null);
  const [aiTip, setAiTip] = useState(null);
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const [firstStepsActive, setFirstStepsActive] = useState(false);
  const [guideStep, setGuideStep] = useState(1);
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
  const [expertMode, setExpertMode] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isDesktopWide, setIsDesktopWide] = useState(window.innerWidth >= 1024);
  const [mobileStep, setMobileStep] = useState(1);
  const [showTutorial, setShowTutorial] = useState(false);
  const [consultAssistantOpen, setConsultAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'error'|'success' }
  const toastTimer = useRef(null);
  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const [dismissedIssuesSig, setDismissedIssuesSig] = useState(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const { confirm, dialog: confirmDialog } = useConfirm();
  const { showInput, inputDialog } = useInputDialog();

  useEffect(() => {
    const tutorialSeen = localStorage.getItem('aiproces_tutorial_seen');
    if (!tutorialSeen) {
      setShowTutorial(true);
      localStorage.setItem('aiproces_tutorial_seen', 'true');
    }
  }, []);

  const dismissGuide = useCallback(() => {
    setFirstStepsActive(false);
    if (proc) localStorage.setItem(`first_steps_${proc.id}`, 'true');
  }, [proc]);

  // La guia solo aparecia una vez por proceso y no habia forma de recuperarla,
  // asi que quien la cerraba sin querer se quedaba sin acompanamiento.
  const restartGuide = useCallback(() => {
    if (proc) localStorage.removeItem(`first_steps_${proc.id}`);
    setGuideStep(1);
    setFirstStepsActive(true);
  }, [proc]);

  useEffect(() => {
    if (proc) {
      const dismissed = localStorage.getItem(`first_steps_${proc.id}`);
      if (!dismissed) {
        setFirstStepsActive(true);
        setGuideStep(1);
      }
    }
  }, [proc]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsDesktopWide(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock page scroll when in editor mode so pa-shell handles it internally
  useEffect(() => {
    if (view === 'editor') {
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100%';
    } else {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [view]);

  const debounceTimeoutRef = useRef(null);
  const updateTaskTimeoutRefs = useRef({});
  // Identifica la carga de proceso en curso; descarta respuestas de cargas viejas.
  const loadRequestRef = useRef(0);

  const procRef = useRef(proc);
  useEffect(() => { procRef.current = proc; }, [proc]);

  const sequenceFlowsRef = useRef(sequenceFlows);
  useEffect(() => { sequenceFlowsRef.current = sequenceFlows; }, [sequenceFlows]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  // Guarda el grafo (compuertas + conexiones) avisando si falla.
  // Antes cada llamada usaba `.catch(() => {})` y además no comprobaba res.ok,
  // así que un 422/500 pasaba inadvertido: el usuario veía su diagrama conectado
  // en pantalla pero al recargar el trabajo no estaba.
  const persistGraph = useCallback(async (gws, flows, processId) => {
    const pid = processId ?? procRef.current?.id;
    if (!pid) return false;
    try {
      await apiMutate(`/processes/${pid}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: gws || [], sequence_flows: flows || [] }),
      });
      return true;
    } catch (e) {
      setSaveState({ status: 'error' });
      showToast("No se pudo guardar el diagrama: " + (e.message || "error de conexión") +
                ". Revisa tu conexión y vuelve a intentarlo.");
      return false;
    }
  }, [showToast]);

  // Cancela cualquier guardado diferido pendiente (tareas, proceso, layout).
  // Se llama al cambiar de proceso: sin esto, un temporizador del proceso anterior
  // disparaba ya con otro proceso abierto y el guardado se perdía en silencio.
  const cancelPendingSaves = () => {
    Object.keys(updateTaskTimeoutRefs.current).forEach((key) => {
      if (!key.endsWith("_flush")) clearTimeout(updateTaskTimeoutRefs.current[key]);
      delete updateTaskTimeoutRefs.current[key];
    });
    if (debounceTimeoutRef.current) { clearTimeout(debounceTimeoutRef.current); debounceTimeoutRef.current = null; }
    if (layoutTimeoutRef.current) { clearTimeout(layoutTimeoutRef.current); layoutTimeoutRef.current = null; }
  };

  const flushAllSaves = async () => {
    const promises = [];
    Object.keys(updateTaskTimeoutRefs.current).forEach(key => {
      if (key.endsWith("_flush")) {
        const baseId = key.replace("_flush", "");
        if (updateTaskTimeoutRefs.current[baseId]) {
          clearTimeout(updateTaskTimeoutRefs.current[baseId]);
          delete updateTaskTimeoutRefs.current[baseId];
        }
        promises.push(updateTaskTimeoutRefs.current[key]());
        delete updateTaskTimeoutRefs.current[key];
      }
    });
    if (promises.length > 0) {
      setSaveState({ status: 'saving' });
      await Promise.all(promises);
      setSaveState({ status: 'saved' });
    }
  };

  const logout = async () => {
    await flushAllSaves();
    baseLogout();
  };

  const goBackToDashboard = async () => {
    await flushAllSaves();
    // Invalida cargas en vuelo y descarta el estado del proceso que se abandona.
    loadRequestRef.current++;
    cancelPendingSaves();
    setView("dashboard");
    setProc(null);
    setTasks([]);
    setGateways([]);
    setSequenceFlows([]);
    setMetricsData(null);
    setSelectedId(null);
    setOpt({ status: "idle" });
    loadProcesses();
  };


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

  const loadMetrics = useCallback(async (processId, isStale) => {
    try {
      const res = await apiFetch(`/processes/${processId}/metrics`);
      if (isStale && isStale()) return;   // el usuario ya abrió otro proceso
      if (res.ok) {
        const m = await res.json();
        if (isStale && isStale()) return;
        setMetricsData(m);
      }
    } catch(e) {
      console.error(e);
    }
  }, []);

  const loadProcessTasks = async (process) => {
    // Guarda contra respuestas obsoletas: si el usuario abre el proceso A y antes
    // de que responda abre el B, la respuesta (más lenta) de A llegaba después y
    // pisaba el estado del B — el encabezado decía "B" pero se veía el flujo de A.
    const reqId = ++loadRequestRef.current;
    const isStale = () => reqId !== loadRequestRef.current;

    setLoading(true);
    try {
      const resTasks = await apiFetch(`/processes/${process.id}/tasks`);
      if (isStale()) return;
      if (!resTasks.ok) throw new Error(`Error ${resTasks.status} al cargar tareas`);
      const dbTasks = await resTasks.json();
      if (isStale()) return;
      const mapped = dbTasks.map(mapBackendTaskToFrontend);
      setTasks(mapped);

      await loadMetrics(process.id, () => reqId !== loadRequestRef.current);
      if (isStale()) return;

      // Graph is optional — don't crash if it fails
      try {
        const resGraph = await apiFetch(`/processes/${process.id}/graph`);
        if (isStale()) return;
        if (resGraph.ok) {
          const graphData = await resGraph.json();
          if (isStale()) return;
          setGateways(graphData.gateways || []);
          setSequenceFlows(graphData.sequence_flows || []);
        } else {
          setGateways([]);
          setSequenceFlows([]);
        }
      } catch {
        if (isStale()) return;
        setGateways([]);
        setSequenceFlows([]);
      }

      if (isStale()) return;
      setSelectedId(mapped[0]?.id || null);
      setOpt({ status: "idle" });
    } catch (e) {
      if (isStale()) return;
      setError("Error al cargar tareas: " + (e.message || ""));
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  const selectProcess = (p) => {
    // Cancela guardados pendientes del proceso anterior antes de cambiar de
    // contexto, para que ningún temporizador dispare sobre el proceso nuevo.
    cancelPendingSaves();
    setProc(p);
    setView("editor");
    setTab("detalle");
    setTasks([]);
    setGateways([]);
    setSequenceFlows([]);
    setSelectedId(null);
    setMetricsData(null);
    loadProcessTasks(p);
  };

  const loadDemoData = async () => {
    setLoading(true);
    try {
      const demoCode = "DEMO-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const resM = await apiFetch(`/macroprocesses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: demoCode, name: "Alta de Cliente Demo", description: "Macroproceso de ejemplo generado automáticamente" }),
      });
      if (!resM.ok) throw new Error("No se pudo crear macroproceso");
      const mData = await resM.json();

      const resP = await apiFetch(`/processes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroprocess_id: mData.id, code: demoCode + "-PROC", name: "Evaluación Crediticia",
          objective: "Evaluar y aprobar solicitud", trigger_event: "Recibe solicitud", output_result: "Cliente aprobado"
        }),
      });
      if (!resP.ok) throw new Error("No se pudo crear proceso");
      const pData = await resP.json();

      const tasksToCreate = [
        { bpmn_id: "T1", name: "Revisar documentos", task_type: "user", value_classification: "NVA", waste_type: "waiting", std_cycle_time_sec: 300, std_wait_time_sec: 3600 },
        { bpmn_id: "T2", name: "Consultar buró", task_type: "service", value_classification: "NNVA", std_cycle_time_sec: 120, std_wait_time_sec: 0 },
        { bpmn_id: "T3", name: "Aprobar crédito", task_type: "user", value_classification: "VA", std_cycle_time_sec: 600, std_wait_time_sec: 1800 },
      ];

      for (let t of tasksToCreate) {
        await apiMutate(`/processes/${pData.id}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        });
      }
      
      await loadProcesses();
    } catch(e) {
      showToast("Error creando datos demo: " + e.message);
      setLoading(false);
    }
  };

  const createNewProcess = async (macroprocessId) => {
    // Pedir nombre al crear: evita la proliferación de procesos "Nuevo proceso"
    // imposibles de distinguir en el dashboard y la biblioteca.
    const name = await showInput("Nuevo proceso", { placeholder: "Nombre del proceso (Ej: Aprobación de compras)", confirmLabel: "Crear" });
    if (name == null) return; // canceló el diálogo
    try {
      const code = "PROC-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const resProc = await apiFetch(`/processes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          macroprocess_id: macroprocessId, code, name: (name || "").trim() || "Nuevo proceso",
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
    const name = await showInput("Nuevo macroproceso", { placeholder: "Nombre del macroproceso", confirmLabel: "Crear" });
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
    const ok = await confirm("Eliminar macroproceso", "¿Eliminar este macroproceso y TODOS los procesos dentro de él? Esta acción no se puede deshacer.", { danger: true, confirmLabel: "Eliminar" });
    if (!ok) return;
    try {
      await apiMutate(`/macroprocesses/${id}`, { method: "DELETE" });
      setMacroprocesses((prev) => prev.filter((m) => m.id !== id));
      setAllProcesses((prev) => prev.filter((p) => p.macroprocess_id !== id));
    } catch (e) {
      setError("Error al eliminar el macroproceso.");
    }
  };

  const deleteProcess = async (id) => {
    const ok = await confirm("Eliminar proceso", "¿Eliminar este proceso y todas sus tareas? Esta acción no se puede deshacer.", { danger: true, confirmLabel: "Eliminar" });
    if (!ok) return;
    try {
      await apiMutate(`/processes/${id}`, { method: "DELETE" });
      setAllProcesses((prev) => prev.filter((p) => p.id !== id));
      if (proc?.id === id) { setProc(null); setView("dashboard"); }
    } catch (e) {
      setError("Error al eliminar el proceso.");
    }
  };



  const selectedTask = tasks.find((t) => t.id === selectedId) || null;
  const selectedGateway = gateways.find((g) => g.bpmn_id === selectedId) || null;

  const saveProcessDebounced = (updatedProc) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        await apiMutate(`/processes/${updatedProc.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            macroprocess_id: updatedProc.macroprocess_id, code: updatedProc.code,
            name: updatedProc.name, objective: updatedProc.objective,
            trigger_event: updatedProc.trigger_event || updatedProc.trigger,
            output_result: updatedProc.output_result || updatedProc.output,
            monthly_volume: (updatedProc.monthly_volume === "" || updatedProc.monthly_volume == null)
              ? null : Number(updatedProc.monthly_volume),
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

  // #5 Guarda las posiciones manuales del diagrama (debounced). Actualiza proc.layout_json
  // en estado para que los re-renders respeten las posiciones y no vuelvan al auto-layout.
  const layoutTimeoutRef = useRef(null);
  const saveLayout = useCallback((positionsMap) => {
    setProc((p) => (p ? { ...p, layout_json: positionsMap } : p));
    const pid = procRef.current?.id;
    if (!pid) return;
    if (layoutTimeoutRef.current) clearTimeout(layoutTimeoutRef.current);
    layoutTimeoutRef.current = setTimeout(() => {
      apiMutate(`/processes/${pid}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout_json: positionsMap }),
      }).catch(() => setSaveState({ status: 'error' }));
    }, 600);
  }, []);

  const updateTask = (id, patch) => {
    // El id del proceso se captura AHORA (al editar), no dentro del temporizador:
    // antes se leía procRef.current al disparar, así que si el usuario cambiaba de
    // proceso dentro de los 500 ms el PUT se enviaba al proceso equivocado y el
    // backend lo rechazaba (400) — la edición se perdía sin aviso.
    const ownerProcessId = procRef.current?.id;
    setTasks((ts) => {
      const updatedTasks = ts.map((t) => (t.id === id ? { ...t, ...patch } : t));
      if (updateTaskTimeoutRefs.current[id]) clearTimeout(updateTaskTimeoutRefs.current[id]);

      setSaveState({ status: 'saving' });
      updateTaskTimeoutRefs.current[id] = setTimeout(async () => {
        if (!ownerProcessId) return;
        const t = updatedTasks.find((x) => x.id === id);
        if (!t) return;
        try {
          await apiMutate(`/processes/${ownerProcessId}/tasks/${id}`, {
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
          // Solo refrescar métricas si el proceso sigue siendo el que se editó.
          if (procRef.current?.id === ownerProcessId) await loadMetrics(ownerProcessId);
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

    let sourceNodeId = null;
    if (selectedId) {
      const selTask = tasks.find(t => t.id === selectedId);
      if (selTask) sourceNodeId = selTask.bpmnId;
      else if (gateways.find(g => g.bpmn_id === selectedId)) sourceNodeId = selectedId;
    }
    if (!sourceNodeId && tasks.length > 0) {
      sourceNodeId = tasks[tasks.length - 1].bpmnId;
    }

    let newFlows = sequenceFlows;
    if (sourceNodeId) {
      const newFlow = {
        bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        source_ref: sourceNodeId,
        target_ref: newGw.bpmn_id,
        name: ""
      };
      newFlows = [...sequenceFlows, newFlow];
      setSequenceFlows(newFlows);
    }
    
    const newGateways = [...gateways, newGw];
    setGateways(newGateways);
    setSelectedId(newGw.bpmn_id);
    setTab("detalle");
    
    try {
      await apiMutate(`/processes/${proc.id}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: newGateways, sequence_flows: newFlows })
      });
      if (firstStepsActive && guideStep <= 4) setGuideStep(4);
    } catch (e) {
      console.error(e);
      setSaveState({ status: 'error' });
      showToast("No se pudo guardar la compuerta: " + (e.message || "error de conexión"));
    }
  };

  const updateGateway = async (id, patch) => {
    setGateways((gws) => {
      const updated = gws.map(g => g.bpmn_id === id ? { ...g, ...patch } : g);
      if (updateTaskTimeoutRefs.current[id]) clearTimeout(updateTaskTimeoutRefs.current[id]);
      
      setSaveState({ status: 'saving' });
      updateTaskTimeoutRefs.current[id] = setTimeout(async () => {
        try {
          await apiMutate(`/processes/${procRef.current?.id}/graph`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gateways: updated, sequence_flows: sequenceFlowsRef.current })
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

      let sourceNodeId = tasks.length > 0 ? tasks[tasks.length - 1].bpmnId : "start";

      // Filtrar la flecha vieja que iba de sourceNodeId a "end" para no duplicar salidas al final
      let newFlows = (sequenceFlows || []).filter(f => !(f.source_ref === sourceNodeId && f.target_ref === "end"));
      
      const newFlowToTask = {
        bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        source_ref: sourceNodeId,
        target_ref: mapped.bpmnId,
        name: ""
      };
      
      const newFlowToEnd = {
        bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        source_ref: mapped.bpmnId,
        target_ref: "end",
        name: ""
      };

      newFlows = [...newFlows, newFlowToTask, newFlowToEnd];
      setSequenceFlows(newFlows);
      
      persistGraph(gateways, newFlows, proc.id);

      setTasks((ts) => [...ts, mapped]);
      setSelectedId(mapped.id);
      setTab("detalle");
      if (tasks.length === 0 && isMobile) {
        setMobileStep(3);
      }

      // Antes la guia se cerraba sola al crear la segunda tarea, dejando al
      // usuario sin los pasos de valor, tiempos y conexiones.
      if (firstStepsActive && guideStep === 1) setGuideStep(2);
    } catch (e) {
      setError("Error al añadir tarea.");
    }
  };

  const deleteTask = async (id) => {
    if (!proc) return;
    try {
      // apiMutate lanza si el servidor responde !2xx: antes se usaba apiFetch sin
      // comprobar res.ok, así que un 403/404/500 igual borraba la tarea de la
      // pantalla y reaparecía al recargar (estado inconsistente con la BD).
      await apiMutate(`/processes/${proc.id}/tasks/${id}`, { method: "DELETE" });
      const deletedTask = tasks.find((t) => t.id === id);
      setTasks((ts) => {
        const r = ts.filter((t) => t.id !== id);
        if (id === selectedId) setSelectedId(r[0]?.id || null);
        return r;
      });
      if (deletedTask) {
        const bpmnId = deletedTask.bpmnId;
        const newFlows = sequenceFlows.filter(
          (f) => f.source_ref !== bpmnId && f.target_ref !== bpmnId &&
                 f.source_ref !== String(id) && f.target_ref !== String(id)
        );
        setSequenceFlows(newFlows);
        persistGraph(gateways, newFlows, proc.id);
      }
    } catch (e) {
      setError("Error al eliminar tarea.");
    }
  };

  const deleteGateway = async (bpmn_id) => {
    if (!proc) return;
    try {
      const newGateways = gateways.filter((g) => g.bpmn_id !== bpmn_id);
      const newFlows = sequenceFlows.filter((f) => f.source_ref !== bpmn_id && f.target_ref !== bpmn_id);
      
      setGateways(newGateways);
      setSequenceFlows(newFlows);
      if (bpmn_id === selectedId) setSelectedId(null);
      
      await apiMutate(`/processes/${proc.id}/graph`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateways: newGateways, sequence_flows: newFlows })
      });
    } catch (e) {
      setError("Error al eliminar compuerta.");
    }
  };

  const moveTask = async (id, dir) => {
    if (!proc) return;
    const i = tasks.findIndex((t) => t.id === id);
    const j = i + dir;
    if (j < 0 || j >= tasks.length) return;
    setSaveState({ status: 'saving' });
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
      setSaveState({ status: 'saved' });
      setTimeout(() => setSaveState({ status: 'idle' }), 2000);
    } catch (e) {
      setSaveState({ status: 'error' });
    }
  };

  const saveAutoSnapshot = async (label) => {
    if (!proc?.id) return false;
    try {
      const snapshot_json = {
        label: label,
        tasks: tasks,
        gateways: gateways,
        sequence_flows: sequenceFlows
      };
      const res = await apiFetch(`/processes/${proc?.id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_json })
      });
      if (!res.ok) throw new Error("Status error");
      return true;
    } catch (e) {
      showToast("No se pudo guardar el punto de retorno. Revisa tu conexión e intenta de nuevo.");
      return false;
    }
  };

  // Guardado manual de versión. El historial solo se escribía antes de acciones
  // destructivas (aplicar IA, restaurar, borrar una tarea), asi que una jornada
  // entera de edición podía no dejar ningún punto de retorno. Esto da una acción
  // explícita que no depende de que el autoguardado haya hecho su trabajo.
  const [savingVersion, setSavingVersion] = useState(false);
  const saveManualVersion = async () => {
    if (!proc?.id || savingVersion) return;
    setSavingVersion(true);
    try {
      // Primero se persiste el estado actual: la versión debe reflejar lo que
      // hay en pantalla, no lo último que alcanzó a guardar el autoguardado.
      const ok = await persistGraph(gateways, sequenceFlows, proc.id);
      if (!ok) return;
      const stamp = new Date().toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      if (await saveAutoSnapshot(`Versión guardada manualmente — ${stamp}`)) {
        showToast("Versión guardada. Puedes volver a este punto desde Versiones.");
      }
    } finally {
      setSavingVersion(false);
    }
  };

  const applyOptimized = async (optimizedFlow) => {
    if (!proc) return;
    const steps = optimizedFlow.nodes || optimizedFlow.steps || [];
    const aiFlows = optimizedFlow.flows || [];
    if (!steps.length) return;

    const ok = await confirm(
      "Aplicar flujo optimizado",
      `Esta acción eliminará las ${tasks.length} tarea(s) actuales y las reemplazará con las ${steps.length} propuestas por la IA. Los datos de RACI y sistemas deberán reasignarse. Se guardará una versión de respaldo.`,
      { confirmLabel: "Aplicar igual", danger: true }
    );
    if (!ok) return;

    setLoading(true);
    const saved = await saveAutoSnapshot("Antes de aplicar flujo optimizado IA");
    if (!saved) { setLoading(false); return; }

    const processId = procRef.current?.id;
    if (!processId) { setLoading(false); return; }

    try {
      // Eliminar tareas secuencialmente para evitar conflictos de FK
      for (const t of tasks) {
        await apiMutate(`/processes/${processId}/tasks/${t.id}`, { method: "DELETE" });
      }

      // Crear tareas del flujo optimizado
      const mapped = [];
      const bpmnIdMap = {}; // old bpmn_id → new task bpmn_id (por si Gemini reutiliza IDs)
      for (let idx = 0; idx < steps.length; idx++) {
        const s = steps[idx];
        const valClass = s.value_classification || s.valueClass || "VA";
        const wType = valClass === "NVA" ? s.waste_type || "waiting" : null;
        const newBpmn = s.bpmn_id || s.bpmnId || newBpmnId();
        bpmnIdMap[s.bpmn_id || s.bpmnId] = newBpmn;
        const res = await apiFetch(`/processes/${processId}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bpmn_id: newBpmn,
            name: s.name || s.node_name || "Paso",
            description: s.description || "",
            position_order: idx + 1,
            task_type: s.type && TYPES[s.type] ? s.type : "user",
            value_classification: valClass,
            waste_type: wType,
            std_cycle_time_sec: Number(s.cycle_time_sec) || Number(s.cycleTime) || 60,
            std_wait_time_sec: Number(s.wait_time_sec) || Number(s.waitTime) || 0,
          }),
        });
        const data = await res.json();
        mapped.push(mapBackendTaskToFrontend(data));
      }

      // Aplicar las conexiones del flujo optimizado (antes se descartaban)
      const mappedFlows = aiFlows.map((f, i) => ({
        bpmn_id: f.bpmn_id || `Flow_AI_${i}_${Date.now()}`,
        source_ref: bpmnIdMap[f.source_ref] || f.source_ref,
        target_ref: bpmnIdMap[f.target_ref] || f.target_ref,
        name: f.name || "",
        condition_expression: f.condition || null,
      }));

      setTasks(mapped);
      setSequenceFlows(mappedFlows);
      setGateways([]); // gateways del flujo original ya no aplican

      await apiMutate(`/processes/${processId}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: [], sequence_flows: mappedFlows }),
      });

      setSelectedId(mapped[0]?.id || null);
      setTab("detalle");
      setShowUndoBanner(true);
    } catch (e) {
      setSaveState({ status: "error", message: "No se pudo aplicar el flujo optimizado por completo." });
    } finally {
      setLoading(false);
    }
  };

  // Restaura una versión guardada: recrea tareas + grafo desde el snapshot frontend.
  // El restore en sí es undoable (guarda un snapshot previo). Devuelve true/false.
  const restoreSnapshot = async (snapshotJson) => {
    const processId = procRef.current?.id;
    if (!processId || !snapshotJson) return false;

    const snapTasks = Array.isArray(snapshotJson.tasks) ? snapshotJson.tasks : [];
    const snapGateways = Array.isArray(snapshotJson.gateways) ? snapshotJson.gateways : [];
    const snapFlows = Array.isArray(snapshotJson.sequence_flows) ? snapshotJson.sequence_flows : [];

    setLoading(true);
    const saved = await saveAutoSnapshot("Antes de restaurar versión");
    if (!saved) { setLoading(false); return false; }

    try {
      // Eliminar tareas actuales secuencialmente (evita conflictos de FK)
      for (const t of tasks) {
        await apiMutate(`/processes/${processId}/tasks/${t.id}`, { method: "DELETE" });
      }

      // Recrear tareas desde el snapshot (formato frontend → backend)
      const mapped = [];
      for (let idx = 0; idx < snapTasks.length; idx++) {
        const s = snapTasks[idx];
        const valClass = s.valueClass || s.value_classification || "VA";
        const res = await apiFetch(`/processes/${processId}/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bpmn_id: s.bpmnId || s.bpmn_id || newBpmnId(),
            name: s.name || "Paso",
            description: s.description || "",
            position_order: s.position_order || idx + 1,
            task_type: (s.type || s.task_type) && TYPES[s.type || s.task_type] ? (s.type || s.task_type) : "user",
            value_classification: valClass,
            waste_type: valClass === "NVA" ? (s.wasteType || s.waste_type || "waiting") : null,
            std_cycle_time_sec: Number(s.cycleTime ?? s.std_cycle_time_sec) || 0,
            std_wait_time_sec: Number(s.waitTime ?? s.std_wait_time_sec) || 0,
            responsible: s.responsible || "", accountable: s.accountable || "",
            consulted: s.consulted || "", informed: s.informed || "", systems: s.systems || "",
          }),
        });
        const data = await res.json();

        // create_task (POST) ignora los campos planos de RACI/sistemas — solo los
        // persiste update_task (PUT). Si el snapshot trae RACI/sistemas, los reponemos
        // con un PUT reusando la traducción plano→relacional del backend.
        const hasRaci = s.responsible || s.accountable || s.consulted || s.informed;
        const hasSystems = s.systems;
        if (data?.id && (hasRaci || hasSystems)) {
          await apiMutate(`/processes/${processId}/tasks/${data.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              responsible: s.responsible || "", accountable: s.accountable || "",
              consulted: s.consulted || "", informed: s.informed || "",
              systems: s.systems || "",
            }),
          });
          data.responsible = s.responsible || ""; data.accountable = s.accountable || "";
          data.consulted = s.consulted || ""; data.informed = s.informed || "";
          data.systems = s.systems || "";
        }
        mapped.push(mapBackendTaskToFrontend(data));
      }

      // Restaurar grafo (gateways + flows del snapshot)
      const cleanFlows = snapFlows.map((f, i) => ({
        bpmn_id: f.bpmn_id || `Flow_R_${i}_${Date.now()}`,
        source_ref: f.source_ref,
        target_ref: f.target_ref,
        name: f.name || "",
        condition_expression: f.condition_expression || f.condition || null,
        // Preservar las ramas Sí/No y los puntos de conexión del rombo: sin esto,
        // restaurar una versión borraba las probabilidades y reubicaba las flechas.
        branch_probability: f.branch_probability ?? null,
        source_handle: f.source_handle ?? null,
        target_handle: f.target_handle ?? null,
      }));

      setTasks(mapped);
      setGateways(snapGateways);
      setSequenceFlows(cleanFlows);
      await apiMutate(`/processes/${processId}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: snapGateways, sequence_flows: cleanFlows }),
      });

      setSelectedId(mapped[0]?.id || null);
      setTab("detalle");
      return true;
    } catch (e) {
      setSaveState({ status: "error", message: "No se pudo restaurar la versión por completo." });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // local nva count calculation since metricsData might not have it explicitly as a simple count
  const localNvaCount = tasks.filter((t) => t.valueClass === "NVA").length;

  // #7 Validación de integridad del grafo: detecta nodos aislados, sin salida,
  // sin entrada y compuertas sin ramificar. No bloquea — informa para corregir.
  const flowIssues = useMemo(() => {
    const issues = [];
    const flows = sequenceFlows || [];
    const hasOut = (id) => flows.some((f) => f.source_ref === id);
    const hasIn = (id) => flows.some((f) => f.target_ref === id);
    if (tasks.length === 0) return issues;
    for (const t of tasks) {
      const id = t.bpmnId;
      const out = hasOut(id), inc = hasIn(id);
      if (!out && !inc) issues.push({ type: "isolated", name: t.name, sev: "high" });
      else if (!out) issues.push({ type: "deadend", name: t.name, sev: "high" });
      else if (!inc) issues.push({ type: "unreachable", name: t.name, sev: "medium" });
    }
    for (const g of gateways || []) {
      const branches = flows.filter((f) => f.source_ref === g.bpmn_id).length;
      if (branches < 2) issues.push({ type: "gateway", name: g.name || "Compuerta", sev: "medium" });
    }
    return issues;
  }, [tasks, gateways, sequenceFlows]);

  // Firma del conjunto de problemas: si cambia (aparecen/desaparecen problemas),
  // el aviso vuelve a mostrarse aunque el usuario lo hubiera cerrado antes.
  const flowIssuesSig = useMemo(
    () => flowIssues.map((i) => `${i.type}:${i.name}`).join("|"),
    [flowIssues]
  );
  const showFlowIssues = flowIssues.length > 0 && dismissedIssuesSig !== flowIssuesSig;

  const getOutgoingTarget = useCallback((bpmnId) => {
    const flows = (sequenceFlows || []).filter(f => f.source_ref === bpmnId);
    return flows.length > 0 ? flows[0].target_ref : "";
  }, [sequenceFlows]);

  // Las compuertas tienen varias salidas. El selector unico las reemplazaba
  // todas por una, asi que definir una rama borraba la otra ya configurada; por
  // eso la unica forma de quitar una linea sobrante era borrar la compuerta.
  // Aqui la rama se anade sin tocar las demas (se quitan una a una desde
  // "Ramas de salida" en el panel de detalle).
  const addOutgoingTarget = useCallback((sourceBpmnId, newTarget) => {
    if (!newTarget || newTarget === sourceBpmnId) return;
    const flows = sequenceFlows || [];
    if (flows.some(f => f.source_ref === sourceBpmnId && f.target_ref === newTarget)) {
      showToast("Esa rama ya existe.");
      return;
    }
    const newFlows = [...flows, {
      bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      source_ref: sourceBpmnId,
      target_ref: newTarget,
      name: ""
    }];
    setSequenceFlows(newFlows);
    persistGraph(gateways || [], newFlows, proc.id);
  }, [sequenceFlows, gateways, proc, persistGraph, showToast]);

  const setOutgoingTarget = useCallback((sourceBpmnId, newTarget) => {
    let newFlows = [...(sequenceFlows || [])];
    if (!newTarget) {
      newFlows = newFlows.filter(f => f.source_ref !== sourceBpmnId);
    } else {
      newFlows = newFlows.filter(f => f.source_ref !== sourceBpmnId);
      newFlows.push({
        bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        source_ref: sourceBpmnId,
        target_ref: newTarget,
        name: ""
      });
    }
    setSequenceFlows(newFlows);
    persistGraph(gateways || [], newFlows, proc.id);
  }, [sequenceFlows, gateways, proc]);

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
        if (res.status === 429) {
          throw new Error("Has excedido el límite de consultas a la IA. Por favor, espera 1 minuto y vuelve a intentarlo.");
        }
        const errorData = await res.json().catch(() => ({}));
        let errMsg = errorData.detail?.message || errorData.detail || "Error en el motor de optimización.";
        if (typeof errMsg !== 'string') errMsg = JSON.stringify(errMsg);
        if (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('503 UNAVAILABLE') || errMsg.includes('excepcional demand')) {
          errMsg = "Los servidores de IA de Google están saturados en este momento. Por favor, espera unos minutos e inténtalo de nuevo.";
        }
        throw new Error(errMsg);
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
      const res = await apiFetch(`/macroprocesses/${mId}/optimize`, { method: "POST" });
      clearTimeout(t);
      setMacroLongLoading(prev => ({ ...prev, [mId]: false }));
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Has excedido el límite de consultas a la IA. Por favor, espera 1 minuto y vuelve a intentarlo.");
        }
        const errorData = await res.json().catch(() => ({}));
        let errMsg = errorData.detail?.message || errorData.detail || "Error en el motor de optimización macro.";
        if (typeof errMsg !== 'string') errMsg = JSON.stringify(errMsg);
        if (errMsg.includes('429') || errMsg.includes('Too Many Requests') || errMsg.includes('503 UNAVAILABLE') || errMsg.includes('excepcional demand')) {
          errMsg = "Los servidores de IA de Google están saturados en este momento. Por favor, espera unos minutos e inténtalo de nuevo.";
        }
        throw new Error(errMsg);
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
      showToast("Error al exportar BPMN: " + e.message);
    }
  }

  // Lleva al usuario al paso que menciona una recomendacion. La IA se limita a
  // orientar, asi que el atajo es "ver donde", no "hacerlo por ti".
  const focusNodeByBpmnId = useCallback((bpmnId) => {
    if (!bpmnId) return;
    const task = tasks.find(t => t.bpmnId === bpmnId || String(t.id) === String(bpmnId));
    const gw = (gateways || []).find(g => g.bpmn_id === bpmnId);
    if (!task && !gw) {
      showToast("Ese paso ya no existe en el proceso.");
      return;
    }
    setSelectedId(task ? task.id : gw.bpmn_id);
    setTab("detalle");
    setMobileStep(3);
  }, [tasks, gateways, showToast]);

  const onNodeSelect = useCallback((taskId) => {
    if (taskId === "start" || taskId === "end") {
      setSelectedId(null);
      setMobileStep(1);
      setTimeout(() => {
        const ph = taskId === "start" ? "Evento de inicio" : "Resultado final";
        const input = document.querySelector(`input[placeholder^="${ph}"]`);
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }
    setSelectedId(taskId);
    setTab("detalle");
    setMobileStep(3);
  }, []);

  
  const handleApplyRecommendation = async (rec, markAsApplied) => {
    const tBpmnId = rec.target_node_bpmn_id;
    const task = tasks.find(t => t.bpmnId === tBpmnId || t.id.toString() === tBpmnId);
    const processId = procRef.current?.id;
    if (!processId) return;

    if (rec.action_type === 'ELIMINATE') {
      if (!task) return;
      const ok = await confirm(
        "Eliminar tarea",
        `¿Eliminar "${task.name}" del flujo? Se intentará reconectar el paso anterior con el siguiente.`,
        { danger: true, confirmLabel: "Eliminar" }
      );
      if (!ok) return;

      setLoading(true);
      const saved = await saveAutoSnapshot(`Antes de eliminar: ${task.name}`);
      if (!saved) { setLoading(false); return; }

      try {
        await apiMutate(`/processes/${processId}/tasks/${task.id}`, { method: "DELETE" });
        setTasks(ts => ts.filter(t => t.id !== task.id));

        const currentFlows = sequenceFlowsRef.current;
        const incoming = currentFlows.find(f => f.target_ref === tBpmnId);
        const outgoing = currentFlows.find(f => f.source_ref === tBpmnId);
        let newFlows = currentFlows.filter(f => f.source_ref !== tBpmnId && f.target_ref !== tBpmnId);
        if (incoming && outgoing) {
          // Fix: usar bpmn_id, no id — el backend PUT /graph lo requiere
          newFlows.push({
            bpmn_id: `Flow_${Date.now()}`,
            source_ref: incoming.source_ref,
            target_ref: outgoing.target_ref,
            name: "",
          });
        }
        setSequenceFlows(newFlows);
        await apiMutate(`/processes/${processId}/graph`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gateways, sequence_flows: newFlows })
        });
        markAsApplied();
        setShowUndoBanner(true);
      } catch (e) {
        setSaveState({ status: "error", message: "No se pudo eliminar la tarea." });
      } finally {
        setLoading(false);
      }

    } else if (rec.action_type === 'MERGE') {
      // MERGE requiere decisión del usuario: mostrar guía, no ejecutar ciegamente
      setAiTip({ rec, markAsApplied });
      if (task) { setSelectedId(task.id); setTab("detalle"); if (isMobile) setMobileStep(3); }

    } else {
      // AUTOMATE, SIMPLIFY, PARALLELIZE, REASSIGN, STANDARDIZE
      // Son instrucciones cualitativas — guiar al usuario en el panel de detalle
      if (task) { setSelectedId(task.id); setTab("detalle"); if (isMobile) setMobileStep(3); }
      setAiTip({ rec, markAsApplied });
    }
  };

  // Loading screen
  if (loading && !proc && allProcesses.length === 0) {
    return (
      <div className="pa-loading-screen" style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--ink)", color: "#EAF1EF", fontFamily: "sans-serif",
      }}>
        <Loader2 size={40} className="spin" style={{ color: "var(--teal)", marginBottom: "16px" }} />
        <div>Iniciando y conectando con el backend...</div>
      </div>
    );
  }

  // Error screen
  if (error && !proc && allProcesses.length === 0) {
    return (
      <div className="pa-loading-screen" style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--ink)", color: "#EAF1EF", fontFamily: "sans-serif", gap: 16,
      }}>
        <AlertTriangle size={40} style={{ color: "#D9503C" }} />
        <div style={{ maxWidth: 400, textAlign: "center" }}>{error}</div>
        <button className="pa-btn pa-btn-primary" onClick={loadProcesses}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="pa-root">
      <WelcomeModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
      {confirmDialog}
      {inputDialog}
      {firstStepsActive && <GuideTicket step={guideStep} onStep={setGuideStep} onDismiss={dismissGuide} />}
      <ConsultAssistantModal
        isOpen={consultAssistantOpen}
        onClose={() => setConsultAssistantOpen(false)}
        processId={proc?.id}
      />
      {toast && (
        <div className={"pa-toast " + toast.type} role="alert">
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Cerrar aviso"><X size={14} /></button>
        </div>
      )}
      {(view === "dashboard" || proc) && (
        <button
          className={"pa-fab" + (consultAssistantOpen ? " open" : "")}
          onClick={() => setConsultAssistantOpen(o => !o)}
          aria-label={consultAssistantOpen ? "Cerrar asistente" : "Abrir asistente de consultas IA"}
        >
          {!consultAssistantOpen && <span className="pa-fab-tip">¿Necesitas ayuda?</span>}
          {consultAssistantOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>
      )}
      <SnapshotsModal
        isOpen={snapshotsModalOpen}
        onClose={() => setSnapshotsModalOpen(false)}
        processId={proc?.id}
        onRestore={restoreSnapshot}
        confirm={confirm}
        onRestoreComplete={() => {
          setShowUndoBanner(false);
        }}
      />

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
                  <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Admin</span>
                )}
              </div>
              <button className="pa-btn pa-btn-ghost" onClick={() => setShowTutorial(true)} title="Ver Tutorial">
                <Info size={16} /> <span style={{ fontSize: '12px', fontWeight: 600 }}>Tutorial</span>
              </button>
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
          <div className="pa-topbar">
            <div className="pa-editor-topbar-inner">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <button className="pa-btn pa-btn-ghost pa-btn-icon-only" onClick={goBackToDashboard} aria-label="Volver"><ArrowLeft size={16} /></button>

                {!isMobile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', minWidth: 0 }}>
                    <span className="pa-editor-breadcrumb-trail" style={{ display: 'contents' }}>
                      <span style={{ cursor: 'pointer', color: 'var(--teal)', fontWeight: 500, whiteSpace: 'nowrap' }} onClick={goBackToDashboard}>Mis procesos</span>
                      <span style={{ opacity: 0.5, flexShrink: 0 }}>/</span>
                      <span style={{ cursor: 'pointer', color: 'var(--teal)', fontWeight: 500, whiteSpace: 'nowrap' }} onClick={goBackToDashboard}>
                        {macroprocesses.find(m => m.id === proc.macroprocess_id)?.name || "General"}
                      </span>
                      <span style={{ opacity: 0.5, flexShrink: 0 }}>/</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: 16, color: 'var(--inv)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{proc.name}</h2>
                      {proc.code && <span className="pa-tag" style={{ margin: 0, color: 'var(--ink)', flexShrink: 0 }}>{proc.code}</span>}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--inv)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proc.name || "Proceso"}</h2>
                    <span style={{ fontSize: 11, color: 'var(--inv-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {macroprocesses.find(m => m.id === proc.macroprocess_id)?.name || "General"}{proc.code ? ` · ${proc.code}` : ''}
                    </span>
                  </div>
                )}
              </div>
              {!isMobile ? (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="pa-btn pa-btn-ghost pa-btn-sm" title="Ver tutorial" onClick={() => setShowTutorial(true)} aria-label="Tutorial">
                    <Info size={16} /><span className="pa-editor-action-label"> Tutorial</span>
                  </button>
                  <button className="pa-btn pa-btn-ghost pa-btn-sm" onClick={restartGuide}
                    title="Te acompaña paso a paso mientras construyes el proceso" aria-label="Practicar paso a paso">
                    <Lightbulb size={16} /><span className="pa-editor-action-label"> Practicar</span>
                  </button>
                  <button className="pa-btn pa-btn-ghost pa-btn-sm" onClick={saveManualVersion} disabled={savingVersion}
                    title="Guarda una versión del proceso tal como está ahora" aria-label="Guardar versión">
                    {savingVersion ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                    <span className="pa-editor-action-label"> Guardar versión</span>
                  </button>
                  <button className="pa-btn pa-btn-ghost pa-btn-sm" onClick={() => setSnapshotsModalOpen(true)} aria-label="Versiones">
                    <Clock size={16} /><span className="pa-editor-action-label"> Versiones</span>
                  </button>
                  <button className="pa-btn pa-btn-ghost pa-btn-sm" onClick={exportBpmn} aria-label="Exportar BPMN">
                    <Download size={16} /><span className="pa-editor-action-label"> .bpmn</span>
                  </button>
                  <button className="pa-btn pa-btn-ghost pa-btn-sm" title="Reporte imprimible del proceso (PDF)" aria-label="Reporte"
                    onClick={() => {
                      const ok = openProcessReport({ proc, tasks, gateways, sequenceFlows, metricsData, macroName: macroprocesses.find(mm => mm.id === proc.macroprocess_id)?.name });
                      if (!ok) showToast("El navegador bloqueó la ventana del reporte. Permite pop-ups para este sitio.");
                    }}>
                    <FileText size={16} /><span className="pa-editor-action-label"> Reporte</span>
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button className="pa-btn pa-btn-ghost pa-btn-icon-only" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Más acciones" aria-haspopup="menu" aria-expanded={mobileMenuOpen}>
                    <MoreVertical size={18} />
                  </button>
                  {mobileMenuOpen && (
                    <>
                      <div onClick={() => setMobileMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                      <div role="menu" className="pa-editor-menu">
                        <button role="menuitem" onClick={() => { setShowTutorial(true); setMobileMenuOpen(false); }}>
                          <Info size={16} /> Tutorial
                        </button>
                        <button role="menuitem" onClick={() => { restartGuide(); setMobileMenuOpen(false); }}>
                          <Lightbulb size={16} /> Practicar paso a paso
                        </button>
                        <button role="menuitem" onClick={() => { saveManualVersion(); setMobileMenuOpen(false); }}>
                          <Check size={16} /> Guardar versión
                        </button>
                        <button role="menuitem" onClick={() => { setSnapshotsModalOpen(true); setMobileMenuOpen(false); }}>
                          <Clock size={16} /> Versiones
                        </button>
                        <button role="menuitem" onClick={() => { exportBpmn(); setMobileMenuOpen(false); }}>
                          <Download size={16} /> Exportar .bpmn
                        </button>
                        <button role="menuitem" onClick={() => {
                          const ok = openProcessReport({ proc, tasks, gateways, sequenceFlows, metricsData, macroName: macroprocesses.find(mm => mm.id === proc.macroprocess_id)?.name });
                          if (!ok) showToast("El navegador bloqueó la ventana del reporte. Permite pop-ups para este sitio.");
                          setMobileMenuOpen(false);
                        }}>
                          <FileText size={16} /> Reporte (PDF)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {showUndoBanner && (
            <Banner
              type="success"
              message="Optimización aplicada con éxito."
              actionText="Deshacer"
              onAction={() => setSnapshotsModalOpen(true)}
              onClose={() => setShowUndoBanner(false)}
            />
          )}

          {isMobile && (
            <div className="pa-mobile-nav">
              <button className={mobileStep === 1 ? 'on' : ''} onClick={() => setMobileStep(1)}>1. Tareas</button>
              <button className={mobileStep === 2 ? 'on' : ''} onClick={() => setMobileStep(2)}>2. Diagrama</button>
              <button className={mobileStep === 3 && tab === "detalle" ? 'on' : ''} onClick={() => { setMobileStep(3); setTab("detalle"); }}>3. Detalle</button>
              <button className={mobileStep === 4 || (mobileStep === 3 && tab === "optim") ? 'on' : ''} onClick={() => { setMobileStep(4); setTab("optim"); }}>4. IA</button>
            </div>
          )}

          <div className={"pa-shell" + (isDesktopWide && leftCollapsed ? " pa-left-collapsed" : "") + (isDesktopWide && rightCollapsed ? " pa-right-collapsed" : "")}>
            {isDesktopWide && leftCollapsed && (
              <div className="pa-rail pa-rail-left" onClick={() => setLeftCollapsed(false)} title="Expandir panel del proceso">
                <button className="pa-rail-btn" aria-label="Expandir panel del proceso"><ChevronRight size={16} /></button>
                <span className="pa-rail-label">Proceso · Tareas</span>
              </div>
            )}
            {(!isMobile || mobileStep === 1) && !(isDesktopWide && leftCollapsed) && (
            <aside className="pa-side">
              <div className="pa-side-sec">
                <div className="pa-side-title">
                  Proceso
                  {isDesktopWide && (
                    <button className="pa-collapse-btn" onClick={() => setLeftCollapsed(true)} aria-label="Encoger panel del proceso" title="Encoger panel">
                      <ChevronLeft size={15} />
                    </button>
                  )}
                </div>
                <input className="pa-input ink" value={proc.name || ""} onChange={(e) => setProcField("name", e.target.value)} placeholder="Nombre del proceso" />
                <input className="pa-input ink mono" value={proc.code || ""} onChange={(e) => setProcField("code", e.target.value)} placeholder="Código" />
                <textarea className="pa-input ink" rows={2} value={proc.objective || ""} onChange={(e) => setProcField("objective", e.target.value)} placeholder="Objetivo" />
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  SIPOC — Límites del Proceso
                </div>
                <input className="pa-input ink" value={proc.suppliers || ""} onChange={(e) => setProcField("suppliers", e.target.value)} placeholder="Proveedores — quién entrega las entradas" title="S (Suppliers): quién provee lo que necesita el proceso" />
                <input className="pa-input ink" value={proc.trigger_event || ""} onChange={(e) => setProcField("trigger_event", e.target.value)} placeholder="Entrada / evento de inicio (Ej: Recibe solicitud)" title="I (Inputs): lo que entra y dispara el proceso" />
                <input className="pa-input ink" value={proc.output_result || ""} onChange={(e) => setProcField("output_result", e.target.value)} placeholder="Salida / resultado final (Ej: Cliente aprobado)" title="O (Outputs): lo que el proceso entrega" />
                <input className="pa-input ink" value={proc.customers || ""} onChange={(e) => setProcField("customers", e.target.value)} placeholder="Clientes — quién recibe el resultado" title="C (Customers): quién recibe la salida del proceso" />
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volumen</div>
                <input className="pa-input ink mono" type="number" min="0" value={proc.monthly_volume ?? ""} onChange={(e) => setProcField("monthly_volume", e.target.value)} placeholder="Ejecuciones por mes (Ej: 500)" />
              </div>

              <div className="pa-side-sec grow">
                <div className="pa-side-title">Tareas <span className="pa-count">{tasks.length}</span></div>
                <div className="pa-steplist">
                  {tasks.map((t, i) => (
                    <div key={t.id} className={"pa-step" + (t.id === selectedId ? " sel" : "")}>
                      {/* Dos filas: el paso arriba y su direccion debajo. En una sola fila el
                          <select> no podia encogerse por debajo del ancho de su contenido y
                          terminaba montado sobre el nombre del paso. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div onClick={() => { setSelectedId(t.id); setTab("detalle"); setMobileStep(3); }} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <span className="pa-step-bar" style={{ background: VALUE[t.valueClass]?.color || "#EEF3F0" }} />
                        <span className="pa-step-n mono">{String(i + 1).padStart(2, "0")}</span>
                        <span className="pa-step-name">{t.name}</span>
                        <span className="pa-step-t mono">{fmtShort((Number(t.cycleTime) || 0) + (Number(t.waitTime) || 0))}</span>
                      </div>
                      <button onClick={async (e) => { e.stopPropagation(); const ok = await confirm("Eliminar tarea", `\u00bfEliminar "${t.name}"?`, { danger: true }); if (ok) deleteTask(t.id); }} title="Eliminar tarea" aria-label="Eliminar tarea" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--inv-muted)", padding: 4, display: "flex", flexShrink: 0, borderRadius: 6 }}><Trash2 size={14} /></button>
                      </div>
                      <div className="pa-step-dir">
                        <span className="pa-step-dir-label">Continua en</span>
                        <select
                           value={getOutgoingTarget(t.bpmnId)}
                           onChange={(e) => setOutgoingTarget(t.bpmnId, e.target.value)}
                           aria-label={`Siguiente paso despues de ${t.name}`}
                           onClick={(e) => e.stopPropagation()}
                        >
                           <option value="">(Desconectado)</option>
                           <option value="end">🏁 Fin</option>
                           {tasks.filter(tk => tk.id !== t.id).map((tk) => {
                             const tIdx = String(tasks.findIndex(x => x.id === tk.id) + 1).padStart(2, "0");
                             return <option key={tk.bpmnId} value={tk.bpmnId}>{tIdx}. {tk.name}</option>
                           })}
                           {gateways.map(g => <option key={g.bpmn_id} value={g.bpmn_id}>{g.name || "Compuerta"}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                {gateways && gateways.length > 0 && (
                  <>
                    <div className="pa-side-title" style={{ marginTop: '16px' }}>Compuertas <span className="pa-count">{gateways.length}</span></div>
                    <div className="pa-steplist">
                      {gateways.map((g) => (
                        <div key={g.bpmn_id} className={"pa-step" + (g.bpmn_id === selectedId ? " sel" : "")}>
                          {/* Dos filas: el paso arriba y su direccion debajo. En una sola fila el
                              <select> no podia encogerse por debajo del ancho de su contenido y
                              terminaba montado sobre el nombre del paso. */}
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div onClick={() => { setSelectedId(g.bpmn_id); setTab("detalle"); setMobileStep(3); }} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, cursor: "pointer" }}>
                            <span className="pa-step-bar" style={{ background: "#8C8C8C" }} />
                            <span className="pa-step-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Compuerta"}</span>
                            <span className="pa-step-t mono">{g.node_type === "exclusiveGateway" ? "EXC" : "PAR"}</span>
                          </div>
                          <button onClick={async (e) => { e.stopPropagation(); const ok = await confirm("Eliminar compuerta", `\u00bfEliminar "${g.name || 'esta compuerta'}"?`, { danger: true }); if (ok) deleteGateway(g.bpmn_id); }} title="Eliminar compuerta" aria-label="Eliminar compuerta" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--inv-muted)", padding: 4, display: "flex", flexShrink: 0, borderRadius: 6 }}><Trash2 size={14} /></button>
                          </div>
                          <div className="pa-step-dir">
                            <span className="pa-step-dir-label">
                              {(sequenceFlows || []).filter(f => f.source_ref === g.bpmn_id).length} ramas
                            </span>
                            <select
                               value=""
                               onChange={(e) => { addOutgoingTarget(g.bpmn_id, e.target.value); e.target.value = ""; }}
                               aria-label={`Anadir una rama de salida a la compuerta ${g.name || "sin nombre"}`}
                               onClick={(e) => e.stopPropagation()}
                            >
                               <option value="">+ Anadir rama hacia...</option>
                               <option value="end">🏁 Fin</option>
                               {tasks.map(tk => {
                                 const tIdx = String(tasks.findIndex(x => x.id === tk.id) + 1).padStart(2, "0");
                                 return <option key={tk.bpmnId} value={tk.bpmnId}>{tIdx}. {tk.name}</option>
                               })}
                               {gateways.filter(gx => gx.bpmn_id !== g.bpmn_id).map(gx => <option key={gx.bpmn_id} value={gx.bpmn_id}>{gx.name || "Compuerta"}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="pa-side-cta">
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <button className="pa-btn pa-btn-ghost" style={{ width: '100%' }} onClick={() => { addTask(); if(isMobile) setMobileStep(3); }}>
                        <Plus size={14} /> Tarea
                      </button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <button className="pa-btn pa-btn-ghost" style={{ width: '100%' }} onClick={addGateway}><Plus size={14} /> Compuerta</button>
                    </div>
                  </div>
                  <button className="pa-btn pa-btn-primary full" onClick={() => { setTab("optim"); if (isMobile) setMobileStep(4); if(firstStepsActive && guideStep === 5) dismissGuide(); }}>
                    <Sparkles size={16} /> 4. Ir a Optimización IA
                  </button>
                </div>
              </div>
            </aside>
            )}

            {(!isMobile || mobileStep === 2 || mobileStep === 3 || mobileStep === 4) && (
            <main className="pa-main">
              {(!isMobile || mobileStep === 2) && (
              <div className="pa-diagram-wrapper" style={{ position: 'relative' }}>
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
                  onConnectionRejected={showToast}
                  onGraphChange={async (newGateways, newFlows) => {
                    setGateways(newGateways);
                    setSequenceFlows(newFlows);
                    if (firstStepsActive && guideStep >= 4) setGuideStep(5);
                    await persistGraph(newGateways, newFlows, proc.id);
                  }}
                  onLayoutChange={saveLayout}
                />
              </div>

              {showFlowIssues && (
                <div style={{ background: '#FFF8EC', border: '1px solid #F0C040', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>
                    <strong>{flowIssues.length} {flowIssues.length === 1 ? 'problema' : 'problemas'} de conexión en el flujo</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
                      {flowIssues.slice(0, 5).map((iss, k) => (
                        <li key={k}>
                          <b>{iss.name}</b>: {
                            iss.type === 'isolated' ? 'nodo aislado (sin entrada ni salida)' :
                            iss.type === 'deadend' ? 'sin salida (callejón sin salida)' :
                            iss.type === 'unreachable' ? 'sin entrada (inalcanzable desde el inicio)' :
                            'compuerta sin ramificar (necesita 2+ salidas)'
                          }
                        </li>
                      ))}
                      {flowIssues.length > 5 && <li>…y {flowIssues.length - 5} más</li>}
                    </ul>
                    <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.85 }}>Conecta los nodos arrastrando desde sus bordes para corregirlos.</div>
                  </div>
                  <button onClick={() => setDismissedIssuesSig(flowIssuesSig)} aria-label="Cerrar aviso de problemas de conexión"
                    title="Cerrar aviso"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0, display: 'flex', alignSelf: 'flex-start' }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="pa-metrics">
                <div className="pa-metric"><span>Lead time</span><b className="mono">{metricsData ? fmtLong(metricsData.lead_time_sec) : '-'}</b></div>
                <div className="pa-metric"><span>Tiempo de ciclo</span><b className="mono">{metricsData ? fmtLong(metricsData.total_cycle_time_sec) : '-'}</b></div>
                <div className="pa-metric"><span>Tiempo de espera</span><b className="mono">{metricsData ? fmtLong(metricsData.total_wait_time_sec) : '-'}</b></div>
                <div className="pa-metric"><span>Pasos NVA</span><b className="mono" style={{ color: localNvaCount ? VALUE.NVA.color : undefined }}>{localNvaCount}</b></div>
                <div className="pa-metric wide">
                  <span>Eficiencia de ciclo (VA) <b className="mono">{metricsData ? Math.round(metricsData.pce_percentage) : 0}%</b></span>
                </div>
              </div>

              {/* TOC: la restricción siempre existe (el paso más lento fija el ritmo). */}
              {metricsData?.constraint && (
                <div className="pa-metrics">
                  <div className="pa-metric wide" style={{ gridColumn: 'span 5', borderColor: 'var(--teal-border-strong)', background: 'var(--teal-tint)' }}>
                    <span style={{ display: 'block' }}>
                      <b style={{ color: 'var(--teal-deep)' }}>Restricción del sistema (TOC):</b>{' '}
                      <b>{metricsData.constraint.name}</b> — es el paso más lento ({fmtLong(metricsData.constraint.cycle_time_sec)}) y por eso marca el ritmo máximo de todo el proceso
                      {metricsData.constraint.theoretical_throughput_per_hour != null
                        ? `: ${metricsData.constraint.theoretical_throughput_per_hour.toFixed(1)} unidades/hora.`
                        : '.'}
                      {' '}Acelerar cualquier otro paso no aumenta la capacidad total.
                    </span>
                  </div>
                </div>
              )}

              {metricsData?.is_branch_weighted && (
                <div className="pa-metrics">
                  <div className="pa-metric"><span>Lead time (camino principal)</span><b className="mono">{metricsData.main_path_lead_time_sec != null ? fmtLong(metricsData.main_path_lead_time_sec) : '—'}</b></div>
                  <div className="pa-metric wide" style={{ gridColumn: 'span 4' }}>
                    <span>Con compuertas de decisión, el lead time y el costo son <b>valores esperados</b> ponderados por la probabilidad de cada rama. El camino principal sigue la rama más probable en cada decisión.</span>
                  </div>
                </div>
              )}

              {metricsData?.cost && (metricsData.cost.total_cost > 0 || metricsData.cost.monthly_cost) && (
                <div className="pa-metrics">
                  <div className="pa-metric"><span>Costo por ejecución</span><b className="mono">{fmtMoney(metricsData.cost.total_cost)}</b></div>
                  {metricsData.cost.monthly_cost != null ? (
                    <>
                      <div className="pa-metric"><span>Costo mensual</span><b className="mono">{fmtMoney(metricsData.cost.monthly_cost)}</b></div>
                      <div className="pa-metric"><span>Costo anual</span><b className="mono">{fmtMoney(metricsData.cost.annual_cost)}</b></div>
                      <div className="pa-metric"><span>Desperdicio anual (NVA)</span><b className="mono" style={{ color: metricsData.cost.monthly_nva_cost ? VALUE.NVA.color : undefined }}>{fmtMoney((metricsData.cost.monthly_nva_cost || 0) * 12)}</b></div>
                    </>
                  ) : (
                    <div className="pa-metric wide"><span>Define el <b>volumen mensual</b> del proceso para proyectar costo mensual y anual.</span></div>
                  )}
                </div>
              )}

              <VSMLadder metrics={metricsData} />
              </div>
              )}

              {!isDesktopWide && (!isMobile || mobileStep === 3 || mobileStep === 4) && (
              <div className="pa-panel" style={{ marginTop: 16 }}>
                {!isMobile && (
                  <div className="pa-tabs">
                    <button className={tab === "detalle" ? "on" : ""} onClick={() => setTab("detalle")}><Gauge size={15} /> Detalle del paso</button>
                    <button className={tab === "optim" ? "on" : ""} onClick={() => setTab("optim")}><Lightbulb size={15} /> Optimización IA</button>
                  </div>
                )}
                <div className="pa-panel-body">
                  {tab === "detalle" && aiTip && selectedTask &&
                    (selectedTask.bpmnId === aiTip.rec.target_node_bpmn_id || selectedTask.id.toString() === aiTip.rec.target_node_bpmn_id) && (
                    <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F0FAFA', border: '1px solid var(--teal)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            Recomendación IA — {ACTION[aiTip.rec.action_type]?.label || aiTip.rec.action_type}
                          </div>
                          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--ink)' }}>{aiTip.rec.description}</p>
                          {aiTip.rec.expected_benefit && (
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Beneficio: {aiTip.rec.expected_benefit}</div>
                          )}
                          {aiTip.rec.action_type === 'MERGE' && (
                            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                              Para fusionar: edita esta tarea incorporando las actividades de la tarea a eliminar, luego elimina esa tarea desde la lista.
                            </div>
                          )}
                        </div>
                        <button onClick={() => setAiTip(null)} aria-label="Descartar sugerencia"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
                          <X size={15} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="pa-btn pa-btn-primary pa-btn-sm"
                          onClick={() => { aiTip.markAsApplied(); setAiTip(null); }}>
                          <Check size={13} /> Marcar como aplicada
                        </button>
                        <button className="pa-btn pa-btn-ghost pa-btn-sm"
                          onClick={() => setAiTip(null)}>
                          Descartar
                        </button>
                      </div>
                    </div>
                  )}
                  {tab === "detalle" ? (
                    selectedTask ? (
                      <Editor task={selectedTask} onChange={updateTask} onMove={moveTask} onDelete={deleteTask}
                        processId={proc?.id}
                        isFirst={selectedTask ? tasks[0]?.id === selectedTask.id : true}
                        isLast={selectedTask ? tasks[tasks.length - 1]?.id === selectedTask.id : true} 
                        saveState={saveState} expertMode={expertMode} setExpertMode={setExpertMode}
                        sequenceFlows={sequenceFlows} gateways={gateways} tasks={tasks} onForceSave={flushAllSaves}
                        firstStepsActive={firstStepsActive} guideStep={guideStep}
                        onGuideComplete={() => {
                          if (firstStepsActive && guideStep === 2) {
                            setGuideStep(3);
                          }
                        }}
                        onFlowsChange={(newFlows) => {
                          setSequenceFlows(newFlows);
                          persistGraph(gateways, newFlows, proc.id);
                        }}
                        onDone={() => { if (isMobile) setMobileStep(2); else setSelectedId(null); }} />
                    ) : selectedGateway ? (
                      <GatewayEditor gateway={selectedGateway} onChange={updateGateway} onDelete={deleteGateway} processId={proc?.id}
                        saveState={saveState} sequenceFlows={sequenceFlows} tasks={tasks} gateways={gateways}
                        onFlowsChange={(newFlows) => {
                          setSequenceFlows(newFlows);
                          persistGraph(gateways, newFlows, proc.id).then((ok) => { if (ok) loadMetrics(proc.id); });
                        }}
                        onDone={() => { if (isMobile) setMobileStep(2); else setSelectedId(null); }} />
                    ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      Selecciona un nodo para ver sus detalles.
                    </div>
                  )
                ) : (
                  <Optimization state={opt} onRun={runOptimize} onApply={applyOptimized} tasks={tasks} onApplyRecommendation={handleApplyRecommendation} onFocusNode={focusNodeByBpmnId} />
                )}
              </div>
            </div>
            )}
          </main>
          )}

          {isDesktopWide && rightCollapsed && (
            <div className="pa-rail pa-rail-right" onClick={() => setRightCollapsed(false)} title="Expandir panel de detalle">
              <button className="pa-rail-btn" aria-label="Expandir panel de detalle"><ChevronLeft size={16} /></button>
              <span className="pa-rail-label">Detalle · IA</span>
            </div>
          )}
          {isDesktopWide && !rightCollapsed && (
          <aside className="pa-detail">
            <div className="pa-panel">
              <div className="pa-detail-tabbar">
                <button className="pa-collapse-btn pa-detail-collapse" onClick={() => setRightCollapsed(true)} aria-label="Encoger panel de detalle" title="Encoger panel">
                  <ChevronRight size={16} />
                </button>
                <div className="pa-tabs">
                  <button className={tab === "detalle" ? "on" : ""} onClick={() => setTab("detalle")}><Gauge size={15} /> Detalle del paso</button>
                  <button className={tab === "optim" ? "on" : ""} onClick={() => setTab("optim")}><Lightbulb size={15} /> Optimización IA</button>
                </div>
              </div>
              <div className="pa-panel-body">
                {tab === "detalle" && aiTip && selectedTask &&
                  (selectedTask.bpmnId === aiTip.rec.target_node_bpmn_id || selectedTask.id.toString() === aiTip.rec.target_node_bpmn_id) && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F0FAFA', border: '1px solid var(--teal)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                          Recomendación IA — {ACTION[aiTip.rec.action_type]?.label || aiTip.rec.action_type}
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--ink)' }}>{aiTip.rec.description}</p>
                        {aiTip.rec.expected_benefit && (
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Beneficio: {aiTip.rec.expected_benefit}</div>
                        )}
                        {aiTip.rec.action_type === 'MERGE' && (
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                            Para fusionar: edita esta tarea incorporando las actividades de la tarea a eliminar, luego elimina esa tarea desde la lista.
                          </div>
                        )}
                      </div>
                      <button onClick={() => setAiTip(null)} aria-label="Descartar sugerencia"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}>
                        <X size={15} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="pa-btn pa-btn-primary pa-btn-sm"
                        onClick={() => { aiTip.markAsApplied(); setAiTip(null); }}>
                        <Check size={13} /> Marcar como aplicada
                      </button>
                      <button className="pa-btn pa-btn-ghost pa-btn-sm"
                        onClick={() => setAiTip(null)}>
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
                {tab === "detalle" ? (
                  selectedTask ? (
                    <Editor task={selectedTask} onChange={updateTask} onMove={moveTask} onDelete={deleteTask}
                      processId={proc?.id}
                      isFirst={selectedTask ? tasks[0]?.id === selectedTask.id : true}
                      isLast={selectedTask ? tasks[tasks.length - 1]?.id === selectedTask.id : true}
                      saveState={saveState} expertMode={expertMode} setExpertMode={setExpertMode}
                      sequenceFlows={sequenceFlows} gateways={gateways} tasks={tasks} onForceSave={flushAllSaves}
                      firstStepsActive={firstStepsActive} guideStep={guideStep}
                      onGuideComplete={() => {
                        if (firstStepsActive && guideStep === 2) {
                          setGuideStep(3);
                        }
                      }}
                      onFlowsChange={(newFlows) => {
                        setSequenceFlows(newFlows);
                        persistGraph(gateways, newFlows, proc.id);
                      }}
                      onDone={() => setSelectedId(null)} />
                  ) : selectedGateway ? (
                    <GatewayEditor gateway={selectedGateway} onChange={updateGateway} onDelete={deleteGateway} processId={proc?.id}
                      saveState={saveState} sequenceFlows={sequenceFlows} tasks={tasks} gateways={gateways}
                      onFlowsChange={(newFlows) => {
                        setSequenceFlows(newFlows);
                        persistGraph(gateways, newFlows, proc.id).then((ok) => { if (ok) loadMetrics(proc.id); });
                      }}
                      onDone={() => setSelectedId(null)} />
                  ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                    Selecciona un nodo para ver sus detalles.
                  </div>
                )
              ) : (
                <Optimization state={opt} onRun={runOptimize} onApply={applyOptimized} tasks={tasks} onApplyRecommendation={handleApplyRecommendation} onFocusNode={focusNodeByBpmnId} />
              )}
              </div>
            </div>
          </aside>
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

