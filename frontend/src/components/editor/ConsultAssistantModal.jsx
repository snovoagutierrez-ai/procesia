import React, { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Send, Loader2, Sparkles } from 'lucide-react';
import { apiFetch } from '../../api.js';

const SUGGESTIONS = [
  '¿Qué es un cuello de botella?',
  '¿Cómo clasifico el valor de una tarea (VA, NNVA, NVA)?',
  '¿Para qué sirve una compuerta?',
  '¿Qué mide la eficiencia de ciclo (PCE)?',
];

export default function ConsultAssistantModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  if (!isOpen) return null;

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await apiFetch('/tutorial-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => [...m, { role: 'assistant', text: data.reply }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', text: 'Ocurrió un error de conexión con el asistente. Intenta de nuevo.' }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: 'No pudimos conectar con la IA en este momento.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pa-modal-overlay pa-consult-overlay">
      <div role="dialog" aria-modal="true" aria-labelledby="consult-assistant-title" className="pa-modal-content pa-consult-modal">
        <div className="pa-modal-header">
          <h2 id="consult-assistant-title"><MessageSquare size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Asistente de consultas</h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar asistente de consultas"><X size={18} /></button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', maxWidth: 380 }}>
              <Sparkles size={32} style={{ color: 'var(--teal)', marginBottom: 10 }} />
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 16px' }}>
                Pregúntame sobre mapeo de procesos, metodología Lean, BPMN o cómo usar AiProces.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="pa-btn pa-btn-ghost pa-btn-sm" style={{ fontSize: 12 }} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <div style={{
                padding: '10px 13px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? 'var(--teal)' : '#F1F5F4',
                color: m.role === 'user' ? '#fff' : 'var(--ink)',
                borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: m.role === 'user' ? 12 : 4,
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Loader2 size={15} className="spin" /> Pensando…
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', padding: 14, display: 'flex', gap: 8 }}>
          <input
            className="pa-input"
            placeholder="Escribe tu consulta…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            style={{ flex: 1, fontSize: 16 }}
          />
          <button className="pa-btn pa-btn-primary" onClick={() => send()} disabled={loading || !input.trim()} aria-label="Enviar consulta" style={{ padding: '0 16px' }}>
            {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
