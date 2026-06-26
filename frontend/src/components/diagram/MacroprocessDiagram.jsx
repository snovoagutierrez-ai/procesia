import React, { useMemo, useCallback, useEffect, useState } from "react";
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
  addEdge
} from "@xyflow/react";
import dagre from "dagre";
import { apiFetch } from "../../api.js";
import { AlertCircle, Network, Eye } from 'lucide-react';
import "@xyflow/react/dist/style.css";

/* ---------- Custom Node: Process ---------- */
function ProcessNode({ data }) {
  const { process, isConnected } = data;
  return (
    <div style={{
      position: 'relative',
      background: '#fff',
      border: isConnected !== false ? '1px solid #E2E7E3' : '2px dashed #C98A12',
      borderRadius: '8px',
      padding: '12px 16px',
      minWidth: '220px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }} title={isConnected === false ? "Sin conectar — arrastra desde aquí hacia otro proceso" : undefined}>
      {isConnected === false && (
        <div style={{ position: 'absolute', top: -8, right: -8, background: '#FFF8E1', color: '#C98A12', borderRadius: '50%', padding: '2px', border: '1px solid #F5DEB3', display: 'flex' }}>
          <AlertCircle size={14} />
        </div>
      )}
      <Handle type="target" position={Position.Left} className="rf-handle" />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ background: '#0E9F9F', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
          {data.process.code}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#13202B', flex: 1 }}>
          {data.process.name}
        </div>
      </div>
      
      <div style={{ fontSize: '11px', color: '#5C6B6B', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>Entrada:</span>
          <span style={{ textAlign: 'right' }}>{data.process.trigger_event || data.process.trigger || "-"}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>Salida:</span>
          <span style={{ textAlign: 'right' }}>{data.process.output_result || data.process.output || "-"}</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button 
          className="pa-btn pa-btn-ghost" 
          style={{ fontSize: 11, padding: '4px 8px', color: 'var(--teal)', border: '1px solid var(--line)' }}
          onClick={(e) => { e.stopPropagation(); if(data.onViewFlow) data.onViewFlow(data.process); }}
          title="Ver flujo de proceso"
        >
          <Eye size={12} style={{ marginRight: 4 }} /> Ver Flujo
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="rf-handle" />
    </div>
  );
}

const nodeTypes = {
  processNode: ProcessNode,
};

/* ---------- Dagre layout ---------- */
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes, edges) => {
  dagreGraph.setGraph({ rankdir: "LR", ranksep: 100, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 240, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x - 240 / 2,
      y: nodeWithPosition.y - 100 / 2,
    };
    return node;
  });

  return { nodes, edges };
};

/* ---------- Build nodes & edges ---------- */
function buildGraph(processes, sequenceFlows = [], onViewFlow) {
  const nodes = [];
  const edges = [];

  // Create nodes
  processes.forEach((p) => {
    const isConnected = sequenceFlows.some(sf => sf.source_ref === String(p.id) || sf.target_ref === String(p.id));
    nodes.push({
      id: String(p.id),
      type: "processNode",
      data: { process: p, isConnected, onViewFlow },
      position: { x: 0, y: 0 }
    });
  });

  // Create edges from sequenceFlows
  sequenceFlows.forEach(sf => {
    edges.push({
      id: sf.id || `e-${sf.source_ref}-${sf.target_ref}`,
      source: sf.source_ref,
      target: sf.target_ref,
      type: "smoothstep",
      style: { stroke: "#0E9F9F", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: "#0E9F9F",
      },
      animated: true,
    });
  });

  return getLayoutedElements(nodes, edges);
}

/* ---------- Main Component ---------- */
export default function MacroprocessDiagram({ macroprocessId, processes, onProcessDoubleClick, onViewFlow }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [sequenceFlows, setSequenceFlows] = useState([]);

  // Fetch macro graph
  const fetchGraph = useCallback(async () => {
    if (!macroprocessId) return;
    try {
      const res = await apiFetch(`/macroprocesses/${macroprocessId}/graph`);
      if (res.ok) {
        const data = await res.json();
        setSequenceFlows(data.sequence_flows || []);
      }
    } catch (err) {
      console.error("Failed to fetch macro graph", err);
    }
  }, [macroprocessId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Update layout when processes or sequenceFlows change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraph(processes, sequenceFlows, onViewFlow);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [processes, sequenceFlows, setNodes, setEdges, onViewFlow]);

  // Save changes to backend
  const saveGraph = useCallback(async (updatedEdges) => {
    if (!macroprocessId) return;
    
    const payload = {
      sequence_flows: updatedEdges.map(e => ({
        id: String(e.id),
        source_ref: e.source,
        target_ref: e.target,
        condition: null
      }))
    };
    
    try {
      const res = await apiFetch(`/macroprocesses/${macroprocessId}/graph`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setSequenceFlows(data.sequence_flows || []);
      }
    } catch (err) {
      console.error("Failed to save macro graph", err);
    }
  }, [macroprocessId]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => {
      const newEdge = {
        ...params,
        type: "smoothstep",
        style: { stroke: "#0E9F9F", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: "#0E9F9F" },
        animated: true
      };
      const updatedEdges = addEdge(newEdge, eds);
      // Ejecutar el guardado fuera del callback de React para evitar problemas de sincronía
      setTimeout(() => saveGraph(updatedEdges), 0);
      return updatedEdges;
    });
  }, [setEdges, saveGraph]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    const hasDeletes = changes.some(c => c.type === 'remove');
    if (hasDeletes) {
      setTimeout(() => {
        setEdges((currentEdges) => {
          saveGraph(currentEdges);
          return currentEdges;
        });
      }, 0);
    }
  }, [onEdgesChange, setEdges, macroprocessId]);

  const onNodeDoubleClick = useCallback(
    (_event, node) => {
      if (onProcessDoubleClick && node.data?.process) {
        onProcessDoubleClick(node.data.process);
      }
    },
    [onProcessDoubleClick]
  );

  const [hideBanner, setHideBanner] = useState(false);
  const needsHelp = processes && processes.length >= 2 && (!sequenceFlows || sequenceFlows.length === 0);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#F6F8FA", borderRadius: "8px", overflow: "hidden", border: "1px solid #E2E7E3" }}>
      {needsHelp && !hideBanner && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#FFF8E1', border: '1px solid #F5DEB3', color: '#C98A12', padding: '8px 16px', borderRadius: '8px', zIndex: 10, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '90%' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>Une los puntos laterales de los procesos para armar tu flujo.</span>
          <button onClick={() => setHideBanner(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#C98A12', padding: 4, marginLeft: 8 }} title="Ocultar">
            <span style={{ fontSize: 16, fontWeight: 'bold' }}>×</span>
          </button>
        </div>
      )}
      <button 
        className="pa-btn"
        onClick={() => {
          const { nodes: newNodes, edges: newEdges } = buildGraph(processes, sequenceFlows, onViewFlow);
          setNodes([...newNodes]);
        }}
        style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center', background: '#fff', color: '#13202B', border: '1px solid #E2E7E3' }}
      >
        <Network size={14} /> Organizar automáticamente
      </button>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap zoomable pannable nodeColor="#0E9F9F" maskColor="rgba(246, 248, 250, 0.7)" />
      </ReactFlow>
    </div>
  );
}
