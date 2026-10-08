import React, { useCallback, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiFetch, apiMutate } from '../../api.js';
import { useConfirm } from '../shared/ConfirmDialog.jsx';

const STATUS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };

export default function DeletionRequestsModal({ isAdmin, onClose, onDeleted }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState({});
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/deletion-requests');
      if (!res.ok) throw new Error('No se pudieron cargar las solicitudes.');
      setRequests(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape' && busy === null && !confirming) onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, busy, confirming]);

  const review = async (request, decision) => {
    if (decision === 'approved') {
      setConfirming(true);
      const accepted = await confirm('Eliminar proceso',
        `¿Eliminar «${request.process_name}», sus tareas y versiones guardadas? Esta acción no se puede deshacer.`,
        { danger: true, confirmLabel: 'Aprobar y eliminar' });
      setConfirming(false);
      if (!accepted) return;
    }
    setBusy(request.id);
    setError('');
    try {
      const res = await apiMutate(`/deletion-requests/${request.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, review_note: notes[request.id] || '' }),
      });
      const updated = await res.json();
      setRequests(prev => prev.map(row => row.id === request.id ? updated : row));
      if (decision === 'approved') onDeleted(request.process_id);
    } catch (err) { setError(err.message || 'No se pudo resolver la solicitud.'); }
    finally { setBusy(null); }
  };

  return <>
    <div className="pa-deletion-overlay">
      <section className="pa-deletion-modal" role="dialog" aria-modal="true" aria-labelledby="deletion-title">
        <div className="pa-deletion-header">
          <h2 id="deletion-title">{isAdmin ? 'Solicitudes de eliminación' : 'Mis solicitudes de eliminación'}</h2>
          <button type="button" className="pa-btn pa-btn-ghost" disabled={busy !== null} aria-label="Cerrar solicitudes" onClick={onClose}><X size={18} /></button>
        </div>
        <p>El proceso permanece disponible hasta que un administrador apruebe su eliminación.</p>
        <button type="button" className="pa-btn pa-btn-ghost" disabled={loading || busy !== null} onClick={load}>Actualizar solicitudes</button>
        {loading && <p role="status"><Loader2 size={16} className="spin" /> Cargando solicitudes…</p>}
        {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
        {!loading && !error && requests.length === 0 && <p>No hay solicitudes de eliminación.</p>}
        <ul className="pa-deletion-list">
          {requests.map(request => <li key={request.id}>
            <strong>{request.process_code} · {request.process_name}</strong>
            <span className="pa-tag">{STATUS[request.status]}</span>
            <p>{request.reason}</p>
            <small>Solicitada por {request.requester_email || 'usuario dado de baja'} · {new Date(request.created_at).toLocaleString('es-CL')}</small>
            {request.reviewed_at && <p>Resuelta por {request.reviewer_email || 'administrador'} · {new Date(request.reviewed_at).toLocaleString('es-CL')}{request.review_note && ` · ${request.review_note}`}</p>}
            {isAdmin && request.status === 'pending' && request.process_id && <div className="pa-deletion-actions">
              <label>Comentario de resolución (opcional)
                <textarea className="pa-input" rows={2} maxLength={1000} value={notes[request.id] || ''}
                  disabled={busy !== null} onChange={e => setNotes(prev => ({ ...prev, [request.id]: e.target.value }))} />
              </label>
              <button type="button" className="pa-btn pa-btn-danger" disabled={busy !== null} onClick={() => review(request, 'approved')}>Aprobar y eliminar</button>
              <button type="button" className="pa-btn pa-btn-ghost" disabled={busy !== null} onClick={() => review(request, 'rejected')}>Rechazar</button>
            </div>}
            {request.status === 'pending' && !request.process_id && <p>El proceso ya fue eliminado.</p>}
          </li>)}
        </ul>
      </section>
    </div>
    {dialog}
  </>;
}
