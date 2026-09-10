import React, { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';

// Segmented control button group
export function Seg({ value, options, onChange }) {
  return (
    <div className="pa-seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
          style={value === o.value && o.color ? { background: o.color, borderColor: o.color, color: "#fff" } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Labelled field wrapper with optional tooltip popover
export function Field({ label, tooltip, children }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div className="pa-field" style={{ position: 'relative' }}>
      <label className="pa-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {tooltip && (
          <button
            type="button"
            className="pa-icon pa-tooltip-btn"
            onClick={(e) => { e.preventDefault(); setOpen(!open); }}
            aria-label="Más información"
            aria-expanded={open}
            style={{
              background: 'none', border: 'none', padding: 0, margin: 0,
              color: '#0E9F9F', cursor: 'pointer', outline: 'none', display: 'inline-flex'
            }}
          >
            <Info size={14} />
          </button>
        )}
      </label>
      {open && (
        <div ref={popoverRef} style={{
          position: 'absolute', top: 24, left: 0, zIndex: 100,
          background: '#13202B', color: '#fff', padding: '10px 14px',
          borderRadius: 8, fontSize: 13, fontWeight: 400, width: 'max-content', maxWidth: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', lineHeight: 1.5,
          whiteSpace: 'normal', pointerEvents: 'auto'
        }}>
          {tooltip}
        </div>
      )}
      {children}
    </div>
  );
}

// Unidades que ofrece el selector de duracion.
export const UNIDADES = [
  { valor: 1, etiqueta: "s" },
  { valor: 60, etiqueta: "m" },
  { valor: 3600, etiqueta: "h" },
  { valor: 86400, etiqueta: "d" },
];

/**
 * Unidad con la que se lee mejor una duracion.
 *
 * Usa la MISMA escala que fmtShort, que es lo que pintan las tarjetas del
 * diagrama: segundos, minutos y de ahi en adelante horas. Nunca elige dias por
 * su cuenta. Antes si lo hacia, y 86400 s salia como «1 d» en el panel mientras
 * la tarjeta decia «24h»: el mismo dato contado de dos formas, que se leia como
 * una incongruencia.
 */
export function unidadNatural(sec) {
  const n = Number(sec) || 0;
  if (n < 60) return 1;
  if (n < 3600) return 60;
  return 3600;
}

/**
 * Duracion con selector de unidad. El valor viaja siempre en segundos.
 *
 * La unidad se deriva del valor salvo que la persona elija otra mientras edita.
 * `resetKey` identifica a quien pertenece el dato (el id del paso): cuando
 * cambia, la eleccion manual se descarta porque era del paso anterior. Sin esto
 * la unidad se quedaba pegada al cambiar de tarea y el numero del panel dejaba
 * de coincidir con el de la tarjeta del diagrama.
 */
export function TimeField({ label, tooltip, valueSec, onChangeSec, resetKey }) {
  const [elegida, setElegida] = useState(null);
  // La clave anterior se guarda en ESTADO, no en una referencia. Con una
  // referencia el reinicio se perdia: React renderiza dos veces en desarrollo
  // (StrictMode) y la referencia, ya mutada en la primera pasada, hacia que la
  // segunda no detectara el cambio de paso. El sintoma era el de la
  // observacion: la unidad se quedaba pegada de la tarea anterior.
  const [claveAnterior, setClaveAnterior] = useState(resetKey);

  if (claveAnterior !== resetKey) {
    setClaveAnterior(resetKey);
    setElegida(null);
  }

  const unidad = elegida ?? unidadNatural(valueSec);
  const mostrado = (Number(valueSec) || 0) / unidad;

  const emite = (segundos, unidadFijada) => {
    setElegida(unidadFijada);
    onChangeSec(segundos);
  };

  return (
    <Field label={label} tooltip={tooltip}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="pa-input"
          type="number" min="0" step="any" placeholder="0"
          value={Number(valueSec) === 0 ? "" : String(mostrado)}
          // Al escribir se fija la unidad actual: si no, teclear «90» en minutos
          // saltaria solo a «1.5 h» bajo los dedos.
          onChange={e => emite(e.target.value === "" ? 0 : (Number(e.target.value) || 0) * unidad, unidad)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <select className="pa-input" value={unidad} aria-label={`Unidad de ${label}`}
          onChange={e => {
            const nueva = Number(e.target.value);
            emite(mostrado * nueva, nueva);   // se conserva el numero escrito
          }} style={{ width: 70, padding: '0 4px' }}>
          {UNIDADES.map(u => <option key={u.valor} value={u.valor}>{u.etiqueta}</option>)}
        </select>
      </div>
    </Field>
  );
}
