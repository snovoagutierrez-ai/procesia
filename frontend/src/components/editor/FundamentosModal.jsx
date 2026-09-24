/**
 * Fundamentos: el «por qué» del método, antes que el «cómo».
 *
 * Quien no sabe qué es el PCE o por qué se clasifica cada paso en VA/NNVA/NVA
 * aprende a llenar campos sin entender qué significan, y así el levantamiento
 * se llena de datos que nadie discute porque «lo calcula el sistema». Esta
 * ventana explica, en una tarjeta por concepto, las metodologías que usa
 * AiProces. Sigue el mismo criterio que Fundamentos en PMO Controller.
 *
 * Reemplaza al botón «Nomenclaturas»: el glosario del proceso sigue aquí, en
 * su propia pestaña, porque también sirve para leer el mapa.
 */
import React, { useEffect, useState } from 'react';
import { X, GraduationCap, BookOpen, BookMarked } from 'lucide-react';
import {
  InfoProceso, InfoCompuerta, InfoSipoc, InfoValor,
  InfoPce, InfoToc, InfoCaminoCritico, InfoDowntime,
} from '../shared/Infographics.jsx';
import { CAPITULOS, TRADICIONES } from '../shared/fundamentosDatos.js';
import GlosarioPanel from './GlosarioPanel.jsx';

const INFOGRAFIAS = {
  proceso: InfoProceso,
  compuerta: InfoCompuerta,
  sipoc: InfoSipoc,
  valor: InfoValor,
  pce: InfoPce,
  toc: InfoToc,
  caminoCritico: InfoCaminoCritico,
  downtime: InfoDowntime,
};

function Concepto({ c }) {
  const Dibujo = INFOGRAFIAS[c.infografia];
  return (
    <div className="pa-fund-card" data-concepto={c.key}>
      <h4>{c.titulo}</h4>
      {Dibujo && <div className="pa-fund-dibujo"><Dibujo /></div>}
      {c.formula && <span className="pa-fund-formula">{c.formula}</span>}
      <p>{c.texto}</p>
      <span className="pa-fund-fuente">{c.fuente}</span>
    </div>
  );
}

export default function FundamentosModal({ isOpen, onClose, processId, onCambioGlosario }) {
  const [pestana, setPestana] = useState('metodo');

  useEffect(() => {
    if (!isOpen) return;
    const alPulsar = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="fundamentos-title"
        className="pa-modal-content pa-fund-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h2 id="fundamentos-title">
            <GraduationCap size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Fundamentos
          </h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar fundamentos"><X size={18} /></button>
        </div>

        <div className="pa-tabs" role="tablist">
          <button role="tab" aria-selected={pestana === 'metodo'} className={pestana === 'metodo' ? 'on' : ''}
            onClick={() => setPestana('metodo')}>
            <BookOpen size={15} /> Metodologías
          </button>
          <button role="tab" aria-selected={pestana === 'glosario'} className={pestana === 'glosario' ? 'on' : ''}
            onClick={() => setPestana('glosario')}>
            <BookMarked size={15} /> Nomenclaturas del proceso
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {pestana === 'glosario' ? (
            <GlosarioPanel processId={processId} onCambio={onCambioGlosario} />
          ) : (
            <>
              <p className="pa-fund-intro">
                Por qué AiProces te pide lo que te pide. Seis capítulos, en el orden en que hacen
                falta; cada concepto ocupa una tarjeta con su fórmula y la metodología de la que viene.
              </p>

              {CAPITULOS.map((cap) => (
                <section key={cap.id} className="pa-fund-capitulo">
                  <h3>{cap.titulo}</h3>
                  <p className="pa-fund-intro">{cap.intro}</p>
                  <div className="pa-fund-grid">
                    {cap.conceptos.map((c) => <Concepto key={c.key} c={c} />)}
                  </div>
                </section>
              ))}

              <div className="pa-fund-tradiciones">
                <h3>Las tradiciones que integra el método</h3>
                <p>{TRADICIONES}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
