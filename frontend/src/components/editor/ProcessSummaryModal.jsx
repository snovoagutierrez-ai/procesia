import React from 'react';
import { X, Eye, Gauge, GitBranch } from 'lucide-react';
import { fmtShort, fmtLong } from './Editors.jsx';

export default function ProcessSummaryModal({ isOpen, onClose, proc, tasks, gateways, metricsData }) {
  if (!isOpen || !proc) return null;

  return (
    <div className="pa-modal-overlay">
      <div role="dialog" aria-modal="true" aria-labelledby="process-summary-title" className="pa-modal-content" style={{ maxWidth: 620 }}>
        <div className="pa-modal-header">
          <h2 id="process-summary-title"><Eye size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Resumen del proceso</h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar resumen del proceso"><X size={18} /></button>
        </div>

        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>{proc.name || 'Proceso sin nombre'}</h3>
              {proc.code && <span className="pa-tag">{proc.code}</span>}
            </div>
            {proc.objective && <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>{proc.objective}</p>}
          </div>

          <div className="pa-row two" style={{ marginBottom: 20 }}>
            <div className="pa-field">
              <span className="pa-label">Evento de inicio</span>
              <span style={{ fontSize: 13.5 }}>{proc.trigger_event || '—'}</span>
            </div>
            <div className="pa-field">
              <span className="pa-label">Resultado final</span>
              <span style={{ fontSize: 13.5 }}>{proc.output_result || '—'}</span>
            </div>
          </div>

          {metricsData && (
            <div className="pa-metrics" style={{ marginBottom: 20 }}>
              <div className="pa-metric"><span>Lead time</span><b className="mono">{fmtLong(metricsData.lead_time_sec)}</b></div>
              <div className="pa-metric"><span>Tiempo de ciclo</span><b className="mono">{fmtLong(metricsData.total_cycle_time_sec)}</b></div>
              <div className="pa-metric"><span>Tiempo de espera</span><b className="mono">{fmtLong(metricsData.total_wait_time_sec)}</b></div>
              <div className="pa-metric wide">
                <span>Eficiencia de ciclo (VA) <b className="mono">{Math.round(metricsData.pce_percentage || 0)}%</b></span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div className="pa-side-title" style={{ color: 'var(--muted)', marginBottom: 8 }}>
              <Gauge size={14} /> Tareas <span className="pa-count" style={{ background: '#EEF3F0', color: 'var(--muted)' }}>{tasks?.length || 0}</span>
            </div>
            {tasks && tasks.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8 }}>
                {tasks.map((t) => <li key={t.id}>{t.name || 'Tarea sin nombre'}</li>)}
              </ol>
            ) : (
              <div className="pa-empty">Este proceso aún no tiene tareas.</div>
            )}
          </div>

          <div>
            <div className="pa-side-title" style={{ color: 'var(--muted)', marginBottom: 8 }}>
              <GitBranch size={14} /> Compuertas <span className="pa-count" style={{ background: '#EEF3F0', color: 'var(--muted)' }}>{gateways?.length || 0}</span>
            </div>
            {gateways && gateways.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.8 }}>
                {gateways.map((g) => (
                  <li key={g.bpmn_id}>{g.name || 'Compuerta'} <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>({g.node_type === 'exclusiveGateway' ? 'Exclusiva' : 'Paralela'})</span></li>
                ))}
              </ol>
            ) : (
              <div className="pa-empty">Este proceso no tiene compuertas.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
