/**
 * Mover un flujo de carpeta, o duplicarlo para reutilizar su esquema.
 *
 * Observacion del 10/09: un flujo que no corresponde a su carpeta no se podia
 * cambiar de sitio, y para partir de un flujo parecido habia que rehacerlo a
 * mano.
 *
 * Mover y duplicar se ofrecen juntos porque son la misma decision vista desde
 * dos lados —«este flujo no va aqui»— y elegir mal tiene consecuencias
 * distintas: mover se lleva el original, duplicar lo deja donde esta. Por eso
 * cada opcion dice en una linea que va a pasar, y el boton final nombra la
 * accion en vez de decir «Aceptar».
 */
import React, { useEffect, useState } from 'react';
import { X, FolderInput, Copy, Loader2 } from 'lucide-react';

export default function OrganizarProcesoModal({ isOpen, onClose, proceso, macroprocesos = [], onMover, onDuplicar }) {
  const [accion, setAccion] = useState('mover');
  const [destino, setDestino] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  // Cada vez que se abre para otro flujo, los campos parten de ese flujo.
  useEffect(() => {
    if (!isOpen || !proceso) return;
    setAccion('mover');
    setDestino(String(proceso.macroprocess_id || ''));
    setCodigo(`${proceso.code || 'PROC'}-COPIA`);
    setNombre(`${proceso.name || 'Proceso'} (copia)`);
    setError(null);
  }, [isOpen, proceso]);

  useEffect(() => {
    if (!isOpen) return;
    const alPulsar = (e) => { if (e.key === 'Escape' && !ocupado) onClose(); };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [isOpen, onClose, ocupado]);

  if (!isOpen || !proceso) return null;

  const carpetaActual = macroprocesos.find(m => m.id === proceso.macroprocess_id);
  const destinoId = Number(destino) || null;
  const mismaCarpeta = destinoId === proceso.macroprocess_id;

  const confirmar = async () => {
    setError(null);
    if (!destinoId) return setError('Elige una carpeta de destino.');
    if (accion === 'mover' && mismaCarpeta) return setError('El flujo ya está en esa carpeta.');
    if (accion === 'duplicar' && !codigo.trim()) return setError('La copia necesita un código.');

    setOcupado(true);
    try {
      const r = accion === 'mover'
        ? await onMover(proceso, destinoId)
        : await onDuplicar(proceso, destinoId, codigo.trim(), nombre.trim());
      if (r?.ok === false) setError(r.motivo || 'No se pudo completar la acción.');
      else onClose();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="pa-modal-overlay" onClick={() => !ocupado && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="organizar-title"
        className="pa-modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h2 id="organizar-title">
            <FolderInput size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Organizar flujo
          </h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar organizar flujo" disabled={ocupado}><X size={18} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--ink)' }}>{proceso.name}</strong>
            {carpetaActual && <> · ahora en <strong style={{ color: 'var(--ink)' }}>{carpetaActual.name}</strong></>}
          </p>

          <div className="pa-organizar-opciones">
            <label className={accion === 'mover' ? 'on' : ''}>
              <input type="radio" name="accion-organizar" value="mover"
                checked={accion === 'mover'} onChange={() => setAccion('mover')} />
              <span>
                <strong><FolderInput size={13} /> Mover a otra carpeta</strong>
                <small>El flujo cambia de sitio con todos sus datos. No queda copia en la carpeta actual.</small>
              </span>
            </label>
            <label className={accion === 'duplicar' ? 'on' : ''}>
              <input type="radio" name="accion-organizar" value="duplicar"
                checked={accion === 'duplicar'} onChange={() => setAccion('duplicar')} />
              <span>
                <strong><Copy size={13} /> Duplicar</strong>
                <small>Crea otro flujo con los mismos pasos y conexiones. El original se queda donde está.</small>
              </span>
            </label>
          </div>

          <label className="pa-label" style={{ marginTop: 16, display: 'block' }}>
            {accion === 'mover' ? 'Mover a la carpeta' : 'Crear la copia en'}
          </label>
          <select className="pa-input" value={destino} onChange={e => setDestino(e.target.value)}
            aria-label="Carpeta de destino" style={{ width: '100%' }}>
            {macroprocesos.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}{m.id === proceso.macroprocess_id ? ' (actual)' : ''}
              </option>
            ))}
          </select>

          {accion === 'duplicar' && (
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <div>
                <label className="pa-label" htmlFor="copia-codigo">Código de la copia</label>
                {/* El codigo es unico en todo el sistema: si choca, el servidor lo dice. */}
                <input id="copia-codigo" className="pa-input" value={codigo} style={{ width: '100%' }}
                  onChange={e => setCodigo(e.target.value)} />
              </div>
              <div>
                <label className="pa-label" htmlFor="copia-nombre">Nombre de la copia</label>
                <input id="copia-nombre" className="pa-input" value={nombre} style={{ width: '100%' }}
                  onChange={e => setNombre(e.target.value)} />
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Se copian los pasos, las compuertas, las conexiones, el RACI, los sistemas y la
                disposición del diagrama. No se copian los tiempos medidos en campo, los comentarios
                ni las versiones guardadas: pertenecen al recorrido de aquel flujo, no a su esquema.
              </p>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, background: '#FCEDEA', color: '#A4271A', padding: 10,
              borderRadius: 8, fontSize: 12.5 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="pa-btn pa-btn-ghost" onClick={onClose} disabled={ocupado}>Cancelar</button>
            <button className="pa-btn pa-btn-primary" onClick={confirmar} disabled={ocupado}>
              {ocupado ? <Loader2 size={15} className="spin" /> : (accion === 'mover' ? <FolderInput size={15} /> : <Copy size={15} />)}
              {ocupado ? 'Guardando…' : (accion === 'mover' ? 'Mover flujo' : 'Duplicar flujo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
