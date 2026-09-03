import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Map, Sparkles, MessageSquare, Loader2 } from 'lucide-react';
import Logo from './Logo';
import { apiFetch } from '../../api.js';
import {
  InfoProceso, InfoCompuerta, InfoSipoc, InfoValor,
  InfoPce, InfoToc, InfoCaminoCritico, InfoDowntime, InfoConectar,
} from './Infographics.jsx';

export default function WelcomeModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const [chatQuery, setChatQuery] = useState("");
  const [chatResponse, setChatResponse] = useState(null);
  const [isChatting, setIsChatting] = useState(false);

  // Reset step when opened
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setChatQuery("");
      setChatResponse(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const slides = [
    {
      icon: <Logo size={64} />,
      title: "Bienvenido a AiProces",
      description: "Vas a dibujar cómo funciona tu empresa por dentro y descubrir dónde se pierde tiempo y dinero. No necesitas saber nada de procesos: te explicamos cada concepto con un dibujo.",
    },
    {
      icon: <Map size={64} color="#0E9F9F" strokeWidth={1.5} />,
      title: "1. Estructura tu Empresa",
      description: "Organiza todo creando Macroprocesos (las grandes áreas de tu negocio) y dentro de ellos, detalla tus Procesos específicos.",
    },
    {
      art: <InfoProceso />,
      title: "2. ¿Qué es un proceso?",
      description: "Una serie de pasos entre un Inicio y un Fin. Cada tarjeta es una tarea y las flechas indican el orden en que ocurren.",
    },
    {
      art: <InfoConectar />,
      title: "3. Conectar los pasos",
      description: "Arrastra desde el punto del borde de una tarjeta hasta el punto de la siguiente. Así defines por dónde fluye el trabajo.",
    },
    {
      art: <InfoValor />,
      title: "4. Clasifica el valor de cada paso",
      description: "Es la clave del análisis: marca si el paso agrega valor (VA), es un control obligatorio (NNVA) o es desperdicio (NVA).",
    },
    {
      art: <InfoCompuerta />,
      title: "5. Decisiones: los caminos Sí / No",
      description: "Cuando el proceso se bifurca, añade una Compuerta (el rombo). Etiqueta cada rama y di qué porcentaje de los casos toma cada camino.",
    },
    {
      art: <InfoSipoc />,
      title: "6. SIPOC: los límites del proceso",
      description: "Define quién provee las entradas y quién recibe el resultado. Saber quién es tu Cliente es lo que permite decidir qué pasos realmente agregan valor.",
    },
    {
      art: <InfoPce />,
      title: "7. Tu eficiencia: el PCE",
      description: "AiProces calcula solo qué porcentaje del tiempo total agrega valor. El resto son esperas y trabajo que no aporta.",
    },
    {
      art: <InfoCaminoCritico />,
      title: "8. Tareas en paralelo",
      description: "Si dos tareas ocurren a la vez, el tiempo total NO es la suma: es la rama más larga. AiProces lo calcula por ti con el camino crítico.",
    },
    {
      art: <InfoToc />,
      title: "9. La restricción del sistema",
      description: "El paso más lento fija el ritmo de todo el proceso. Acelerar cualquier otro paso no aumenta la capacidad: hay que mejorar la restricción.",
    },
    {
      art: <InfoDowntime />,
      title: "10. Los 8 desperdicios",
      description: "Cuando marcas un paso como desperdicio, eliges de qué tipo es. AiProces suma cuánto tiempo pierde cada uno para que ataques el más costoso.",
    },
    {
      icon: <Sparkles size={64} color="#0E9F9F" strokeWidth={1.5} />,
      title: "11. Optimización con IA",
      description: "Pulsa 'Ir a Optimización IA' y el motor analizará tu flujo: te dirá dónde está mal conectado, cuál es tu restricción y qué mejorar primero.",
    },
    {
      icon: <MessageSquare size={64} color="#0E9F9F" strokeWidth={1.5} />,
      title: "¿Tienes dudas?",
      description: "El asistente conoce tu proceso: puede señalarte qué le falta conectar y explicarte tus métricas. Está siempre en la burbuja de abajo a la derecha.",
      isChat: true
    }
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const askAI = async () => {
    if (!chatQuery.trim()) return;
    setIsChatting(true);
    setChatResponse(null);
    try {
      const res = await apiFetch(`/tutorial-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatQuery })
      });
      if (res.ok) {
        const data = await res.json();
        setChatResponse(data.reply);
      } else {
        setChatResponse("Ocurrió un error de conexión con nuestro asistente.");
      }
    } catch (e) {
      setChatResponse("No pudimos conectar con la IA en este momento.");
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: '#13202B', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Top Header */}
        <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="pa-btn pa-btn-ghost" onClick={onClose} aria-label="Cerrar tutorial" style={{ color: 'var(--inv-muted)', fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Omitir <X size={16} style={{ marginLeft: 8 }} />
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center', animation: 'fadeInUp 0.5s ease-out' }}>
            <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'center' }}>
              {slides[step].art
                ? (
                  // Infografía: lienzo claro para que el SVG (pensado sobre papel)
                  // se lea bien contra el fondo oscuro del tutorial.
                  <div style={{
                    width: '100%', maxWidth: 560, background: '#FFFFFF',
                    borderRadius: 14, padding: '14px 16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,.28)',
                  }}>
                    {slides[step].art}
                  </div>
                )
                : slides[step].icon}
            </div>
            <h2 id="welcome-modal-title" style={{ fontSize: '32px', color: 'var(--inv)', marginBottom: '16px', fontWeight: 700 }}>{slides[step].title}</h2>
            <p style={{ fontSize: '18px', color: 'var(--inv-muted)', lineHeight: '1.6', margin: 0, maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
              {slides[step].description}
            </p>

            {slides[step].isChat && (
              <div style={{ marginTop: '32px', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '12px', border: '1px solid var(--line-ink)' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    className="pa-input ink" 
                    placeholder="Ej. ¿Qué es un cuello de botella?" 
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') askAI(); }}
                    style={{ flex: 1, fontSize: '16px', padding: '12px' }}
                  />
                  <button className="pa-btn pa-btn-primary" onClick={askAI} disabled={isChatting} style={{ padding: '0 24px' }}>
                    {isChatting ? <Loader2 size={18} className="spin" /> : 'Preguntar'}
                  </button>
                </div>
                {chatResponse && (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'var(--ink)', borderRadius: '8px', borderLeft: '3px solid var(--teal)', color: 'var(--inv)', fontSize: '15px', lineHeight: '1.5' }}>
                    {chatResponse}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {slides.map((_, i) => (
              <span key={i} style={{ width: i === step ? '32px' : '8px', height: '8px', borderRadius: '4px', background: i === step ? '#0E9F9F' : 'var(--line-ink)', transition: 'all 0.3s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              className="pa-btn pa-btn-ghost" 
              onClick={handlePrev}
              style={{ visibility: step === 0 ? 'hidden' : 'visible', padding: '12px 24px', fontSize: '16px' }}
            >
              <ChevronLeft size={20} /> Atrás
            </button>
            <button className="pa-btn pa-btn-primary" onClick={handleNext} style={{ padding: '12px 32px', fontSize: '16px', fontWeight: 600 }}>
              {step === slides.length - 1 ? '¡Comenzar!' : 'Siguiente'} <ChevronRight size={20} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
