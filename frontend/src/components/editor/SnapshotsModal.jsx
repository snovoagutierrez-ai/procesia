import React, { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../api.js';

export default function SnapshotsModal({ isOpen, onClose, processId, onRestore, confirm, onRestoreComplete }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [restoreError, setRestoreError] = useState(null);

  useEffect(() => {
    if (isOpen && processId) {
      loadSnapshots();
    }
  }, [isOpen, processId]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/processes/${processId}/snapshots`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data);
      }
    } catch (err) {
      console.error("Error cargando snapshots", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (snap) => {
    setRestoreError(null);
    const ok = confirm
      ? await confirm(
          "Restaurar versión",
          "Esto reemplazará todas las tareas y conexiones actuales del proceso por esta versión. Se guardará un respaldo del estado actual antes de restaurar.",
          { danger: true, confirmLabel: "Restaurar" }
        )
      : window.confirm("Esto reemplazará el estado actual del proceso por esta versión. ¿Continuar?");
    if (!ok) return;

    setRestoringId(snap.id);
    try {
      const success = onRestore ? await onRestore(snap.snapshot_json) : false;
      if (success) {
        if (onRestoreComplete) onRestoreComplete();
        onClose();
      } else {
        setRestoreError("No se pudo restaurar la versión. Intenta de nuevo.");
      }
    } catch (err) {
      console.error("Error restaurando", err);
      setRestoreError("Error al restaurar la versión.");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pa-modal-overlay">
      <div role="dialog" aria-modal="true" aria-labelledby="snapshots-title" className="pa-modal-content" style={{ maxWidth: 500 }}>
        <div className="pa-modal-header">
          <h2 id="snapshots-title"><Clock size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Historial de Versiones</h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar historial de versiones"><X size={18} /></button>
        </div>
        
        <div style={{ padding: 20 }}>
          <div style={{ background: '#FFF8E1', color: '#C98A12', padding: 12, borderRadius: 8, fontSize: 12, display: 'flex', gap: 8, marginBottom: 16 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Restaurar una versión sobrescribirá todas las tareas y conexiones actuales del proceso.</span>
          </div>

          {restoreError && (
            <div style={{ background: '#FCEDEA', color: '#A4271A', padding: 12, borderRadius: 8, fontSize: 12, display: 'flex', gap: 8, marginBottom: 16 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{restoreError}</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#5C6B6B', fontSize: 13 }}>Cargando versiones...</div>
          ) : snapshots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#5C6B6B', fontSize: 13 }}>No hay versiones guardadas. Se crea una versión automáticamente antes de aplicar una optimización o eliminar tareas, para que puedas deshacer los cambios.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
              {snapshots.map(snap => {
                const date = new Date(snap.created_at);
                const label = snap.snapshot_json?.label || "Versión guardada";
                return (
                  <div key={snap.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid #E2E7E3', borderRadius: 8, background: '#F8F9FA' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#15232E' }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#5C6B6B', marginTop: 4 }}>
                        {date.toLocaleDateString()} a las {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button 
                      className="pa-btn pa-btn-ghost" 
                      onClick={() => handleRestore(snap)}
                      disabled={restoringId === snap.id}
                      style={{ fontSize: 12, padding: '6px 12px', color: '#0B7E7E', border: '1px solid #D7F0F0' }}
                    >
                      {restoringId === snap.id ? 'Restaurando...' : <><RotateCcw size={14} style={{ marginRight: 6 }} /> Restaurar</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
