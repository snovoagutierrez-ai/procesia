/**
 * Historial del flujo: quien entro, quien cambio que y desde donde.
 *
 * Observaciones del 10/09. Se separan a proposito dos preguntas que el usuario
 * hacia juntas pero que no son la misma: «quien fue el ultimo en ENTRAR» y
 * «quien hizo el ultimo CAMBIO». Entrar a mirar no es tocar nada, y mezclarlas
 * daria por modificado un flujo que solo se consulto.
 *
 * Cada anotacion que apunta a un paso o a una compuerta se puede pulsar: lleva
 * al objeto y lo deja marcado en el diagrama, que es lo que se pedia con lo de
 * «marcar con un color el objeto modificado».
 *
 * La direccion IP solo llega desde el servidor si quien mira responde por el
 * flujo. No se pide aqui: se muestra lo que el servidor decida enviar.
 */
import React, { useEffect, useState } from 'react';
import { X, History, Loader2, ShieldCheck, LogIn, PenLine, Plus, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import { apiFetch } from '../../api.js';

const ICONO = {
  abrir: LogIn,
  crear: Plus,
  editar: PenLine,
  borrar: Trash2,
  restaurar: RotateCcw,
  optimizar: Sparkles,
};

/** «hace 5 min», «ayer»… Una fecha absoluta obliga a calcular mentalmente. */
export function haceCuanto(iso, ahora = Date.now()) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seg = Math.max(0, Math.round((ahora - t) / 1000));
  if (seg < 60) return "hace un momento";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString();
}

function Anotacion({ entrada, onIr }) {
  const Icono = ICONO[entrada.action] || PenLine;
  const puedeIr = !!entrada.target_bpmn_id && !!onIr;
  return (
    <li className={`pa-historial-fila${puedeIr ? ' pulsable' : ''}`}
      onClick={puedeIr ? () => onIr(entrada.target_bpmn_id) : undefined}
      title={puedeIr ? "Ver este objeto en el diagrama" : undefined}>
      <span className={`pa-historial-icono accion-${entrada.action}`}><Icono size={13} /></span>
      <div>
        <div className="pa-historial-texto">{entrada.summary || entrada.action}</div>
        <div className="pa-historial-meta">
          <strong>{entrada.is_mine ? 'Tú' : (entrada.author_email || 'alguien')}</strong>
          <span>· {haceCuanto(entrada.created_at)}</span>
          {entrada.ip_address && <span className="pa-historial-ip">· {entrada.ip_address}</span>}
        </div>
      </div>
    </li>
  );
}

export default function HistorialModal({ isOpen, onClose, processId, onIrAlObjeto }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !processId) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    apiFetch(`/processes/${processId}/activity`)
      .then(async (res) => {
        if (!vigente) return;
        if (!res.ok) throw new Error("no disponible");
        setDatos(await res.json());
      })
      .catch(() => vigente && setError("No se pudo cargar el historial."))
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

  const irYCerrar = (bpmnId) => { onIrAlObjeto?.(bpmnId); onClose(); };

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="historial-title"
        className="pa-modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h2 id="historial-title">
            <History size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Historial del flujo
          </h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar historial del flujo"><X size={18} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {cargando && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>
              <Loader2 size={18} className="spin" /> Cargando historial…
            </div>
          )}
          {error && (
            <div style={{ background: '#FCEDEA', color: '#A4271A', padding: 12, borderRadius: 8, fontSize: 12.5 }}>{error}</div>
          )}

          {datos && !cargando && (
            <>
              <div className="pa-historial-responsable">
                <ShieldCheck size={16} />
                <div>
                  <strong>Responsable del flujo</strong>
                  <div>{datos.owner_email || 'sin asignar'}{datos.soy_el_dueno && ' · eres tú'}</div>
                </div>
              </div>

              <div className="pa-historial-resumen">
                <div>
                  <span>Último en entrar</span>
                  {datos.ultima_entrada
                    ? <strong>{datos.ultima_entrada.is_mine ? 'Tú' : datos.ultima_entrada.author_email} · {haceCuanto(datos.ultima_entrada.created_at)}</strong>
                    : <strong className="vacio">Nadie todavía</strong>}
                </div>
                <div>
                  <span>Último cambio</span>
                  {datos.ultimo_cambio
                    ? <strong>{datos.ultimo_cambio.is_mine ? 'Tú' : datos.ultimo_cambio.author_email} · {haceCuanto(datos.ultimo_cambio.created_at)}</strong>
                    : <strong className="vacio">Sin cambios aún</strong>}
                </div>
              </div>

              {datos.soy_el_dueno && datos.entries.some(e => e.ip_address) && (
                <p className="pa-historial-aviso">
                  Ves las direcciones de conexión porque respondes por este flujo. El resto de
                  colaboradores no las ve.
                </p>
              )}

              {datos.entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>
                  Todavía no hay movimientos registrados en este flujo.
                </div>
              ) : (
                <ul className="pa-historial-lista">
                  {datos.entries.map(e => <Anotacion key={e.id} entrada={e} onIr={irYCerrar} />)}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
