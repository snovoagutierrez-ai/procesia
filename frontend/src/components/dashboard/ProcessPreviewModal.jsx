import React, { useEffect, useState } from 'react';
import { Loader2, PenLine, X } from 'lucide-react';
import { apiFetch } from '../../api.js';
import { mapBackendTaskToFrontend } from '../../utils/processMapping.js';
import { FlowDiagram } from '../diagram/FlowDiagrams.jsx';

export default function ProcessPreviewModal({ process, onClose, onEdit }) {
  const [state, setState] = useState({ loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!process) return;
    const controller = new AbortController();
    let current = true;
    setState({ loading: true });
    async function load() {
      try {
        const paths = ['', '/tasks', '/graph', '/notes'];
        const [proc, tasks, graph, notes] = await Promise.all(paths.map(async (path) => {
          const response = await apiFetch(`/processes/${process.id}${path}`, { signal: controller.signal });
          if (!response.ok) throw new Error('No se pudo cargar el flujo. Revisa la conexión e intenta de nuevo.');
          return response.json();
        }));
        if (current) setState({ loading: false, proc, tasks: tasks.map(mapBackendTaskToFrontend), graph, notes });
      } catch (error) {
        if (current) setState({ loading: false, error: error.message });
      }
    }
    load();
    return () => { current = false; controller.abort(); };
  }, [process, attempt]);

  if (!process) return null;
  const proc = state.proc || process;
  return (
    <div className="pa-modal-overlay" style={{ zIndex: 9999 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="process-preview-title"
        style={{ background: '#fff', width: '94vw', height: '90vh', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(event) => event.stopPropagation()}>
        <div className="pa-modal-header" style={{ flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 id="process-preview-title">Flujo interno: {proc.name}</h2>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{proc.code} · Vista previa</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="pa-btn pa-btn-primary" onClick={() => onEdit(proc)}><PenLine size={16} /> Editar proceso</button>
            <button className="pa-btn-icon" aria-label="Cerrar vista previa" onClick={onClose}><X size={20} /></button>
          </div>
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative' }}>
          {state.loading ? (
            <div role="status" className="pa-empty"><Loader2 size={20} className="spin" /> Cargando flujo…</div>
          ) : state.error ? (
            <div role="alert" className="pa-empty">{state.error} <button className="pa-btn" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>
          ) : state.tasks.length === 0 && state.graph.gateways.length === 0 && state.graph.sequence_flows.length === 0 ? (
            <div className="pa-empty">Este proceso no tiene un flujo mapeado aún.</div>
          ) : (
            <div style={{ position: 'absolute', inset: 0 }}>
              <FlowDiagram key={proc.id} proc={proc} tasks={state.tasks} gateways={state.graph.gateways}
                sequenceFlows={state.graph.sequence_flows} notas={state.notes} height="100%" readOnly />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
