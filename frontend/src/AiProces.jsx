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
  const [mergeData, setMergeData] = useState(null);
  const [aiTip, setAiTip] = useState(null);
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);
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
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);
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
      
      const doSave = async () => {
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
      };

      updateTaskTimeoutRefs.current[id + "_flush"] = doSave;
      updateTaskTimeoutRefs.current[id] = setTimeout(doSave, 500);

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
    try {
      await apiFetch(`/processes/${proc.id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_json: { tasks, gateways, sequence_flows: sequenceFlows } })
      });
    } catch (err) { console.warn(err); }

    const tBpmnId = rec.target_node_bpmn_id;
    const task = tasks.find(t => t.bpmnId === tBpmnId || t.id.toString() === tBpmnId);

    if (rec.action_type === 'ELIMINATE') {
      if (task) {
        await apiFetch(`/processes/${proc.id}/tasks/${task.id}`, { method: "DELETE" });
        setTasks(ts => ts.filter(t => t.id !== task.id));
        const incoming = sequenceFlows.find(f => f.target_ref === tBpmnId);
        const outgoing = sequenceFlows.find(f => f.source_ref === tBpmnId);
        let newFlows = sequenceFlows.filter(f => f.source_ref !== tBpmnId && f.target_ref !== tBpmnId);
        if (incoming && outgoing) {
          newFlows.push({ id: `edge-${Date.now()}`, source_ref: incoming.source_ref, target_ref: outgoing.target_ref });
        }
        setSequenceFlows(newFlows);
        await apiFetch(`/processes/${proc.id}/graph`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gateways, sequence_flows: newFlows })
        });
        markAsApplied();
      }
    } else if (rec.action_type === 'MERGE') {
      setMergeData({ rec, markAsApplied });
    } else {
      if (task) {
        setSelectedId(task.id);
        setTab("detalle");
        if (isMobile) setMobileStep(3);
        setAiTip({ rec, markAsApplied });
      }
    }
  };

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
                  <Optimization state={opt} onRun={runOptimize} onApply={applyOptimized} tasks={tasks} onApplyRecommendation={handleApplyRecommendation} />
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

