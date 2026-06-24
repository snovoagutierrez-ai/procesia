import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

import { apiFetch } from "./api.js";
import { VALUE, WASTE, TYPES, ACTION, SEVERITY, WASTE_QUESTIONS } from "./constants.js";
import { Seg, Field, TimeField } from "./components/shared/uiAtoms.jsx";
import {
  ReactFlow, Background, Controls,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position, addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Download, Sparkles, Loader2,
  AlertTriangle, User, Wrench, PenLine, Gauge, X, ArrowRight, Lightbulb,
  ArrowLeft, FolderOpen, FolderPlus, FileText, Copy, Clock, LogOut, Info, Check,
  RefreshCw, TrendingUp
} from "lucide-react";
import { useAuth } from './components/auth/AuthContext.jsx';
import MacroprocessDiagram from "./components/diagram/MacroprocessDiagram.jsx";
import Logo from "./components/shared/Logo.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import './styles/main.css';
import { Editor, GatewayEditor, Optimization, ValueClassWizard, fmtShort, fmtLong } from "./components/editor/Editors.jsx";
import { VSMLadder, FlowDiagram } from "./components/diagram/FlowDiagrams.jsx";
import WelcomeModal from "./components/shared/WelcomeModal.jsx";



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
  const { user, logout } = useAuth();
  // Views: "dashboard" | "editor"
  const [view, setView] = useState("dashboard");
  const [dashTab, setDashTab] = useState("jerarquia");
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
  const [expertMode, setExpertMode] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileStep, setMobileStep] = useState(1);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const tutorialSeen = localStorage.getItem('aiproces_tutorial_seen');
    if (!tutorialSeen) {
      setShowTutorial(true);
      localStorage.setItem('aiproces_tutorial_seen', 'true');
    }
  }, []);

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
      await apiFetch(`/processes/${proc.id}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways: newGateways, sequence_flows: newFlows })
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
      
      apiFetch(`/processes/${proc.id}/graph`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateways, sequence_flows: newFlows })
      }).catch(() => {});

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

  const deleteGateway = async (bpmn_id) => {
    if (!proc) return;
    try {
      const newGateways = gateways.filter((g) => g.bpmn_id !== bpmn_id);
      const newFlows = sequenceFlows.filter((f) => f.source_ref !== bpmn_id && f.target_ref !== bpmn_id);
      
      setGateways(newGateways);
      setSequenceFlows(newFlows);
      if (bpmn_id === selectedId) setSelectedId(null);
      
      await apiFetch(`/processes/${proc.id}/graph`, {
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

  const getOutgoingTarget = useCallback((bpmnId) => {
    const flows = (sequenceFlows || []).filter(f => f.source_ref === bpmnId);
    return flows.length > 0 ? flows[0].target_ref : "";
  }, [sequenceFlows]);

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
    apiFetch(`/processes/${proc.id}/graph`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateways: gateways || [], sequence_flows: newFlows })
    }).catch(() => {});
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
      const res = await apiFetch(`/macroprocesses/${mId}/optimize`, { method: "POST", headers: { Authorization: `Bearer ${user.token}` } });
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
      alert("Error al exportar BPMN: " + e.message);
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
      <WelcomeModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

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
          <div className="pa-topbar" style={{ maxWidth: '1320px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button className="pa-btn pa-btn-ghost" style={{ padding: '6px' }} onClick={() => { setProc(null); setView("dashboard"); }} aria-label="Volver"><ArrowLeft size={16} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                <span 
                  style={{ cursor: 'pointer', color: 'var(--teal)', fontWeight: 500 }} 
                  onClick={() => { setProc(null); setView("dashboard"); }}
                >
                  Mis procesos
                </span>
                <span style={{ opacity: 0.5 }}>/</span>
                <span 
                  style={{ cursor: 'pointer', color: 'var(--teal)', fontWeight: 500 }} 
                  onClick={() => { setProc(null); setView("dashboard"); }}
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
              <button className="pa-btn pa-btn-ghost" onClick={exportBpmn}>
                <Download size={16} /> .bpmn
              </button>
            </div>
          </div>

          {isMobile && (
            <div className="pa-mobile-nav">
              <button className={mobileStep === 1 ? 'on' : ''} onClick={() => setMobileStep(1)}>1. Tareas</button>
              <button className={mobileStep === 2 ? 'on' : ''} onClick={() => setMobileStep(2)}>2. Diagrama</button>
              <button className={mobileStep === 3 && tab === "detalle" ? 'on' : ''} onClick={() => { setMobileStep(3); setTab("detalle"); }}>3. Detalle</button>
              <button className={mobileStep === 4 || (mobileStep === 3 && tab === "optim") ? 'on' : ''} onClick={() => { setMobileStep(4); setTab("optim"); }}>4. IA</button>
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
                    <div key={t.id} className={"pa-step" + (t.id === selectedId ? " sel" : "")} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div onClick={() => { setSelectedId(t.id); setTab("detalle"); setMobileStep(3); }} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <span className="pa-step-bar" style={{ background: VALUE[t.valueClass]?.color || "#EEF3F0" }} />
                        <span className="pa-step-n mono">{String(i + 1).padStart(2, "0")}</span>
                        <span className="pa-step-name">{t.name}</span>
                        <span className="pa-step-t mono">{fmtShort((Number(t.cycleTime) || 0) + (Number(t.waitTime) || 0))}</span>
                      </div>
                      <select 
                         value={getOutgoingTarget(t.bpmnId)} 
                         onChange={(e) => setOutgoingTarget(t.bpmnId, e.target.value)}
                         style={{ background: "transparent", border: "1px solid var(--line-ink)", color: "var(--inv-muted)", borderRadius: 4, padding: "2px 4px", fontSize: 11, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}
                         onClick={(e) => e.stopPropagation()}
                      >
                         <option value="">(Desconectado)</option>
                         <option value="end">🏁 Fin</option>
                         {tasks.filter(tk => tk.id !== t.id).map((tk) => {
                           const tIdx = String(tasks.findIndex(x => x.id === tk.id) + 1).padStart(2, "0");
                           return <option key={tk.bpmnId} value={tk.bpmnId}>Hacia {tIdx}. {tk.name}</option>
                         })}
                         {gateways.map(g => <option key={g.bpmn_id} value={g.bpmn_id}>Hacia {g.name}</option>)}
                      </select>
                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm("\u00bfEliminar esta tarea?")) deleteTask(t.id); }} title="Eliminar tarea" aria-label="Eliminar tarea" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--inv-muted)", padding: 4, display: "flex", flexShrink: 0, borderRadius: 6 }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                {gateways && gateways.length > 0 && (
                  <>
                    <div className="pa-side-title" style={{ marginTop: '16px' }}>Compuertas <span className="pa-count">{gateways.length}</span></div>
                    <div className="pa-steplist">
                      {gateways.map((g) => (
                        <div key={g.bpmn_id} className={"pa-step" + (g.bpmn_id === selectedId ? " sel" : "")} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div onClick={() => { setSelectedId(g.bpmn_id); setTab("detalle"); setMobileStep(3); }} style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, cursor: "pointer" }}>
                            <span className="pa-step-bar" style={{ background: "#8C8C8C" }} />
                            <span className="pa-step-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Compuerta"}</span>
                            <span className="pa-step-t mono">{g.node_type === "exclusiveGateway" ? "EXC" : "PAR"}</span>
                          </div>
                          <select 
                             value={getOutgoingTarget(g.bpmn_id)} 
                             onChange={(e) => setOutgoingTarget(g.bpmn_id, e.target.value)}
                             style={{ background: "transparent", border: "1px solid var(--line-ink)", color: "var(--inv-muted)", borderRadius: 4, padding: "2px 4px", fontSize: 11, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}
                             onClick={(e) => e.stopPropagation()}
                          >
                             <option value="">(Desconectado)</option>
                             <option value="end">🏁 Fin</option>
                             {tasks.map(tk => {
                               const tIdx = String(tasks.findIndex(x => x.id === tk.id) + 1).padStart(2, "0");
                               return <option key={tk.bpmnId} value={tk.bpmnId}>Hacia {tIdx}. {tk.name}</option>
                             })}
                             {gateways.filter(gx => gx.bpmn_id !== g.bpmn_id).map(gx => <option key={gx.bpmn_id} value={gx.bpmn_id}>Hacia {gx.name}</option>)}
                          </select>
                          <button onClick={(e) => { e.stopPropagation(); if (window.confirm("\u00bfEliminar esta compuerta?")) deleteGateway(g.bpmn_id); }} title="Eliminar compuerta" aria-label="Eliminar compuerta" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--inv-muted)", padding: 4, display: "flex", flexShrink: 0, borderRadius: 6 }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="pa-btn pa-btn-ghost" style={{ flex: 1 }} onClick={addTask}><Plus size={14} /> Tarea</button>
                  <button className="pa-btn pa-btn-ghost" style={{ flex: 1 }} onClick={addGateway}><Plus size={14} /> Compuerta</button>
                </div>
                <button className="pa-btn pa-btn-primary full" style={{ marginTop: 16 }} onClick={() => { setTab("optim"); if (isMobile) setMobileStep(4); }}>
                  <Sparkles size={16} /> 4. Ir a Optimización IA
                </button>
              </div>
            </aside>
            )}

            {(!isMobile || mobileStep === 2 || mobileStep === 3 || mobileStep === 4) && (
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

              {(!isMobile || mobileStep === 3 || mobileStep === 4) && (
              <div className="pa-panel" style={{ marginTop: 16 }}>
                {!isMobile && (
                  <div className="pa-tabs">
                    <button className={tab === "detalle" ? "on" : ""} onClick={() => setTab("detalle")}><Gauge size={15} /> Detalle del paso</button>
                    <button className={tab === "optim" ? "on" : ""} onClick={() => setTab("optim")}><Lightbulb size={15} /> Optimización IA</button>
                  </div>
                )}
                <div className="pa-panel-body">
                  {tab === "detalle" ? (
                    selectedTask ? (
                      <Editor task={selectedTask} onChange={updateTask} onMove={moveTask} onDelete={deleteTask}
                        isFirst={selectedTask ? tasks[0]?.id === selectedTask.id : true}
                        isLast={selectedTask ? tasks[tasks.length - 1]?.id === selectedTask.id : true} 
                        saveState={saveState} expertMode={expertMode} setExpertMode={setExpertMode}
                        sequenceFlows={sequenceFlows} gateways={gateways} tasks={tasks}
                        onFlowsChange={(newFlows) => {
                          setSequenceFlows(newFlows);
                          apiFetch(`/processes/${proc.id}/graph`, {
                            method: "PUT", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ gateways, sequence_flows: newFlows })
                          }).catch(() => {});
                        }}
                        onDone={() => { if (isMobile) setMobileStep(2); else setSelectedId(null); }} />
                    ) : selectedGateway ? (
                      <GatewayEditor gateway={selectedGateway} onChange={updateGateway} onDelete={deleteGateway}
                        saveState={saveState} onDone={() => { if (isMobile) setMobileStep(2); else setSelectedId(null); }} />
                    ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#5C6B6B' }}>
                      Selecciona un nodo para ver sus detalles.
                    </div>
                  )
                ) : (
                  <Optimization state={opt} onRun={runOptimize} onApply={applyOptimized} tasks={tasks} />
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

