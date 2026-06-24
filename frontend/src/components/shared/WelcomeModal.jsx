import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Map, Settings, Sparkles, Network } from 'lucide-react';
import Logo from './Logo';

export default function WelcomeModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  // Reset step when opened
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const slides = [
    {
      icon: <Logo size={48} />,
      title: "Bienvenido a AiProces",
      description: "La plataforma definitiva para levantar, conectar y optimizar los procesos de tu empresa a la velocidad del rayo.",
    },
    {
      icon: <Map size={48} color="#0E9F9F" strokeWidth={1.5} />,
      title: "1. Estructura tu Empresa",
      description: "Organiza todo creando Macroprocesos (las grandes áreas de tu negocio) y dentro de ellos, detalla tus Procesos específicos.",
    },
    {
      icon: <Network size={48} color="#0E9F9F" strokeWidth={1.5} />,
      title: "2. Mapeo Ultrarrápido",
      description: "Añade tareas en el panel lateral de forma secuencial. Usa el selector al lado de cada tarea para conectarlas entre sí y mira cómo el diagrama se dibuja solo.",
    },
    {
      icon: <Sparkles size={48} color="#0E9F9F" strokeWidth={1.5} />,
      title: "3. Magia con Inteligencia Artificial",
      description: "Cuando termines de mapear, presiona el botón 'Ir a Optimización IA'. Nuestro motor analizará tu flujo en busca de cuellos de botella y generará un informe al instante.",
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

  return (
    <div className="pa-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="pa-modal" style={{ maxWidth: '500px', padding: '0', overflow: 'hidden' }}>
        <button className="pa-modal-close" onClick={onClose} style={{ zIndex: 10 }}>
          <X size={18} />
        </button>

        <div className="pa-tutorial-slide" style={{ padding: '48px 32px 24px', textAlign: 'center', minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="pa-tutorial-icon" style={{ marginBottom: '24px', animation: 'fadeInUp 0.5s ease-out' }}>
            {slides[step].icon}
          </div>
          <h2 style={{ fontSize: '22px', color: 'var(--inv)', marginBottom: '12px', animation: 'fadeInUp 0.6s ease-out' }}>{slides[step].title}</h2>
          <p style={{ fontSize: '15px', color: 'var(--inv-muted)', lineHeight: '1.6', margin: 0, animation: 'fadeInUp 0.7s ease-out' }}>{slides[step].description}</p>
        </div>

        <div className="pa-tutorial-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ink)' }}>
          <div className="pa-tutorial-dots" style={{ display: 'flex', gap: '8px' }}>
            {slides.map((_, i) => (
              <span key={i} style={{ width: i === step ? '20px' : '8px', height: '8px', borderRadius: '4px', background: i === step ? '#0E9F9F' : 'var(--line-ink)', transition: 'all 0.3s ease' }} />
            ))}
          </div>
          <div className="pa-tutorial-actions" style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="pa-btn pa-btn-ghost" 
              onClick={handlePrev}
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              <ChevronLeft size={16} /> Atrás
            </button>
            <button className="pa-btn pa-btn-primary" onClick={handleNext}>
              {step === slides.length - 1 ? '¡Comenzar!' : 'Siguiente'} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
