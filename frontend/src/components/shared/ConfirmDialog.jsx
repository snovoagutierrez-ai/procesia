import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({ isOpen, title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", onConfirm, onCancel, danger = false }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(19,32,43,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 14, padding: "24px 28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "pa-fade-in 0.15s ease" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          {danger && <AlertTriangle size={22} style={{ color: "#D9503C", flexShrink: 0, marginTop: 1 }} />}
          <div style={{ flex: 1 }}>
            <h3 id="confirm-dialog-title" style={{ margin: "0 0 6px", fontFamily: "var(--disp)", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{title}</h3>
            {message && <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>{message}</p>}
          </div>
          <button onClick={onCancel} aria-label="Cancelar y cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2, display: "flex", flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="pa-btn pa-btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            className="pa-btn pa-btn-primary"
            onClick={onConfirm}
            style={danger ? { background: "#D9503C" } : {}}
            autoFocus
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function InputDialog({ isOpen, title, placeholder = "", defaultValue = "", confirmLabel = "Crear", cancelLabel = "Cancelar", onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) { setValue(defaultValue); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  const handleSubmit = (e) => { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); };
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="input-dialog-title"
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(19,32,43,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 14, padding: "24px 28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 id="input-dialog-title" style={{ margin: 0, fontFamily: "var(--disp)", fontSize: 17, fontWeight: 700, color: "var(--text)" }}>{title}</h3>
          <button onClick={onCancel} aria-label="Cancelar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex" }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <input ref={inputRef} className="pa-input" value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="pa-btn pa-btn-ghost" onClick={onCancel}>{cancelLabel}</button>
            <button type="submit" className="pa-btn pa-btn-primary" disabled={!value.trim()}>{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState({ isOpen: false, title: "", message: "", confirmLabel: "Confirmar", danger: false, resolve: null });
  const confirm = (title, message, opts = {}) => new Promise(resolve => {
    setState({ isOpen: true, title, message, confirmLabel: opts.confirmLabel || "Confirmar", danger: opts.danger || false, resolve });
  });
  const handleConfirm = () => { state.resolve(true); setState(s => ({ ...s, isOpen: false })); };
  const handleCancel = () => { state.resolve(false); setState(s => ({ ...s, isOpen: false })); };
  const dialog = <ConfirmDialog {...state} onConfirm={handleConfirm} onCancel={handleCancel} />;
  return { confirm, dialog };
}

export function useInputDialog() {
  const [state, setState] = useState({ isOpen: false, title: "", placeholder: "", defaultValue: "", confirmLabel: "Crear", resolve: null });
  const showInput = (title, opts = {}) => new Promise(resolve => {
    setState({ isOpen: true, title, placeholder: opts.placeholder || "", defaultValue: opts.defaultValue || "", confirmLabel: opts.confirmLabel || "Crear", resolve });
  });
  const handleConfirm = (value) => { state.resolve(value); setState(s => ({ ...s, isOpen: false })); };
  const handleCancel = () => { state.resolve(null); setState(s => ({ ...s, isOpen: false })); };
  const inputDialog = <InputDialog {...state} onConfirm={handleConfirm} onCancel={handleCancel} />;
  return { showInput, inputDialog };
}
