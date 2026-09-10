/**
 * Glosario de nomenclaturas del proceso.
 *
 * Observacion del 10/09: hacia falta una glosa de siglas con su significado y
 * una tabla referencial. Los procesos reales estan llenos de nomenclatura
 * interna («SIGEPAC», «NP», «Subcontrato») que quien lee el diagrama por
 * primera vez no puede descifrar, y ese es justo el momento en que el mapa
 * deberia explicarse solo.
 *
 * El glosario viaja tambien al informe: es donde mas falta hace, porque el
 * informe se comparte con gente que no estuvo en el levantamiento.
 */
import React, { useEffect, useState } from 'react';
import { X, BookMarked, Plus, Trash2, Loader2 } from 'lucide-react';
import { apiFetch, apiMutate } from '../../api.js';

const VACIO = { term: "", meaning: "", reference: "" };

export default function GlosarioModal({ isOpen, onClose, processId, onCambio }) {
  const [terminos, setTerminos] = useState([]);
  const [borrador, setBorrador] = useState(VACIO);
  const [cargando, setCargando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !processId) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    apiFetch(`/processes/${processId}/glossary`)
      .then(async (res) => { if (vigente && res.ok) setTerminos(await res.json()); })
      .catch(() => vigente && setError("No se pudo cargar el glosario."))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [isOpen, processId]);

  useEffect(() => {
    if (!isOpen) return;
    const alPulsar = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const anadir = async () => {
    const term = borrador.term.trim();
    const meaning = borrador.meaning.trim();
    if (!term || !meaning) {
      setError("Una nomenclatura necesita la sigla y lo que significa.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      // apiMutate devuelve la Response, no el cuerpo ya leido.
      const res = await apiMutate(`/processes/${processId}/glossary`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term, meaning, reference: borrador.reference.trim() || null,
                               position_order: terminos.length }),
      });
      const creado = await res.json();
      const lista = [...terminos, creado];
      setTerminos(lista);
      setBorrador(VACIO);
      onCambio?.(lista);
    } catch (e) {
      setError(e.message || "No se pudo añadir la nomenclatura.");
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async (t) => {
    try {
      await apiMutate(`/processes/${processId}/glossary/${t.id}`, { method: "DELETE" });
      const lista = terminos.filter(x => x.id !== t.id);
      setTerminos(lista);
      onCambio?.(lista);
    } catch {
      setError("No se pudo borrar la nomenclatura.");
    }
  };

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="glosario-title"
        className="pa-modal-content" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h2 id="glosario-title">
            <BookMarked size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Nomenclaturas del proceso
          </h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar nomenclaturas"><X size={18} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
            Las siglas y términos internos que aparecen en este flujo, con su significado.
            Se incluyen en el informe, que es donde más falta hacen: lo lee gente que no
            estuvo en el levantamiento.
          </p>

          <div className="pa-glosario-alta">
            <input className="pa-input" placeholder="Sigla o término" aria-label="Sigla o término"
              value={borrador.term} maxLength={80}
              onChange={e => setBorrador({ ...borrador, term: e.target.value })} />
            <input className="pa-input" placeholder="Qué significa" aria-label="Qué significa"
              value={borrador.meaning} maxLength={400}
              onChange={e => setBorrador({ ...borrador, meaning: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') anadir(); }} />
            <input className="pa-input" placeholder="Referencia (opcional)" aria-label="Referencia"
              value={borrador.reference} maxLength={200}
              onChange={e => setBorrador({ ...borrador, reference: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') anadir(); }} />
            <button className="pa-btn pa-btn-primary" onClick={anadir} disabled={ocupado}>
              {ocupado ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Añadir
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 12, background: '#FCEDEA', color: '#A4271A', padding: 10,
              borderRadius: 8, fontSize: 12.5 }}>{error}</div>
          )}

          {cargando ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>
              <Loader2 size={18} className="spin" /> Cargando…
            </div>
          ) : terminos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>
              Todavía no hay nomenclaturas. Añade las siglas que usa este proceso para que
              cualquiera pueda leer el diagrama sin preguntar.
            </div>
          ) : (
            <table className="pa-glosario-tabla">
              <thead>
                <tr><th>Término</th><th>Significado</th><th>Referencia</th><th aria-label="Acciones"></th></tr>
              </thead>
              <tbody>
                {terminos.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.term}</strong></td>
                    <td>{t.meaning}</td>
                    <td className="ref">{t.reference || '—'}</td>
                    <td>
                      <button type="button" onClick={() => borrar(t)}
                        aria-label={`Borrar ${t.term}`} title="Borrar">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
