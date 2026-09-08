/**
 * Optimizacion con IA, en ventana propia dentro de la misma pagina.
 *
 * Antes vivia en una pestana del panel de detalle, de unos 300px de ancho: el
 * contenido quedaba apretado y se veia cortado. Aqui dispone de todo el ancho.
 *
 * Se abre como ventana emergente y NO como pestana aparte del navegador porque
 * la optimizacion no es una pantalla independiente: al pulsar una recomendacion
 * la app selecciona el nodo en el diagrama y ancla el consejo en el panel de
 * detalle, y al aplicar un flujo optimizado se reemplazan las tareas y se
 * redibuja el diagrama. Todo eso es estado de esta pagina. Una pestana aparte
 * tendria que duplicar la aplicacion y sincronizarse con esta, y ademas se
 * quedaria desactualizada en cuanto se editara el proceso aqui.
 */
import React, { useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Optimization } from './Editors.jsx';

export default function OptimizationModal({ isOpen, onClose, ...props }) {
  useEffect(() => {
    if (!isOpen) return;
    const alPulsarTecla = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="optim-title"
        className="pa-modal-content pa-optim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h2 id="optim-title">
            <Lightbulb size={18} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Optimización con IA
          </h2>
          <button className="pa-btn-icon" onClick={onClose} aria-label="Cerrar optimización con IA"><X size={18} /></button>
        </div>
        <div className="pa-optim-cuerpo">
          <Optimization {...props} />
        </div>
      </div>
    </div>
  );
}
