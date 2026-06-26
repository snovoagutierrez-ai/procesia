import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, Trash2, Check, ChevronUp, ChevronDown, Sparkles, Loader2, ArrowRight, AlertTriangle, X, Lightbulb, Info, Send } from 'lucide-react';
import { VALUE, WASTE, TYPES, ACTION, SEVERITY, WASTE_QUESTIONS } from '../../constants.js';
import { apiFetch } from '../../api.js';
import { Seg, Field, TimeField } from '../shared/uiAtoms.jsx';
import Banner from '../shared/Banner.jsx';

function ClickableTooltip({ content }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} ref={containerRef}>
      <button 
        type="button"
        className="pa-icon" 
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
        style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer' }}
        aria-label="Más información"
        aria-expanded={open}
      >
        <Info size={14} style={{ color: 'var(--muted)' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translate(-50%, -8px)',
          background: 'var(--ink)',
          color: 'var(--inv)',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '12px',
          lineHeight: '1.5',
          width: 'max-content',
          maxWidth: '250px',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          textAlign: 'left'
        }}>
          {content}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '6px',
            borderStyle: 'solid',
            borderColor: 'var(--ink) transparent transparent transparent'
          }} />
        </div>
      )}
    </div>
  );
}

function ValueClassWizard({ valueClass, wasteType, onChange, expertMode, setExpertMode }) {
  const [step, setStep] = useState(0);
  const [forceWizard, setForceWizard] = useState(!valueClass);
  const [wizardCompleted, setWizardCompleted] = useState(false);

  useEffect(() => {
    if (valueClass && !forceWizard) {
      setStep(0);
    }
  }, [valueClass, forceWizard]);

  useEffect(() => {
    if (valueClass) {
      setForceWizard(false);
      setWizardCompleted(true);
    } else {
      setWizardCompleted(false);
      setForceWizard(true);
    }
  }, [valueClass]);

  if (expertMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Seg value={valueClass} onChange={(v) => onChange(v, v === "NVA" ? wasteType || "waiting" : "")}
             options={Object.entries(VALUE).map(([k, m]) => ({ value: k, label: m.short, color: m.color }))} />
        {valueClass === "NVA" && (
          <select className="pa-input" value={wasteType || "waiting"} onChange={(e) => onChange("NVA", e.target.value)}>
            {Object.entries(WASTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>
    );
  }

  if (valueClass && !forceWizard) {
    const valObj = VALUE[valueClass];
    return (
      <div style={{ background: '#F8F9FA', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className="pa-badge" style={{ background: valObj?.color, color: '#fff', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}>
              {valObj?.short || valueClass}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
              {valueClass === "NVA" ? `Desperdicio: ${WASTE[wasteType] || wasteType}` : valObj?.label}
            </span>
          </div>
          <button className="pa-btn pa-btn-ghost" onClick={() => { setStep(0); setForceWizard(true); setWizardCompleted(false); }} style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--teal)' }}>
            {wizardCompleted ? "Cambiar respuesta" : "¿No estás seguro? Te ayudamos a decidir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--teal)', boxShadow: '0 4px 12px rgba(14, 159, 159, 0.1)' }}>
      {step === 0 && (
        <div className="wizard-step fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <p style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.5, color: 'var(--text)', margin: 0, paddingRight: 12 }}>
              Si tu cliente viera este paso, ¿pagaría con gusto por él? Es decir, ¿lo hace porque mejora directamente lo que va a recibir?
            </p>
            <button className="pa-btn pa-btn-ghost" onClick={() => setExpertMode(true)} style={{ padding: '4px', height: 'auto', minHeight: 'auto', color: 'var(--muted)' }} title="Cancelar asistente">
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="pa-btn pa-btn-primary" style={{ flex: 1, minHeight: '44px', fontSize: '14px' }} onClick={() => setStep(3)}>Sí, agrega valor</button>
            <button className="pa-btn pa-btn-ghost" style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }} onClick={() => setStep(1)}>
              No
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-step fade-in">
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '16px', lineHeight: 1.5, color: 'var(--text)' }}>
            ¿Este paso existe por una obligación externa (una ley, una norma, un contrato, una auditoría) y no porque el cliente lo pida?
          </p>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button className="pa-btn pa-btn-primary" style={{ flex: 1, minHeight: '44px', fontSize: '14px' }} onClick={() => setStep(4)}>Sí, es obligatorio</button>
            <button className="pa-btn pa-btn-ghost" style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }} onClick={() => setStep(2)}>
              No, no es obligatorio
            </button>
          </div>
          <button className="pa-btn pa-btn-ghost" onClick={() => setStep(0)} style={{ fontSize: '13px', padding: 0, color: 'var(--muted)' }}>
            <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step fade-in">
          <div style={{ background: '#FFF3E0', color: '#B06000', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 500 }}>
            Este paso parece ser un desperdicio: no lo pide el cliente ni una obligación externa. Vamos a identificar de qué tipo es.
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--text)' }}>
            Elige la descripción que más se parezca a tu caso:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px', marginBottom: '16px' }}>
            {WASTE_QUESTIONS.map(w => (
              <button key={w.value} 
                className="pa-btn pa-btn-ghost" 
                style={{ textAlign: 'left', display: 'block', height: 'auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '8px', whiteSpace: 'normal', lineHeight: 1.4 }}
                onClick={() => {
                  onChange("NVA", w.value);
                  setWizardCompleted(true);
                  setForceWizard(false);
                }}
              >
                <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--danger)' }}>{w.label}</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 400 }}>{w.question}</span>
              </button>
            ))}
          </div>
          <button className="pa-btn pa-btn-ghost" onClick={() => setStep(1)} style={{ fontSize: '13px', padding: 0, color: 'var(--muted)' }}>
            <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-step fade-in" style={{ textAlign: 'center' }}>
          <div style={{ background: '#E8F5E9', color: '#1FA463', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '15px', fontWeight: 600 }}>
            Listo, este paso es de Valor Agregado.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="pa-btn pa-btn-ghost" onClick={() => setStep(0)} style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }}>
              <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
            </button>
            <button className="pa-btn pa-btn-primary" style={{ flex: 2, minHeight: '44px', fontSize: '14px' }} onClick={() => {
              onChange("VA", "");
              setWizardCompleted(true);
              setForceWizard(false);
            }}>Entendido</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="wizard-step fade-in" style={{ textAlign: 'center' }}>
          <div style={{ background: '#FFF8E1', color: '#C98A12', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>
            Entendido, este paso es necesario por control o regulación, aunque no le agregue valor directo al cliente.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="pa-btn pa-btn-ghost" onClick={() => setStep(1)} style={{ flex: 1, minHeight: '44px', fontSize: '14px', border: '1px solid var(--line)' }}>
              <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Atrás
            </button>
            <button className="pa-btn pa-btn-primary" style={{ flex: 2, minHeight: '44px', fontSize: '14px' }} onClick={() => {
              onChange("NNVA", "");
              setWizardCompleted(true);
              setForceWizard(false);
            }}>Entendido</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); setExpertMode(true); }} style={{ fontSize: '12px', color: 'var(--teal)', textDecoration: 'none' }}>
          Prefiero elegir directamente (Modo Experto)
        </a>
      </div>
    </div>
  );
}

