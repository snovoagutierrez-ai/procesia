import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Handle, Position, ReactFlow, Controls, MiniMap, Background, useNodesState, useEdgesState, MarkerType, addEdge, BaseEdge, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';
import dagre from 'dagre';
import { User, PenLine, Wrench, Clock, RotateCcw, Info, ChevronUp, ChevronDown, Trash2, Rows3 } from 'lucide-react';
import { fmtShort, fmtLong } from '../editor/Editors.jsx';
import { VALUE, TYPES } from '../../constants.js';

// Icons per task type (kept local so constants.js stays icon-free)
const TYPE_ICONS = { user: User, manual: PenLine, service: Wrench };

function VSMLadder({ metrics }) {
  const [showInfo, setShowInfo] = useState(false);
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
        <div style={{ marginTop: 12, padding: 12, background: isPceGood ? '#E8F5E9' : '#FFF8E1', borderRadius: 8, fontSize: 12, color: isPceGood ? '#1FA463' : '#C98A12', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{isPceGood 
            ? "Tu Eficiencia de Ciclo (PCE) es saludable. Estás por encima del umbral Lean del 25%, lo que indica un buen flujo de valor sin excesivas esperas." 
            : "Tu Eficiencia de Ciclo (PCE) está por debajo del umbral recomendado (25%). Hay demasiados tiempos de espera o tareas que no agregan valor en relación al tiempo de trabajo productivo."}
          </span>
        </div>
        <div style={{ marginTop: 16, borderTop: '1px solid #E2E7E3', paddingTop: 12 }}>
          <button className="pa-btn pa-btn-ghost" onClick={() => setShowInfo(!showInfo)} style={{ fontSize: 12, width: '100%', justifyContent: 'space-between', color: 'var(--teal)', padding: '8px' }}>
            <span>¿Qué significan estas métricas?</span>
            {showInfo ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {showInfo && (
            <div style={{ padding: 12, background: '#F8F9FA', borderRadius: 8, marginTop: 8, fontSize: 12, color: '#3A4B4B', lineHeight: 1.5 }}>
              <strong>Eficiencia de Ciclo (PCE):</strong> Mide qué porcentaje de tu tiempo total se dedica realmente a trabajar (Valor Agregado) versus el tiempo que se pierde esperando. Si es menor a 25%, tienes un proceso lento lleno de cuellos de botella.<br/><br/>
              <strong>Escalera de tiempo (Lead Time):</strong> Es el tiempo total que tarda una solicitud desde que entra al proceso hasta que sale. La barra verde es el trabajo real, y la roja son los tiempos muertos o de espera entre responsables.
            </div>
          )}
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

function StartNode({ data }) {
  return (
    <div className="rf-start-node" onClick={data.onSelect} style={{ cursor: data.onSelect ? 'pointer' : 'default' }}>
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
    <div className="rf-end-node" onClick={data.onSelect} style={{ cursor: data.onSelect ? 'pointer' : 'default' }}>
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
  const TypeIcon = TYPE_ICONS[data.taskType] || User;
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

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, label, style, markerEnd }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} id={id} />
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

    return {
      ...node,
      position,
      targetPosition: Position.Left,
      sourcePosition: Position.Right
    };
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

  return { nodes: [...laneNodes, ...content], edges: rfEdges };
}

function buildFlowData(proc, tasks, gateways, sequenceFlows, onSelect, onEdgesDelete, savedPositions = null, laneMode = false) {
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
        gatewayType: gw.gateway_type,
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
        style: { stroke: "#9AA8A8", strokeWidth: 1.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#9AA8A8", width: 16, height: 16 },
      });
    });
  }

  if (laneMode) return getSwimlaneLayout(rfNodes, rfEdges);
  return getLayoutedElements(rfNodes, rfEdges, "LR", savedPositions);
}

function FlowDiagram({ proc, tasks, gateways, sequenceFlows, selectedId, onSelect, onGraphChange, onLayoutChange }) {
  const savedPositions = proc?.layout_json || null;
  const [laneMode, setLaneMode] = useState(false);
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
    () => buildFlowData(proc, tasks, gateways, sequenceFlows, onSelect, onEdgesDelete, savedPositions, laneMode),
    [proc, tasks, gateways, sequenceFlows, onSelect, onEdgesDelete, savedPositions, laneMode]
  );

  const nodesWithSelection = useMemo(
    () => layoutedNodes.map(n => ({
      ...n,
      selected: n.id === selectedId || n.data?.bpmnId === selectedId
    })),
    [layoutedNodes, selectedId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithSelection);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(nodesWithSelection);
    setEdges(layoutedEdges);
  }, [nodesWithSelection, layoutedEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params) => {
      // bpmn_id es obligatorio en el backend (SequenceFlowSync): sin él, el PUT
      // de /graph falla con 422 y la conexión arrastrada no persiste al recargar.
      const newFlow = {
        bpmn_id: "Flow_" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        source_ref: params.source.replace("task-", "").replace("gw-", ""),
        target_ref: params.target.replace("task-", "").replace("gw-", ""),
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
    [gateways, sequenceFlows, onGraphChange, setEdges]
  );

  // #5 Persistir posiciones manuales: al soltar un nodo, guarda el mapa completo
  // de posiciones { node_id: {x,y} } para que el diagrama no vuelva al auto-layout.
  const onNodeDragStop = useCallback(() => {
    if (!onLayoutChange || laneMode) return; // en modo carriles el layout es calculado, no se persiste
    const map = {};
    nodes.forEach((n) => { if (n.type !== 'laneNode') map[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) }; });
    onLayoutChange(map);
  }, [nodes, onLayoutChange, laneMode]);

  return (
    <div className="pa-flow-canvas" style={{ height: 280, width: "100%", position: 'relative' }}>
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

const nodeTypes = { startNode: StartNode, endNode: EndNode, taskNode: TaskNode, gatewayNode: GatewayNode, laneNode: LaneNode };
const edgeTypes = { deletable: DeletableEdge };

export { VSMLadder, StartNode, EndNode, TaskNode, GatewayNode, getLayoutedElements, buildFlowData, FlowDiagram, nodeTypes, edgeTypes };
