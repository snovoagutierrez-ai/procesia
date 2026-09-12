import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Handle, Position, ReactFlow, Controls, Background, useNodesState, useEdgesState, MarkerType, addEdge, BaseEdge, getSmoothStepPath, EdgeLabelRenderer, useReactFlow, useNodesInitialized } from '@xyflow/react';
import dagre from 'dagre';
import { connectionError } from '../../utils/flowGraph.js';
import { User, PenLine, Wrench, Clock, Info, ChevronUp, ChevronDown, Trash2, Rows3, Flame,
         Table2, Database, Globe, Mail, Folder, FileText, StickyNote, Cpu,
         AlertTriangle, AlertCircle, X } from 'lucide-react';
import { familiaDeSistema } from '../../utils/systemIcon.js';
import { fmtShort, fmtLong } from '../editor/Editors.jsx';
import { VALUE, TYPES, WASTE } from '../../constants.js';
import { InfoPce, InfoCaminoCritico, InfoToc, InfoDowntime } from '../shared/Infographics.jsx';

// Icons per task type (kept local so constants.js stays icon-free)
const TYPE_ICONS = { user: User, manual: PenLine, service: Wrench };

function VSMLadder({ metrics }) {
  const [showInfo, setShowInfo] = useState(false);
  if (!metrics) return null;
  
  const { total_cycle_time_sec, total_wait_time_sec, lead_time_sec, pce_percentage } = metrics;
  
  if (lead_time_sec === 0) return null;
  
  const pce = Math.round(pce_percentage);
  // Umbrales de PCE para procesos TRANSACCIONALES (aprobaciones, solicitudes),
  // que es el caso de uso de AiProces. Referencia: M. George, "Lean Six Sigma"
  // (2002): transaccional típico ~10%, clase mundial ~50%. Antes se usaba un
  // 25% presentado como umbral Lean universal, que corresponde a otro tipo de proceso.
  const PCE_TIPICO = 10;
  const PCE_CLASE_MUNDIAL = 50;
  const isPceGood = pce >= PCE_TIPICO;
  const pceColor = pce >= PCE_CLASE_MUNDIAL ? '#1FA463' : (isPceGood ? '#C98A12' : '#D9503C');
  
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
          {/* Referencias para proceso transaccional: típico 10%, clase mundial 50% */}
          <div style={{ position: 'absolute', top: 0, left: `${PCE_TIPICO}%`, height: '100%', width: 2, background: '#C98A12', zIndex: 1 }} title={`Típico transaccional (${PCE_TIPICO}%)`} />
          <div style={{ position: 'absolute', top: 0, left: `${PCE_CLASE_MUNDIAL}%`, height: '100%', width: 2, background: '#13202B', zIndex: 1 }} title={`Clase mundial (${PCE_CLASE_MUNDIAL}%)`} />
        </div>
        <div style={{ position: 'relative', height: 16, fontSize: 10, color: '#9AA8A8', marginTop: 4 }}>
          <span style={{ position: 'absolute', left: `${PCE_TIPICO}%`, transform: 'translateX(-50%)' }}>{PCE_TIPICO}% típico</span>
          <span style={{ position: 'absolute', left: `${PCE_CLASE_MUNDIAL}%`, transform: 'translateX(-50%)' }}>{PCE_CLASE_MUNDIAL}% clase mundial</span>
        </div>
        <div style={{ marginTop: 12, padding: 12, background: isPceGood ? '#E8F5E9' : '#FFF8E1', borderRadius: 8, fontSize: 12, color: isPceGood ? '#1FA463' : '#C98A12', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{pce >= PCE_CLASE_MUNDIAL
            ? `Tu Eficiencia de Ciclo (PCE) es de clase mundial para un proceso transaccional (referencia: ${PCE_CLASE_MUNDIAL}%).`
            : isPceGood
              ? `Tu PCE está en el rango típico de un proceso transaccional (${PCE_TIPICO}%). Hay margen de mejora: la referencia de clase mundial es ${PCE_CLASE_MUNDIAL}%.`
              : `Tu PCE está por debajo del ${PCE_TIPICO}% típico de un proceso transaccional. El tiempo se está yendo en esperas o en pasos que no agregan valor.`}
          </span>
        </div>
        {metrics.lead_time_is_critical_path === false && (
          <div style={{ marginTop: 8, padding: 10, background: '#FFF8E1', border: '1px solid #F0D6AE', borderRadius: 8, fontSize: 11.5, color: '#9A6A12' }}>
            El flujo no está conectado de Inicio a Fin, así que el lead time se estima sumando los tiempos.
            Conecta el diagrama para obtener el tiempo real del camino crítico.
          </div>
        )}
        <div style={{ marginTop: 16, borderTop: '1px solid #E2E7E3', paddingTop: 12 }}>
          <button className="pa-btn pa-btn-ghost" onClick={() => setShowInfo(!showInfo)} style={{ fontSize: 12, width: '100%', justifyContent: 'space-between', color: 'var(--teal)', padding: '8px' }}>
            <span>¿Qué significan estas métricas?</span>
            {showInfo ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {showInfo && (
            <div style={{ padding: 12, background: '#F8F9FA', borderRadius: 8, marginTop: 8, fontSize: 12, color: '#3A4B4B', lineHeight: 1.5 }}>
              {/* Infografías: explican el mecanismo antes que el texto. */}
              <div style={{ background: '#fff', border: '1px solid #E2E7E3', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                <InfoPce />
              </div>
              <div style={{ background: '#fff', border: '1px solid #E2E7E3', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                <InfoCaminoCritico />
              </div>
              <div style={{ background: '#fff', border: '1px solid #E2E7E3', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                <InfoToc />
              </div>
              <div style={{ background: '#fff', border: '1px solid #E2E7E3', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <InfoDowntime />
              </div>
              <strong>Eficiencia de Ciclo (PCE):</strong> Del tiempo total que tarda el proceso de principio a fin, qué porcentaje se dedica a actividades que el cliente valora (VA). El resto se reparte entre <em>esperas</em> y <em>trabajo que no agrega valor</em> (controles, retrabajos, papeleo). Por eso un proceso sin esperas puede igual tener un PCE bajo: si sus pasos no agregan valor, no cuentan en el numerador.<br/><br/>
              <strong>Escalera de tiempo (Lead Time):</strong> Es el tiempo que transcurre desde que una solicitud entra al proceso hasta que sale. Cuando hay tareas en paralelo, se mide por el <em>camino crítico</em> (la rama más larga), no sumando ambas ramas. La barra verde es el trabajo real y la roja los tiempos de espera.
            </div>
          )}
        </div>
      </div>
      
      {/* DOWNTIME cuantificado: se calcula en el backend pero antes solo salía
          en el PDF. Ordenado por impacto para poder priorizar. */}
      {!!(metrics.waste_breakdown || []).length && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, marginBottom: 8, color: '#5C6B6B', display: 'flex', alignItems: 'center', gap: 6 }}>
            Desperdicios por impacto (DOWNTIME)
          </div>
          {metrics.waste_breakdown.map((w) => (
            <div key={w.waste_type} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#3A4B4B' }}>{WASTE[w.waste_type] || w.waste_type}
                  <span style={{ color: '#9AA8A8' }}> · {w.task_count} paso{w.task_count === 1 ? '' : 's'}</span>
                </span>
                <span style={{ fontWeight: 600, color: '#D9503C' }}>{w.pct_of_lead_time.toFixed(1)}% · {fmtLong(w.total_time_sec)}</span>
              </div>
              <div style={{ height: 7, background: '#EBF0EC', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(w.pct_of_lead_time, 100)}%`, height: '100%', background: '#D9503C', opacity: 0.85 }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: '#9AA8A8', marginTop: 6 }}>
            Ataca primero el de mayor porcentaje: es el que más tiempo te está costando.
          </div>
        </div>
      )}

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

function StartNode({ data }) {
  return (
    <div className="rf-start-node" onClick={data.onSelect} style={{ cursor: data.onSelect ? 'pointer' : 'default' }}>
      <div className="rf-start-circle">
        <div className="rf-start-inner" />
      </div>
      <div className="rf-event-label">{data.label}</div>
      <Handle type="source" position={Position.Right} className="rf-handle rf-handle-out" title="Salida: arrastra desde aqui hacia el siguiente paso" />
    </div>
  );
}

function EndNode({ data }) {
  return (
    <div className="rf-end-node" onClick={data.onSelect} style={{ cursor: data.onSelect ? 'pointer' : 'default' }}>
      <div className="rf-end-circle">
        <div className="rf-end-inner" />
      </div>
      <div className="rf-event-label">{data.label}</div>
      <Handle type="target" position={Position.Left} className="rf-handle rf-handle-in" title="Entrada: suelta aqui la flecha del paso anterior" />
    </div>
  );
}

// Obs 08/09: "al mirar una tarea se pueda saber si esta se está realizando en
// una base de datos, página web, hoja de cálculo, carpeta, etc."
const ICONO_SISTEMA = {
  hoja: Table2,
  base: Database,
  web: Globe,
  correo: Mail,
  carpeta: Folder,
  documento: FileText,
  papel: StickyNote,
  sistema: Cpu,
};

function TaskNode({ data }) {
  const v = VALUE[data.valueClass] || VALUE.VA;
  const TypeIcon = TYPE_ICONS[data.taskType] || User;
  return (
    <div
      className={`rf-task-node ${data.selected ? "selected" : ""} ${data.hasIssue ? "has-issue" : ""}`}
      title={data.hasIssue ? "Este paso tiene un problema de conexión" : undefined}
      style={{ borderLeftColor: v.color }}
      onClick={() => data.onSelect && data.onSelect(data.taskId)}
    >
      <Handle type="target" position={Position.Left} className="rf-handle rf-handle-in" id="left" title="Entrada: suelta aqui la flecha del paso anterior" />
      <div className="rf-task-header">
        {/* Mismo numero que en la lista lateral: permite seguir el orden de los
            pasos sin ir contando las flechas. */}
        {data.order != null && <span className="rf-task-order mono">{String(data.order).padStart(2, "0")}</span>}
        <span className="rf-task-name" title={data.label}>{data.label}</span>
      </div>
      {/* El distintivo iba en la misma fila que el nombre y le comia el ancho:
          «Encuesta respondida» se quedaba en «Encu...». Va en su propia linea. */}
      {data.isConstraint && (
        <div className="rf-task-key" title="Paso más lento: marca el ritmo de todo el proceso. Mejorar aquí es lo único que aumenta la capacidad.">
          <Flame size={11} /> Marca el ritmo
        </div>
      )}
      <div className="rf-task-meta">
        <TypeIcon size={12} />
        <span>{TYPES[data.taskType]?.label || data.taskType}</span>
        {(() => {
          const fam = familiaDeSistema(data.systems, data.taskType);
          const IconoSistema = fam && ICONO_SISTEMA[fam.clave];
          if (!IconoSistema) return null;
          return (
            <span className="rf-task-where" title={`Se realiza en: ${fam.etiqueta}${data.systems ? ` (${data.systems})` : ""}`}>
              <IconoSistema size={12} />
            </span>
          );
        })()}
        <span className="rf-task-badge" style={{ background: v.color }}>{v.short}</span>
      </div>
      <div className="rf-task-times">
        <Clock size={10} />
        <span>ciclo {fmtShort(data.cycleTime)}</span>
        {data.waitTime > 0 && <span>| espera {fmtShort(data.waitTime)}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="rf-handle rf-handle-out" id="right" title="Salida: arrastra desde aqui hacia el siguiente paso" />
    </div>
  );
}

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label, style, markerEnd }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} id={id} />
      {/* Flecha a mitad de linea. Con solo la punta en el extremo, en tramos
          largos o superpuestos no se distinguia hacia donde va el flujo. */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={1} markerMid="url(#rf-dir-arrow)" />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all', display: 'flex', alignItems: 'center', gap: 4 }}
          className="nodrag nopan"
        >
          {label && (
            <span className="edge-branch-label">{label}</span>
          )}
          <button className="edge-delete-btn" onClick={(e) => { e.stopPropagation(); if(data?.onDelete) data.onDelete(id); }}>
            <Trash2 size={12} color="#D9503C" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/**
 * Medidas de partida de cada nodo, antes de que el navegador lo mida.
 *
 * React Flow pinta cada nodo con `visibility: hidden` hasta conocer su tamaño
 * (`nodeHasDimensions`). Normalmente lo mide al instante, pero si esa medicion
 * no llega —la pestaña no esta pintando, el contenedor aun se esta
 * dimensionando, el modal acaba de abrirse— los nodos se quedan ocultos para
 * siempre: el lienzo aparece vacio aunque los pasos existan y esten bien
 * colocados. Dar un tamaño inicial elimina esa dependencia; en cuanto el
 * navegador mide de verdad, se sustituye por el real.
 */
const MEDIDA_INICIAL = {
  taskNode:    { initialWidth: 240, initialHeight: 120 },
  gatewayNode: { initialWidth: 60,  initialHeight: 60 },
  startNode:   { initialWidth: 40,  initialHeight: 40 },
  endNode:     { initialWidth: 40,  initialHeight: 40 },
  notaNode:    { initialWidth: 34,  initialHeight: 34 },
};

function conMedidaInicial(node) {
  if (node.type === "laneNode") {
    return { ...node, initialWidth: node.data?.width || 600, initialHeight: node.data?.height || 90 };
  }
  return { ...node, ...(MEDIDA_INICIAL[node.type] || { initialWidth: 60, initialHeight: 60 }) };
}

function getLayoutedElements(rfNodes, rfEdges, direction = "LR", savedPositions = null) {
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

    const WRAP_WIDTH = 1600; // Salto de carro a los ~6 nodos
    const Y_SPACING = 300;   // Distancia vertical entre filas

    let finalX = pos.x;
    let finalY = pos.y;

    if (finalX > WRAP_WIDTH) {
      const row = Math.floor(finalX / WRAP_WIDTH);
      finalX = finalX % WRAP_WIDTH;
      finalY = finalY + (row * Y_SPACING);
    }

    // Posición manual guardada tiene prioridad sobre el auto-layout (dagre)
    const saved = savedPositions && savedPositions[node.id];
    const position = (saved && typeof saved.x === "number" && typeof saved.y === "number")
      ? { x: saved.x, y: saved.y }
      : { x: finalX - w / 2, y: finalY - h / 2 };

    return conMedidaInicial({
      ...node,
      position,
      targetPosition: Position.Left,
      sourcePosition: Position.Right
    });
  });
  return { nodes: layouted, edges: rfEdges };
}

// #6 Carriles (swimlanes): banda de fondo por rol Responsible
function LaneNode({ data }) {
  return (
    <div style={{ width: data.width, height: data.height, background: data.shade ? 'rgba(14,159,159,0.045)' : 'rgba(14,159,159,0.015)', borderTop: '1px dashed #CFE0E0', borderBottom: '1px dashed #CFE0E0', pointerEvents: 'none', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: 'var(--teal-deep)', textTransform: 'uppercase', letterSpacing: '.04em', background: 'rgba(255,255,255,0.82)', padding: '3px 9px', borderRadius: 6, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {data.label}
      </div>
    </div>
  );
}

function laneFor(node) {
  if (node.type === 'startNode' || node.type === 'endNode') return 'Inicio / Fin';
  if (node.type === 'gatewayNode') return 'Decisiones';
  const r = node.data?.responsible;
  return (r && r.trim()) ? r.split(',')[0].trim() : 'Sin asignar';
}

const LANE_LABEL_PAD = 150; // espacio a la izquierda para etiquetas de carril

function getSwimlaneLayout(rfNodes, rfEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90, marginx: 30, marginy: 30 });
  rfNodes.forEach((n) => { const w = n.type === 'taskNode' ? 200 : 60; g.setNode(n.id, { width: w, height: 60 }); });
  rfEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  // Orden de carriles: roles (primer aparición) y al final los especiales
  const special = ['Sin asignar', 'Decisiones', 'Inicio / Fin'];
  const seen = [];
  rfNodes.forEach((n) => { const l = laneFor(n); if (!seen.includes(l)) seen.push(l); });
  const roles = seen.filter((l) => !special.includes(l));
  const lanes = [...roles, ...special.filter((l) => seen.includes(l))];
  const laneIndex = Object.fromEntries(lanes.map((l, i) => [l, i]));

  const LANE_H = 150;
  let maxRight = 0;
  rfNodes.forEach((n) => { const p = g.node(n.id); const w = n.type === 'taskNode' ? 200 : 60; maxRight = Math.max(maxRight, p.x + w / 2); });
  const laneWidth = maxRight + LANE_LABEL_PAD + 60;

  const laneNodes = lanes.map((name, i) => ({
    id: `lane-${i}`, type: 'laneNode',
    position: { x: -LANE_LABEL_PAD, y: i * LANE_H },
    data: { label: name, width: laneWidth, height: LANE_H, shade: i % 2 === 0 },
    draggable: false, selectable: false, zIndex: -1,
  }));

  const content = rfNodes.map((n) => {
    const p = g.node(n.id);
    const w = n.type === 'taskNode' ? 200 : 60;
    const h = n.type === 'taskNode' ? 90 : 60;
    const li = laneIndex[laneFor(n)];
    const yCenter = li * LANE_H + LANE_H / 2;
    return { ...n, position: { x: p.x - w / 2, y: yCenter - h / 2 }, targetPosition: Position.Left, sourcePosition: Position.Right };
  });

  return { nodes: [...laneNodes, ...content].map(conMedidaInicial), edges: rfEdges };
}

function buildFlowData(proc, tasks, gateways, sequenceFlows, onSelect, onEdgesDelete, savedPositions = null, laneMode = false, constraintBpmnId = null, selectedRef = null, notas = [], accionesDeNota = {}) {
  const rfNodes = [];
  const rfEdges = [];

  // Task nodes
  tasks.forEach((t, idx) => {
    rfNodes.push({
      id: `task-${t.id}`,
      type: "taskNode",
      data: {
        label: t.name,
        taskId: t.id,
        bpmnId: t.bpmnId,
        order: idx + 1,
        systems: t.systems,
        // La restriccion es el paso mas lento: acelerar cualquier otro no sube
        // la capacidad del proceso. Es "el paso importante" con un criterio
        // objetivo, no una etiqueta manual.
        isConstraint: !!constraintBpmnId && t.bpmnId === constraintBpmnId,
        taskType: t.type,
        valueClass: t.valueClass,
        cycleTime: t.cycleTime,
        waitTime: t.waitTime,
        responsible: t.responsible,
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
        gatewayType: gw.node_type || gw.gateway_type,
        gatewayId: gw.bpmn_id,
        onSelect,
      },
      position: { x: 0, y: 0 },
    });
  });

  // Start event
  rfNodes.push({
    id: "start",
    type: "startNode",
    data: { label: proc.trigger_event || proc.trigger || "Inicio", onSelect: () => onSelect && onSelect("start") },
    position: { x: 0, y: 0 },
  });

  // End event
  rfNodes.push({
    id: "end",
    type: "endNode",
    data: { label: proc.output_result || proc.output || "Fin", onSelect: () => onSelect && onSelect("end") },
    position: { x: 0, y: 0 },
  });

  // Flow edges
  if (sequenceFlows && sequenceFlows.length > 0) {
    sequenceFlows.forEach((sf) => {
      let sourceId = sf.source_ref;
      const sTask = tasks.find(t => t.id != null && (t.id.toString() === sf.source_ref || t.bpmnId === sf.source_ref));
      if (sTask) sourceId = `task-${sTask.id}`;
      else if ((gateways || []).some(g => g.bpmn_id === sf.source_ref)) sourceId = `gw-${sf.source_ref}`;
      
      let targetId = sf.target_ref;
      const tTask = tasks.find(t => t.id != null && (t.id.toString() === sf.target_ref || t.bpmnId === sf.target_ref));
      if (tTask) targetId = `task-${tTask.id}`;
      else if ((gateways || []).some(g => g.bpmn_id === sf.target_ref)) targetId = `gw-${sf.target_ref}`;

      // Etiqueta de rama: condición (Sí/No) + probabilidad si está definida
      const branchLabel = sf.condition_expression || sf.condition || "";
      const prob = sf.branch_probability != null && sf.branch_probability !== "" ? Number(sf.branch_probability) : null;
      const edgeLabel = branchLabel + (prob != null && !Number.isNaN(prob) ? `${branchLabel ? " " : ""}(${prob}%)` : "");

      // connectionMode="loose" (necesario para que las compuertas acepten
      // conexiones desde cualquiera de sus 4 puntos) desactiva la resolución
      // automática de handle por tipo: sin sourceHandle/targetHandle explícito
      // React Flow no puede resolver el par y la arista no se pinta.
      // Se respeta el punto que el usuario usó al dibujar (sf.source_handle /
      // sf.target_handle, persistidos en BD); flujos legado sin handle guardado
      // caen al par derecha→izquierda. start/end tienen un único handle sin id.
      const sourceHandle = (sourceId.startsWith('task-') || sourceId.startsWith('gw-'))
        ? (sf.source_handle || 'right') : undefined;
      const targetHandle = (targetId.startsWith('task-') || targetId.startsWith('gw-'))
        ? (sf.target_handle || 'left') : undefined;

      const esSalidaDelSeleccionado = !!selectedRef && sf.source_ref === selectedRef;

      rfEdges.push({
        // React Flow requiere id string. Mismo orden de fallback que usa
        // onEdgesDelete (id de BD → bpmn_id → par src-tgt): si difieren,
        // borrar una conexión recién dibujada (aún sin id de BD) no encuentra
        // el flujo y no elimina nada.
        id: String(sf.id ?? sf.bpmn_id ?? `sf-${sf.source_ref}-${sf.target_ref}`),
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
        type: "deletable",
        data: { onDelete: (edgeId) => { if(onEdgesDelete) onEdgesDelete([{ id: edgeId }]); } },
        label: edgeLabel,
        animated: true,
        // Salida del paso seleccionado: se pinta en teal para responder de un
        // vistazo a "y despues, ¿que?".
        style: esSalidaDelSeleccionado
          ? { stroke: "#0E9F9F", strokeWidth: 2.6 }
          : { stroke: "#9AA8A8", strokeWidth: 1.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: esSalidaDelSeleccionado ? "#0E9F9F" : "#9AA8A8", width: 16, height: 16 },
      });
    });
  }

  if (laneMode) return getSwimlaneLayout(rfNodes, rfEdges);
  const colocado = getLayoutedElements(rfNodes, rfEdges, "LR", savedPositions);
  return conNotas(colocado, tasks, notas, accionesDeNota);
}

/** Desplazamiento por defecto de una nota respecto a su paso. */
const NOTA_DX = 210;
const NOTA_DY = -70;

/**
 * Añade las notas al diagrama ya colocado.
 *
 * Van FUERA del calculo automatico a proposito: no son parte del flujo y, si
 * entraran, dagre les asignaria un sitio propio y la posicion guardada se
 * perderia — que es lo que pasaba antes.
 *
 * Si la nota acompaña a un paso, su posicion se guarda RELATIVA a ese paso: asi
 * lo sigue cuando se mueve, que es lo que significa estar ligada a el. Se traza
 * ademas un hilo discontinuo hasta el paso para que el vinculo se vea.
 */
function conNotas({ nodes, edges }, tasks, notas, acciones) {
  if (!notas || !notas.length) return { nodes, edges };

  const porTarea = new Map();
  (tasks || []).forEach((t) => porTarea.set(t.bpmnId, t));

  const nodos = [...nodes];
  const hilos = [];

  notas.forEach((n) => {
    const dx = Number(n.pos_x) || 0;
    const dy = Number(n.pos_y) || 0;
    const tarea = n.task_bpmn_id ? porTarea.get(n.task_bpmn_id) : null;
    const nodoTarea = tarea ? nodes.find((x) => x.id === `task-${tarea.id}`) : null;

    const position = nodoTarea
      ? { x: nodoTarea.position.x + (dx || NOTA_DX), y: nodoTarea.position.y + (dy || NOTA_DY) }
      : { x: dx, y: dy };

    nodos.push({
      id: `nota-${n.id}`,
      type: "notaNode",
      draggable: true,
      selectable: false,
      connectable: false,
      zIndex: 5,
      ...MEDIDA_INICIAL.notaNode,
      data: {
        nota: n, kind: n.kind, text: n.text, author_email: n.author_email,
        nombreDelPaso: tarea?.name || null,
        ...acciones,
      },
      position,
    });

    if (nodoTarea) {
      hilos.push({
        id: `hilo-nota-${n.id}`,
        source: nodoTarea.id,
        target: `nota-${n.id}`,
        targetHandle: "ancla",
        type: "straight",
        // Ni se selecciona ni se borra: no es una conexion del proceso, es la
        // linea que indica a que paso pertenece la nota.
        selectable: false,
        deletable: false,
        focusable: false,
        style: { stroke: "#C9B77A", strokeWidth: 1.5, strokeDasharray: "4 4" },
      });
    }
  });

  return { nodes: nodos, edges: [...edges, ...hilos] };
}

/**
 * Reencuadra el diagrama cuando el contenedor cambia de tamaño.
 *
 * `fitView` como propiedad solo actua al montar. Si en ese instante el
 * contenedor todavia no tiene su tamaño definitivo —el caso del modal «Ver
 * flujo», que se monta dentro de una caja que aun se esta dimensionando— el
 * encuadre se calcula contra una superficie equivocada y los nodos quedan
 * fuera de la vista: el lienzo se ve vacio aunque los pasos existan. Nada
 * volvia a corregirlo.
 */
function ReencuadrarAlRedimensionar({ contenedorRef, dependencia }) {
  const { fitView } = useReactFlow();
  // React Flow no puede calcular el encuadre hasta que ha MEDIDO los nodos.
  // Pedirselo antes no hace nada y deja la vista sin ajustar.
  const nodosMedidos = useNodesInitialized();

  useEffect(() => {
    if (!nodosMedidos) return;
    fitView({ padding: 0.2, duration: 0 });
  }, [nodosMedidos, dependencia, fitView]);

  useEffect(() => {
    const caja = contenedorRef.current;
    if (!caja || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => {
      if (caja.clientWidth > 40 && caja.clientHeight > 40) fitView({ padding: 0.2, duration: 0 });
    });
    observador.observe(caja);
    return () => observador.disconnect();
  }, [contenedorRef, fitView]);

  return null;
}

function FlowDiagram({ proc, tasks, gateways, sequenceFlows, selectedId, onSelect, onGraphChange, onLayoutChange, onConnectionRejected, issueNodeIds, constraintBpmnId, height = 280, notas = [], onNotaMover, onNotaEditar, onNotaBorrar }) {
  const savedPositions = proc?.layout_json || null;
  const [laneMode, setLaneMode] = useState(false);
  const contenedorRef = useRef(null);
  const onEdgesDelete = useCallback(
    (deletedEdges) => {
      // Los ids de React Flow son siempre string (ver buildFlowData: String(sf.id ?? ...)),
      // pero f.id llega del backend como number — comparar como string en ambos lados.
      const deletedIds = new Set(deletedEdges.map(e => String(e.id)));
      const newFlows = (sequenceFlows || []).filter(f => {
        const fId = String(f.id ?? f.bpmn_id ?? `sf-${f.source_ref}-${f.target_ref}`);
        return !deletedIds.has(fId);
      });
      if (onGraphChange) {
        onGraphChange(gateways, newFlows);
      }
    },
    [gateways, sequenceFlows, onGraphChange]
  );

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => {
      // Referencia canonica del nodo abierto, para resaltar su salida.
      const sel = tasks.find((t) => t.id === selectedId)?.bpmnId || selectedId || null;
      return buildFlowData(proc, tasks, gateways, sequenceFlows, onSelect, onEdgesDelete,
                           savedPositions, laneMode, constraintBpmnId, sel, notas,
                           { onEditar: onNotaEditar, onBorrar: onNotaBorrar });
    },
    [proc, tasks, gateways, sequenceFlows, onSelect, onEdgesDelete, savedPositions, laneMode,
     constraintBpmnId, selectedId, notas, onNotaEditar, onNotaBorrar]
  );

  const nodesWithSelection = useMemo(
    () => layoutedNodes.map(n => ({
      ...n,
      selected: n.id === selectedId || n.data?.bpmnId === selectedId,
      // El aviso de problemas solo se leia como lista al pie del canvas: habia
      // que buscar el nodo a ojo. Marcado aqui, se ve de inmediato cual es.
      data: { ...n.data, hasIssue: !!issueNodeIds && issueNodeIds.has(n.id) },
    })),
    [layoutedNodes, selectedId, issueNodeIds]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithSelection);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(nodesWithSelection);
    setEdges(layoutedEdges);
  }, [nodesWithSelection, layoutedEdges, setNodes, setEdges]);

  // El id del nodo en el canvas ("task-42", "gw-Gateway_ab") no es la
  // referencia que guarda el resto del sistema: la barra lateral, el aviso de
  // problemas de flujo y la IA indexan por bpmn_id. Antes se guardaba el id
  // numerico de la tarea, asi que la flecha se dibujaba pero ningun chequeo la
  // reconocia y el paso quedaba "sin entrada" de forma permanente.
  const refFor = useCallback((nodeId) => {
    if (nodeId === "start" || nodeId === "end") return nodeId;
    if (nodeId.startsWith("gw-")) return nodeId.slice(3);
    const t = (tasks || []).find((t) => `task-${t.id}` === nodeId);
    return t ? (t.bpmnId || String(t.id)) : nodeId;
  }, [tasks]);

  // Las reglas viven en utils/flowGraph.js, compartidas con el aviso de
  // problemas del editor: antes cada lado tenia su propia version y no siempre
  // coincidian.
  const connectionErrorFor = useCallback(
    (source, target) => connectionError(refFor(source), refFor(target), sequenceFlows),
    [refFor, sequenceFlows]
  );

  const isValidConnection = useCallback(
    (c) => !connectionErrorFor(c.source, c.target),
    [connectionErrorFor]
  );

  const onConnect = useCallback(
    (params) => {
      const problem = connectionErrorFor(params.source, params.target);
      if (problem) {
        if (onConnectionRejected) onConnectionRejected(problem);
        return;
      }
      // bpmn_id es obligatorio en el backend (SequenceFlowSync): sin él, el PUT
      // de /graph falla con 422 y la conexión arrastrada no persiste al recargar.
      const newFlow = {
        bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        source_ref: refFor(params.source),
        target_ref: refFor(params.target),
        name: "",
        condition_expression: null,
        // Persistir desde qué punto se dibujó la conexión, para que al
        // recargar la flecha salga/entre por el mismo lado del nodo (clave
        // en compuertas, que tienen 4 puntos).
        source_handle: params.sourceHandle || null,
        target_handle: params.targetHandle || null,
      };
      // id explícito = bpmn_id: así el edge local coincide con el flujo en
      // estado y se puede borrar sin tener que recargar (antes React Flow
      // generaba un id propio que onEdgesDelete no encontraba).
      setEdges((eds) => addEdge({ ...params, id: newFlow.bpmn_id, type: "deletable", markerEnd: { type: MarkerType.ArrowClosed, color: "#9AA8A8", width: 16, height: 16 }, style: { stroke: "#9AA8A8", strokeWidth: 1.8 } }, eds));
      if (onGraphChange) {
        onGraphChange(gateways, [...(sequenceFlows||[]), newFlow]);
      }
    },
    [gateways, sequenceFlows, onGraphChange, setEdges, refFor, connectionErrorFor, onConnectionRejected]
  );

  // #5 Persistir posiciones manuales: al soltar un nodo, guarda el mapa completo
  // de posiciones { node_id: {x,y} } para que el diagrama no vuelva al auto-layout.
  const onNodeDragStop = useCallback((_evento, nodoMovido) => {
    // Las notas guardan su posicion en su propia fila, no en layout_json: si
    // entraran en ese mapa quedarian duplicadas y descuadradas al recargar.
    if (nodoMovido?.type === 'notaNode') {
      const nota = nodoMovido.data.nota;
      // Si acompaña a un paso se guarda el DESPLAZAMIENTO respecto a el, no la
      // posicion absoluta: de lo contrario la nota se quedaria atras en cuanto
      // se moviera el paso, y dejaria de estar ligada a el en la practica.
      const tarea = nota.task_bpmn_id ? (tasks || []).find(t => t.bpmnId === nota.task_bpmn_id) : null;
      const nodoTarea = tarea ? nodes.find(n => n.id === `task-${tarea.id}`) : null;
      const base = nodoTarea ? nodoTarea.position : { x: 0, y: 0 };
      onNotaMover?.(nota,
        Math.round(nodoMovido.position.x - base.x),
        Math.round(nodoMovido.position.y - base.y));
      return;
    }
    if (!onLayoutChange || laneMode) return; // en modo carriles el layout es calculado, no se persiste
    const map = {};
    nodes.forEach((n) => {
      if (n.type !== 'laneNode' && n.type !== 'notaNode') {
        map[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      }
    });
    onLayoutChange(map);
  }, [nodes, onLayoutChange, laneMode, onNotaMover, tasks]);

  return (
    // `height` por defecto 280 para el editor; quien lo muestre a pantalla
    // completa (el modal "Ver flujo") pasa "100%" y el diagrama se ajusta solo.
    <div ref={contenedorRef} className="pa-flow-canvas" style={{ height, width: "100%", position: 'relative' }}>
      <button
        type="button"
        onClick={() => setLaneMode(m => !m)}
        title={laneMode ? "Volver a vista de flujo" : "Ver por carriles de rol (Responsible)"}
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 20, display: 'inline-flex', alignItems: 'center', gap: 6, background: laneMode ? 'var(--teal)' : '#fff', color: laneMode ? '#fff' : 'var(--teal-deep)', border: '1px solid ' + (laneMode ? 'var(--teal)' : '#E2E7E3'), borderRadius: 8, padding: '6px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <Rows3 size={14} /> Carriles
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={!laneMode}
        nodesConnectable={true}
        connectionMode="loose"
        panOnDrag
        zoomOnScroll
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        {/* Marcador reutilizado por todas las aristas para la flecha intermedia. */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
          <defs>
            <marker id="rf-dir-arrow" viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#9AA8A8" />
            </marker>
          </defs>
        </svg>
        <ReencuadrarAlRedimensionar contenedorRef={contenedorRef} dependencia={`${proc?.id}|${nodes.length}|${laneMode}`} />
        <Background color="#E7ECE8" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {/* Sin esta leyenda los dos tipos de conector se veian identicos y no
          habia forma de saber por donde se empieza a arrastrar. */}
      <div className="rf-legend">
        <span><i className="out" /> Salida (arrastra desde aqui)</span>
        <span><i className="in" /> Entrada (suelta aqui)</span>
      </div>
    </div>
  );
}
function GatewayNode({ data }) {
    // El tipo llega como 'exclusiveGateway' | 'parallelGateway'. Se acepta
    // tambien la forma corta por si algun origen antiguo la usa.
    const tipo = String(data.gatewayType || "");
    const isExclusive = tipo.startsWith("exclusive");
    // Un rombo se lee como "aqui se decide". Cuando los caminos ocurren a la
    // vez no hay decision, y pintarlo igual confundia: la version paralela pasa
    // a ser un rectangulo con dos flechas simultaneas.
    const borde = data.selected ? '#0E9F9F' : '#9AA8A8';
    return (
      <div
        className={`rf-task-node ${data.selected ? "selected" : ""} ${data.hasIssue ? "has-issue" : ""}`}
        title={data.hasIssue
          ? "Esta compuerta tiene un problema de conexión"
          : (isExclusive ? "Decisión: el flujo toma UNO de los caminos"
                         : "Paralela: los caminos ocurren AL MISMO TIEMPO")}
        onClick={() => data.onSelect && data.onSelect(data.gatewayId)}
        style={{
          width: 60, height: 60, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          background: 'transparent', border: 'none', boxShadow: 'none'
        }}
      >
        <svg viewBox="0 0 100 100" style={{position:'absolute', width:'100%', height:'100%', pointerEvents: 'none'}}>
          {isExclusive ? (
            <>
              <polygon points="50,5 95,50 50,95 5,50" fill="white" stroke={borde} strokeWidth="4" />
              <text x="50" y="63" textAnchor="middle" fontSize="38" fontWeight="bold" fill="#0E9F9F">X</text>
            </>
          ) : (
            <>
              <rect x="10" y="18" width="80" height="64" rx="10" fill="white" stroke={borde} strokeWidth="4" />
              {/* Dos flechas a la vez: el trabajo se reparte, no se elige. */}
              <g stroke="#0E9F9F" strokeWidth="6" strokeLinecap="round" fill="none">
                <path d="M26 40 H62" />
                <path d="M54 32 L64 40 L54 48" />
                <path d="M26 62 H62" />
                <path d="M54 54 L64 62 L54 70" />
              </g>
            </>
          )}
        </svg>
        <div style={{
          position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', 
          fontSize: 10, whiteSpace: 'nowrap', color: '#666', background: 'rgba(255,255,255,0.8)', padding: '2px 4px', borderRadius: 4
        }}>
          {data.label}
        </div>
        <Handle type="target" position={Position.Left} className="rf-handle rf-handle-in" id="left" title="Entrada de la compuerta" />
        <Handle type="source" position={Position.Right} className="rf-handle rf-handle-out" id="right" title={isExclusive ? "Salida: uno de los caminos de la decisión" : "Salida: uno de los caminos simultáneos"} />
        <Handle type="source" position={Position.Bottom} className="rf-handle rf-handle-out" id="bottom" title={isExclusive ? "Salida: uno de los caminos de la decisión" : "Salida: uno de los caminos simultáneos"} />
        <Handle type="target" position={Position.Top} className="rf-handle rf-handle-in" id="top" title="Entrada de la compuerta" />
      </div>
    );
  }

/**
 * Nota suelta sobre el lienzo: aviso, recordatorio, punto de atencion.
 *
 * No lleva puntos de conexion a proposito: no es un paso del proceso y no debe
 * poder engancharse al flujo. Es apoyo visual para quien lee el diagrama.
 */
const TIPOS_DE_NOTA = {
  nota:        { etiqueta: "Nota",        icono: StickyNote,   clase: "es-nota" },
  advertencia: { etiqueta: "Advertencia", icono: AlertTriangle, clase: "es-advertencia" },
  importante:  { etiqueta: "Importante",  icono: AlertCircle,  clase: "es-importante" },
};

function NotaNode({ data }) {
  const tipo = TIPOS_DE_NOTA[data.kind] || TIPOS_DE_NOTA.nota;
  const Icono = tipo.icono;
  const [abierta, setAbierta] = useState(false);

  const autoria = [tipo.etiqueta, data.author_email].filter(Boolean).join(" · ");

  // Cerrada es un papelito pequeño: no tapa el diagrama y se ve de un vistazo
  // que ahi hay algo anotado. Se abre al pulsarla.
  if (!abierta) {
    return (
      <div className={`rf-nota-cerrada ${tipo.clase}`} onClick={() => setAbierta(true)}
        role="button" tabIndex={0} aria-label={`Abrir nota: ${data.text.slice(0, 60)}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierta(true); } }}
        title={`${autoria}

${data.text}`}>
        {/* Handle sin pintar: sostiene el hilo hasta el paso al que acompaña.
            No es un punto de conexion — la nota nunca entra en el flujo. */}
        <Handle type="target" position={Position.Left} id="ancla" className="rf-nota-ancla" isConnectable={false} />
        <Icono size={14} />
      </div>
    );
  }

  return (
    <div className={`rf-nota ${tipo.clase}`} title={autoria}>
      <Handle type="target" position={Position.Left} id="ancla" className="rf-nota-ancla" isConnectable={false} />
      <div className="rf-nota-cabecera">
        <Icono size={12} />
        <span>{tipo.etiqueta}</span>
        {data.onEditar && (
          <button type="button" aria-label="Editar nota" title="Editar nota"
            onClick={(e) => { e.stopPropagation(); data.onEditar(data.nota); }}>
            <PenLine size={11} />
          </button>
        )}
        {data.onBorrar && (
          <button type="button" aria-label="Borrar nota" title="Borrar nota"
            onClick={(e) => { e.stopPropagation(); data.onBorrar(data.nota); }}>
            <Trash2 size={11} />
          </button>
        )}
        <button type="button" aria-label="Cerrar nota" title="Cerrar nota"
          onClick={(e) => { e.stopPropagation(); setAbierta(false); }}>
          <X size={11} />
        </button>
      </div>
      <div className="rf-nota-texto">{data.text}</div>
      {data.nombreDelPaso && <div className="rf-nota-pie">en «{data.nombreDelPaso}»</div>}
    </div>
  );
}

const nodeTypes = { startNode: StartNode, endNode: EndNode, taskNode: TaskNode, gatewayNode: GatewayNode, laneNode: LaneNode, notaNode: NotaNode };
const edgeTypes = { deletable: DeletableEdge };

export { VSMLadder, StartNode, EndNode, TaskNode, GatewayNode, getLayoutedElements, buildFlowData, FlowDiagram, nodeTypes, edgeTypes };
