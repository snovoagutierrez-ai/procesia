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
            aria-label="Ayuda"
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

// Time input with unit selector (s / m / h / d)
export function TimeField({ label, tooltip, valueSec, onChangeSec }) {
  const [unit, setUnit] = useState(
    valueSec >= 86400 && valueSec % 86400 === 0 ? 86400
    : valueSec >= 3600 && valueSec % 3600 === 0 ? 3600
    : valueSec >= 60 && valueSec % 60 === 0 ? 60
    : 1
  );
  const displayVal = valueSec / unit;
  return (
    <Field label={label} tooltip={tooltip}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="pa-input"
          type="number" min="0" step="any" placeholder="0"
          value={valueSec === 0 ? "" : displayVal}
          onChange={e => onChangeSec(e.target.value === "" ? 0 : (Number(e.target.value) || 0) * unit)}
          style={{ flex: 1 }}
        />
        <select className="pa-input" value={unit} onChange={e => {
          const newU = Number(e.target.value);
          setUnit(newU);
          onChangeSec(displayVal * newU);
        }} style={{ width: 70, padding: '0 4px' }}>
          <option value={1}>s</option>
          <option value={60}>m</option>
          <option value={3600}>h</option>
          <option value={86400}>d</option>
        </select>
      </div>
    </Field>
  );
}