function TaskAssistant({ task, onChange }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const handleSend = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/tasks/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          current_name: task.name,
          current_type: task.type,
          current_value_class: task.valueClass
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResponse(data);
      }
    } catch (e) {
      console.error(e);
      setResponse({ reply: `Error de conexión: ${e.message}`, suggestions: {} });
    } finally {
      setLoading(false);
    }
  };

  const TYPE_LABEL_TO_KEY = { "Persona": "user", "Manual": "manual", "Sistema": "service" };

  const handleApply = () => {
    if (!response || !response.suggestions) return;
    const { name, type, valueClass } = response.suggestions;
    const patch = {};
    if (name) patch.name = name;
    if (type) {
      const typeKey = TYPE_LABEL_TO_KEY[type] || (["user", "manual", "service"].includes(type) ? type : null);
      if (typeKey) patch.type = typeKey;
    }
    if (valueClass) {
      const vc = valueClass === "BVA" ? "NNVA" : valueClass;
      if (["VA", "NNVA", "NVA"].includes(vc)) patch.valueClass = vc;
    }
    onChange(patch);
    setOpen(false);
    setResponse(null);
    setText("");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {!open ? (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button className="pa-btn" onClick={() => setOpen(true)} style={{ color: "var(--teal)", background: "#fff", border: "1px solid #BFE6E6", borderRadius: '20px', fontSize: '12px', padding: '4px 12px', height: '28px', minHeight: 'auto', display: 'flex', gap: '6px' }}>
            <Sparkles size={14} /> Usar asistente guiado
          </button>
        </div>
      ) : (
        <div style={{ background: '#F1FBFB', border: '1px solid #0E9F9F', padding: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0B7A7A', fontWeight: 600 }}>
              <Sparkles size={16} />
              <span>Asistente Guiado IA</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={16} /></button>
          </div>
          
          <p style={{ fontSize: '12.5px', color: 'var(--text)', marginBottom: '12px', lineHeight: 1.5 }}>
            Cuéntame con tus propias palabras qué ocurre en este paso y yo configuraré la metodología por ti.
          </p>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              className="pa-input" 
              style={{ flex: 1, background: '#fff', borderColor: '#BFE6E6' }}
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder="Ej: Aquí el contador revisa el documento..."
              onKeyDown={(e) => { if(e.key === 'Enter') handleSend() }}
            />
            <button className="pa-btn pa-btn-primary" onClick={handleSend} disabled={loading || !text.trim()}>
              {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          </div>

          {response && (
            <div style={{ background: '#fff', border: '1px solid #E2E7E3', padding: '12px', borderRadius: '6px', fontSize: '13px', marginTop: '12px' }}>
              <p style={{ margin: '0 0 12px 0', lineHeight: 1.5 }}>{response.reply}</p>
              {response.suggestions && Object.keys(response.suggestions).length > 0 && (
                <button className="pa-btn pa-btn-primary" onClick={handleApply} style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}>
                  <Check size={16} /> Aplicar sugerencias
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ task, onChange, onMove, onDelete, isFirst, isLast, saveState = { status: 'idle' }, expertMode, setExpertMode, onDone, sequenceFlows = [], gateways = [], tasks = [], onFlowsChange, onForceSave, firstStepsActive, guideStep, onGuideComplete }) {
  const [showSaved, setShowSaved] = useState(false);
  const handleSave = async () => {
    if (onForceSave) await onForceSave();
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
      if (onDone) onDone();
    }, 800);
  };

  if (!task)
    return <div className="pa-empty">Selecciona un paso en el diagrama o en la lista para ver y editar sus datos.</div>;
  const set = (patch) => onChange(task.id, patch);
  return (
    <div className="pa-editor">
      <div className="pa-editor-head">
        <span className="pa-tag" style={{ fontFamily: "var(--body)", background: "#E8F5E9", color: "#1FA463", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>Tarea</span>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', marginRight: '16px', fontSize: '13px', gap: '6px' }}>
          {saveState.status === 'saving' && <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Loader2 size={14} className="spin" /> Guardando...</span>}
          {(saveState.status === 'saved' || showSaved) && <span style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><Check size={14} /> ¡Guardado!</span>}
          {saveState.status === 'error' && <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={14} /> Error</span>}
        </div>
        <div className="pa-editor-actions">
          <button className="pa-btn pa-btn-primary" onClick={handleSave} style={{ fontSize: '12px', padding: '4px 12px', minHeight: 'auto', height: '28px' }}>Guardar</button>
          <button className="pa-icon danger" style={{ marginLeft: 8 }} onClick={() => onDelete(task.id)} title="Eliminar"><Trash2 size={16} /></button>
        </div>
      </div>

      <TaskAssistant task={task} onChange={set} />

      <Field label="Nombre de la tarea" tooltip="Nombre corto y descriptivo de la acción (Ej: 'Revisar factura').">
        <input 
          className={`pa-input ${firstStepsActive && guideStep === 2 ? 'pulse-border' : ''}`} 
          value={task.name} 
          onChange={(e) => { 
            set({ name: e.target.value }); 
            if(firstStepsActive && onGuideComplete) onGuideComplete(); 
          }} 
        />
      </Field>

      <div className="pa-row">
        <Field label="Tipo" tooltip="Define la naturaleza técnica de la tarea: si la hace un usuario, un sistema automático, o si es un envío/recepción de mensajes.">
          <Seg value={task.type} onChange={(v) => set({ type: v })}
            options={Object.entries(TYPES).map(([k, m]) => ({ value: k, label: m.label }))} />
        </Field>
      </div>

      <div className="pa-row two">
        <TimeField label="Tiempo de ciclo" tooltip="Tiempo real trabajando en la tarea (Processing Time)." valueSec={task.cycleTime} onChangeSec={(v) => set({ cycleTime: v })} />
        <TimeField label="Tiempo de espera" tooltip="Tiempo inactivo antes de que esta tarea comience (Wait Time)." valueSec={task.waitTime} onChangeSec={(v) => set({ waitTime: v })} />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          Clasificación de valor 
          <ClickableTooltip content={
            <>
              <strong>Valor Agregado (VA):</strong> El cliente lo valora y paga por ello.<br/>
              <strong>Necesario sin valor (NNVA):</strong> Regulaciones, leyes o control interno.<br/>
              <strong>Desperdicio (NVA):</strong> Tareas que podrían eliminarse.
            </>
          } />
        </div>
        <div className={firstStepsActive && guideStep === 2 ? 'pulse-border-container' : ''}>
          <ValueClassWizard 
            valueClass={task.valueClass} 
            wasteType={task.wasteType} 
            onChange={(v, w) => {
              set({ valueClass: v, wasteType: w });
              if(firstStepsActive && onGuideComplete) onGuideComplete();
            }}
            expertMode={expertMode}
            setExpertMode={setExpertMode}
          />
        </div>
      </div>

      <div className="pa-divider"><span>RACI</span></div>
      <div className="pa-row two">
        <Field label="Responsable (R)" tooltip="Quien ejecuta la tarea."><input className="pa-input" value={task.responsible} onChange={(e) => set({ responsible: e.target.value })} /></Field>
        <Field label="Aprobador (A)" tooltip="Quien aprueba o responde por el éxito de la tarea."><input className="pa-input" value={task.accountable} onChange={(e) => set({ accountable: e.target.value })} /></Field>
      </div>
      <div className="pa-row two">
        <Field label="Consultado (C)" tooltip="Quien aporta información necesaria."><input className="pa-input" value={task.consulted} onChange={(e) => set({ consulted: e.target.value })} /></Field>
        <Field label="Informado (I)" tooltip="A quien se le notifica el resultado."><input className="pa-input" value={task.informed} onChange={(e) => set({ informed: e.target.value })} /></Field>
      </div>

      <div className="pa-divider"><span>Sistemas</span></div>
      <Field label="Sistemas / Herramientas" tooltip="Aplicaciones, ERPs o herramientas usadas en esta tarea.">
        <input className="pa-input" value={task.systems} onChange={(e) => set({ systems: e.target.value })} placeholder="Ej: SAP, Excel, Jira..." />
      </Field>

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#0E9F9F', flex: 1, minWidth: '150px' }}>Guardado automático activado</span>
        <button className="pa-btn pa-btn-ghost" style={{ color: '#D9503C', borderColor: '#D9503C' }} onClick={() => onDelete(task.id)}>
          <Trash2 size={16} style={{ marginRight: 4 }} /> Borrar tarea
        </button>
        <button className="pa-btn pa-btn-primary" onClick={handleSave} style={{ minWidth: 100 }}>
          {showSaved ? <><Check size={16} /> Guardado</> : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function GatewayEditor({ gateway, onChange, onDelete, saveState = { status: 'idle' }, onDone }) {
  const [showSaved, setShowSaved] = useState(false);
  const handleSave = () => {
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
      if (onDone) onDone();
    }, 800);
  };
  return (
    <div className="pa-editor">
      <div className="pa-editor-head">
        <span className="pa-tag" style={{ fontFamily: "var(--body)", background: "#EBF0EC", color: "#0E9F9F", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>Compuerta</span>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', marginRight: '16px', fontSize: '12px', color: saveState.status === 'error' ? 'var(--danger)' : 'var(--teal)', gap: '4px' }}>
          {saveState.status === 'saving' && <><Loader2 size={12} className="spin" /> Guardando...</>}
          {saveState.status === 'saved' && <><Check size={12} /> Guardado</>}
          {saveState.status === 'error' && <><AlertTriangle size={12} /> Error al guardar</>}
          {saveState.status === 'idle' && 'Guardado automático activado'}
        </div>
        <div className="pa-editor-actions">
          <button className="pa-btn pa-btn-ghost" onClick={() => onDelete(gateway.bpmn_id)}>Eliminar</button>
        </div>
      </div>
      <div className="pa-form">
        <Field label="Nombre de la decisión" tooltip="Nombre o pregunta que se evalúa (Ej: '¿Aprobado?').">
          <input className="pa-input" value={gateway.name || ""} onChange={(e) => onChange(gateway.bpmn_id, { name: e.target.value })} />
        </Field>
        <Field label="Tipo de compuerta" tooltip="Exclusiva: Solo se toma un camino. Paralela: Se toman todos los caminos al mismo tiempo.">
          <select className="pa-input" value={gateway.node_type} onChange={(e) => onChange(gateway.bpmn_id, { node_type: e.target.value })}>
            <option value="exclusiveGateway">Exclusiva (X)</option>
            <option value="parallelGateway">Paralela (+)</option>
          </select>
        </Field>
        <div style={{ marginTop: 16 }}>
          <Banner variant="info" title="¿Cómo conectar?">
            Arrastra desde los puntos conectores de los nodos en el diagrama hacia esta compuerta para conectarla. Usa la tecla Retroceso (Backspace) para eliminar flechas erróneas.
          </Banner>
        </div>
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#0E9F9F', flex: 1, minWidth: '150px' }}>Guardado automático activado</span>
          <button className="pa-btn pa-btn-ghost" style={{ color: '#D9503C', borderColor: '#D9503C' }} onClick={() => onDelete(gateway.bpmn_id)}>
            <Trash2 size={16} style={{ marginRight: 4 }} /> Borrar compuerta
          </button>
          <button className="pa-btn pa-btn-primary" onClick={handleSave} style={{ minWidth: 100 }}>
            {showSaved ? <><Check size={16} /> Guardado</> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Optimization({ state, onRun, onApply, onApplyRecommendation, tasks }) {
  const d = state.data;
  const [appliedIndices, setAppliedIndices] = useState([]);
  const incompleteTasks = tasks?.filter(t => !t.responsible || !t.valueClass || t.cycleTime === undefined);
  const isReady = tasks?.length > 0 && incompleteTasks?.length === 0;
  return (
    <div className="pa-opt">
      <div className="pa-opt-head">
        <div>
          <h3>Optimización con IA</h3>
          <p>El motor analiza tiempos, RACI, sistemas y valor para detectar cuellos de botella y desperdicios.</p>
        </div>
        <button className="pa-btn pa-btn-primary" onClick={onRun} disabled={state.status === "loading" || !isReady}>
          {state.status === "loading" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          {state.status === "loading" ? "Analizando…" : "Optimizar proceso"}
        </button>
      </div>
      {!isReady && (
        <div style={{ marginBottom: '16px' }}>
          <Banner variant="warning" title="Faltan datos">
            Para optimizar con IA, todas las tareas deben tener asignado un <b>Responsable</b>, un <b>Tiempo de ciclo</b> y una <b>Clasificación de valor</b>. Tienes {incompleteTasks?.length} tarea(s) incompleta(s).
          </Banner>
        </div>
      )}

      {state.status === "error" && (
        <div style={{ marginBottom: '16px' }}>
          <Banner variant="error" title="No se pudo completar el análisis">
            {state.error}
            <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>Este paso llama a la API de Gemini desde el backend.</div>
          </Banner>
        </div>
      )}

      {state.status === "idle" && (
        <div className="pa-empty">Pulsa <b>Optimizar proceso</b> para recibir hallazgos y recomendaciones.</div>
      )}

      {state.status === "done" && d && (
        <div className="pa-opt-body">
          {!!(d.bottlenecks || []).length && (
            <div style={{ background: 'var(--ink)', color: 'white', padding: 16, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: '50%', flexShrink: 0 }}>
                <Lightbulb size={24} style={{ color: '#0E9F9F' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--inv-muted)', marginBottom: 4, fontWeight: 600 }}>Mayor Impacto Identificado</div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
                  El paso <strong>{d.bottlenecks[0].node_name || d.bottlenecks[0].node_bpmn_id}</strong> genera la mayor restricción. {d.bottlenecks[0].impact_description || d.bottlenecks[0].impact}
                </div>
              </div>
            </div>
          )}

          {d.summary && (
            <div className="pa-opt-summary">
              <div><span>Eficiencia (VA)</span><b>{Math.round((d.summary.value_added_ratio || 0) * 100)}%</b></div>
              <div><span>Pasos NVA</span><b>{d.summary.nva_task_count ?? "—"}</b></div>
              <div><span>Confianza</span><b>{Math.round((d.analysis_confidence || 0) * 100)}%</b></div>
            </div>
          )}

          {!!(d.bottlenecks || []).length && (
            <section>
              <h4>Cuellos de botella</h4>
              {d.bottlenecks.map((b, i) => {
                const sv = SEVERITY[b.severity] || SEVERITY.medium;
                return (
                  <div key={i} className="pa-card">
                    <div className="pa-card-top">
                      <strong>{b.node_name || b.node_bpmn_id}</strong>
                      <span className="pa-badge" style={{ background: sv.color }}>{sv.label}</span>
                    </div>
                    <p>{b.impact_description || b.impact}</p>
                    <div className="pa-meta">
                      {b.metric === "wait_time" ? "Espera" : "Ciclo"}: <b>{fmtLong(b.value_sec)}</b>
                      {b.deviation_factor ? <> · <b>{Number(b.deviation_factor).toFixed(1)}×</b> sobre la media</> : null}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!!(d.inefficiencies || []).length && (
            <section>
              <h4>Desperdicios</h4>
              {d.inefficiencies.map((it, i) => (
                <div key={i} className="pa-card">
                  <div className="pa-card-top">
                    <strong>{WASTE[it.waste_type] || it.waste_type}</strong>
                    <span className="pa-badge" style={{ background: VALUE.NVA.color }}>NVA</span>
                  </div>
                  <p>{it.description}</p>
                  {it.root_cause && <div className="pa-meta">Causa raíz: {it.root_cause}</div>}
                </div>
              ))}
            </section>
          )}

          {!!(d.recommendations || []).length && (
            <section>
              <h4>Recomendaciones</h4>
              {[...d.recommendations].sort((a, b) => (a.priority || 9) - (b.priority || 9)).map((r, i) => {
                const ac = ACTION[r.action_type] || { label: r.action_type, color: "#0E9F9F" };
                return (
                  <div key={i} className="pa-card" style={{ opacity: appliedIndices.includes(i) ? 0.6 : 1 }}>
                    <div className="pa-card-top">
                      <span className="pa-chip" style={{ borderColor: ac.color, color: ac.color }}>{ac.label}</span>
                      {r.estimated_time_saving_pct ? <span className="pa-save">↓{Math.round(r.estimated_time_saving_pct)}% tiempo</span> : null}
                    </div>
                    <p>{r.description}</p>
                    <div className="pa-meta">Complejidad: {r.implementation_complexity || "—"}</div>
                    
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="pa-btn pa-btn-primary" 
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        disabled={appliedIndices.includes(i)}
                        onClick={() => {
                          if (onApplyRecommendation) onApplyRecommendation(r, () => setAppliedIndices([...appliedIndices, i]));
                        }}
                      >
                        {appliedIndices.includes(i) ? <><Check size={14} style={{ marginRight: 4 }} /> Aplicada</> : 'Aplicar recomendación'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {d.optimized_flow?.applies && !!(d.optimized_flow.nodes || d.optimized_flow.steps || []).length && (
            <button className="pa-btn pa-btn-ghost full" onClick={() => onApply(d.optimized_flow.nodes || d.optimized_flow.steps)}>
              <ArrowRight size={16} /> Aplicar flujo optimizado al diagrama
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function fmtShort(sec) {
  sec = Number(sec) || 0;
  if (sec === 0) return "0";
  if (sec < 60) return sec + "s";
  if (sec < 3600) return Math.round(sec / 60) + "m";
  return (sec / 3600).toFixed(1).replace(/\.0$/, "") + "h";
}

function fmtLong(sec) {
  sec = Number(sec) || 0;
  if (sec < 60) return sec + " s";
  if (sec < 3600) return (sec / 60).toFixed(sec % 60 ? 1 : 0) + " min";
  return (sec / 3600).toFixed(1) + " h";
}
export { ValueClassWizard, Editor, GatewayEditor, Optimization, fmtShort, fmtLong };
