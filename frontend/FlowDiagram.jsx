import React, { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  addEdge,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import "./FlowDiagram.css";

import { User, PenLine, Wrench, Clock, RotateCcw } from "lucide-react";

/* ---------- Constants ---------- */
const VALUE = {
  VA:   { label: "Valor agregado",     short: "VA",   color: "#1FA463" },
  NNVA: { label: "Necesario sin valor", short: "NNVA", color: "#C98A12" },
  NVA:  { label: "Desperdicio",         short: "NVA",  color: "#D9503C" },
};

const TYPES = {
  user:    { label: "Persona",  Icon: User },
  manual:  { label: "Manual",   Icon: PenLine },
  service: { label: "Sistema",  Icon: Wrench },
};

const WASTE_SHORT = {
  defects: "Defectos",
  overproduction: "Sobreproducción",
  waiting: "Espera",
  non_utilized_talent: "Talento",
  transportation: "Transporte",
  inventory: "Inventario",
  motion: "Movimiento",
  excess_processing: "Sobreproceso",
};

/* ---------- Helpers ---------- */
function fmtShort(sec) {
  sec = Number(sec) || 0;
  if (sec === 0) return "0";
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.round(sec / 60) + "m";
  return (sec / 3600).toFixed(1).replace(/\.0$/, "") + "h";
}

/* ---------- Custom Node: Start Event ---------- */
function StartNode({ data }) {
  return (
    <div className="flow-node-event flow-node-event--start">
      <div className="flow-node-event__circle">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <polygon points="5,3 13,8 5,13" fill="#0E9F9F" />
        </svg>
      </div>
      <div className="flow-node-event__label">{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

/* ---------- Custom Node: End Event ---------- */
function EndNode({ data }) {
  return (
    <div className="flow-node-event flow-node-event--end">
      <Handle type="target" position={Position.Left} />
      <div className="flow-node-event__circle">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="1.5" fill="#15232E" />
        </svg>
      </div>
      <div className="flow-node-event__label">{data.label}</div>
    </div>
  );
}

/* ---------- Custom Node: Task ---------- */
function TaskNode({ data }) {
  const task = data.task;
  const v = VALUE[task.valueClass] || VALUE.VA;
  const typeInfo = TYPES[task.type] || TYPES.user;
  const TypeIcon = typeInfo.Icon;
  const isSelected = data.isSelected;

  const classNames = [
    "flow-node-task",
    `flow-node-task--${(task.valueClass || "VA").toLowerCase()}`,
    isSelected ? "flow-node-task--selected" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={classNames} onClick={() => data.onSelect?.(task.id)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      {task.valueClass === "NVA" && task.wasteType && (
        <div className="flow-node-task__waste">
          {WASTE_SHORT[task.wasteType] || task.wasteType}
        </div>
      )}

      <div className="flow-node-task__header">
        <div className="flow-node-task__icon">
          <TypeIcon size={14} />
        </div>
        <div className="flow-node-task__name">{task.name}</div>
      </div>

      <div className="flow-node-task__meta">
        <span className="flow-node-task__type">{typeInfo.label}</span>
        <span className="flow-node-task__value" style={{ color: v.color }}>
          {v.short}
        </span>
      </div>

      <div className="flow-node-task__times">
        <span>
          <RotateCcw size={9} />
          {fmtShort(task.cycleTime)}
        </span>
        <span>
          <Clock size={9} />
          {fmtShort(task.waitTime)}
        </span>
      </div>
    </div>
  );
}

/* ---------- Custom Node: Gateway ---------- */
function GatewayNode({ data }) {
  const isSelected = data.isSelected;
  return (
    <div 
      className={`flow-node-gateway ${isSelected ? 'flow-node-gateway--selected' : ''}`}
      onClick={() => data.onSelect?.(data.gateway.bpmn_id)}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flow-node-gateway__diamond">
        {data.gateway.node_type === "exclusiveGateway" ? "X" : "+"}
      </div>
      <div className="flow-node-gateway__label">{data.gateway.name}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

/* ---------- Node types registry ---------- */
const nodeTypes = {
  startEvent: StartNode,
  endEvent: EndNode,
  taskNode: TaskNode,
  gatewayNode: GatewayNode,
};

/* ---------- Dagre layout ---------- */
const NODE_WIDTH_TASK = 190;
const NODE_HEIGHT_TASK = 90;
const NODE_WIDTH_EVENT = 60;
const NODE_HEIGHT_EVENT = 70;

function getLayoutedElements(nodes, edges, direction = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 30,
    marginy: 30,
  });

  nodes.forEach((node) => {
    const isEvent = node.type === "startEvent" || node.type === "endEvent";
    g.setNode(node.id, {
      width: isEvent ? NODE_WIDTH_EVENT : NODE_WIDTH_TASK,
      height: isEvent ? NODE_HEIGHT_EVENT : NODE_HEIGHT_TASK,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    const isEvent = node.type === "startEvent" || node.type === "endEvent";
    const w = isEvent ? NODE_WIDTH_EVENT : NODE_WIDTH_TASK;
    const h = isEvent ? NODE_HEIGHT_EVENT : NODE_HEIGHT_TASK;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ---------- Build nodes & edges from process data ---------- */
function buildFlowElements(proc, tasks, gateways, sequenceFlows, selectedId, onSelect) {
  const flowNodes = [];
  const flowEdges = [];

  // Start event
  flowNodes.push({
    id: "start",
    type: "startEvent",
    data: { label: proc.trigger || proc.trigger_event || "Inicio" },
    position: { x: 0, y: 0 },
  });

  // Task nodes
  tasks.forEach((t) => {
    flowNodes.push({
      id: String(t.id),
      type: "taskNode",
      data: {
        task: t,
        isSelected: t.id === selectedId,
        onSelect: onSelect,
      },
      position: { x: 0, y: 0 },
    });
  });

  // Gateway nodes
  (gateways || []).forEach((g) => {
    flowNodes.push({
      id: g.bpmn_id,
      type: "gatewayNode",
      data: {
        gateway: g,
        isSelected: g.bpmn_id === selectedId,
        onSelect: onSelect,
      },
      position: { x: 0, y: 0 },
    });
  });

  // End event
  flowNodes.push({
    id: "end",
    type: "endEvent",
    data: { label: proc.output || proc.output_result || "Fin" },
    position: { x: 0, y: 0 },
  });

  // Edges
  if (sequenceFlows && sequenceFlows.length > 0) {
    sequenceFlows.forEach((sf) => {
      flowEdges.push({
        id: sf.bpmn_id,
        source: sf.source_ref,
        target: sf.target_ref,
        label: sf.condition_expression || "",
        type: "smoothstep",
        animated: true,
        style: { stroke: "#9AA8A8", strokeWidth: 1.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: "#9AA8A8",
        },
      });
    });
  } else {
    // Fallback: linear sequence
    const orderedIds = ["start", ...tasks.map((t) => String(t.id)), "end"];
    for (let i = 0; i < orderedIds.length - 1; i++) {
      flowEdges.push({
        id: `e-${orderedIds[i]}-${orderedIds[i + 1]}`,
        source: orderedIds[i],
        target: orderedIds[i + 1],
        type: "smoothstep",
        animated: true,
        style: { stroke: "#9AA8A8", strokeWidth: 1.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: "#9AA8A8",
        },
      });
    }
  }

  return getLayoutedElements(flowNodes, flowEdges);
}

/* ---------- Main Component ---------- */
export default function FlowDiagram({ proc, tasks, gateways, sequenceFlows, selectedId, onSelect, onGraphChange }) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => buildFlowElements(proc, tasks, gateways, sequenceFlows, selectedId, onSelect),
    [proc, tasks, gateways, sequenceFlows, selectedId, onSelect]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync when layouted elements change
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event, node) => {
      if (node.type === "taskNode" && node.data?.onSelect) {
        node.data.onSelect(node.data.task.id);
      } else if (node.type === "gatewayNode" && node.data?.onSelect) {
        node.data.onSelect(node.data.gateway.bpmn_id);
      }
    },
    []
  );

  const handleConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: `Flow_${Math.random().toString(36).slice(2, 8)}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#9AA8A8", strokeWidth: 1.8 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#9AA8A8" },
      };
      
      const newEdges = addEdge(newEdge, edges);
      setEdges(newEdges);
      
      if (onGraphChange) {
        const mappedFlows = newEdges.map(e => ({
          bpmn_id: e.id,
          source_ref: e.source,
          target_ref: e.target,
          name: e.label || "",
          condition_expression: e.label || ""
        }));
        onGraphChange(gateways, mappedFlows);
      }
    },
    [edges, gateways, onGraphChange, setEdges]
  );
  
  const handleEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      
      // If edges were removed, we need to notify parent
      const removed = changes.filter(c => c.type === 'remove');
      if (removed.length > 0 && onGraphChange) {
        // Find remaining edges
        const remainingEdges = edges.filter(e => !removed.find(r => r.id === e.id));
        const mappedFlows = remainingEdges.map(e => ({
          bpmn_id: e.id,
          source_ref: e.source,
          target_ref: e.target,
          name: e.label || "",
          condition_expression: e.label || ""
        }));
        onGraphChange(gateways, mappedFlows);
      }
    },
    [edges, gateways, onEdgesChange, onGraphChange]
  );

  // MiniMap node color
  const minimapNodeColor = useCallback((node) => {
    if (node.type === "startEvent") return "#0E9F9F";
    if (node.type === "endEvent") return "#15232E";
    const vc = node.data?.task?.valueClass;
    if (vc === "VA") return "#1FA463";
    if (vc === "NNVA") return "#C98A12";
    if (vc === "NVA") return "#D9503C";
    if (node.type === "gatewayNode") return "#8C8C8C";
    return "#3A4651";
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "#F6F8FA" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={onNodeClick}
        fitView
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <Controls
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(245, 247, 245, 0.7)"
          position="bottom-right"
          pannable
          zoomable
          style={{ width: 140, height: 90 }}
        />
      </ReactFlow>
    </div>
  );
}
