import React, { useState, useEffect } from 'react';
import { Sparkles, Play, Trash2, Plus, PenLine, Network, ChevronDown, ChevronRight, Layers, LayoutGrid, Bot, ArrowRight, Loader2 } from 'lucide-react';

function Dashboard({ macroprocesses, processes, onSelect, onCreateProcess, onCreateMacro, onDeleteProcess, onDeleteMacro, macroOpts, runOptimizeMacro, onLoadDemo, openOpts, setOpenOpts, macroLongLoading }) {
  const [dashTab, setDashTab] = useState("jerarquia");
  const [expandedMacros, setExpandedMacros] = useState({});
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredProcesses = processes.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  if (macroprocesses.length === 0 && processes.length === 0) {
    return (
      <div className="pa-dashboard">
        <div className="pa-dash-header">
          <div>
            <h2>Bienvenido a AiProces</h2>
            <p>La herramienta inteligente para levantar, optimizar y exportar tus procesos.</p>
          </div>
        </div>
        
        <div className="pa-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: 800, margin: '40px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ background: '#EBF0EC', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E9F9F' }}>
              <Sparkles size={32} />
            </div>
          </div>
          <h3 style={{ fontSize: 24, marginBottom: 12, color: '#13202B' }}>Comienza a mapear tus flujos</h3>
          <p style={{ color: '#5C6B6B', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
            Sigue el flujo recomendado para optimizar operaciones:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left', marginBottom: 40, background: '#F5F7F5', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>1</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Define el macroproceso</b> y crea tu primer proceso SIPOC.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>2</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Levanta los pasos</b> con sus responsables, sistemas y tiempos.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>3</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Clasifica el valor</b> (VA, NNVA, NVA) de cada paso según principios Lean.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>4</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Optimiza con IA</b> para identificar cuellos de botella y oportunidades.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ background: '#0E9F9F', color: '#fff', width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>5</span>
              <span style={{ fontSize: 14, color: '#3A4B4B' }}><b>Exporta en BPMN 2.0</b> el diagrama optimizado.</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="pa-btn pa-btn-primary" style={{ padding: '12px 24px', fontSize: 15, width: isMobile ? '100%' : 'auto' }} onClick={onCreateMacro}>
              <Plus size={18} style={{ marginRight: 6 }}/> Crear mi primer proceso
            </button>
            {onLoadDemo && (
              <button className="pa-btn pa-btn-ghost" style={{ padding: '12px 24px', fontSize: 15, border: '1px solid var(--teal)', color: 'var(--teal-deep)', width: isMobile ? '100%' : 'auto' }} onClick={onLoadDemo}>
                <FileText size={18} style={{ marginRight: 6 }}/> Ver proceso de ejemplo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pa-dashboard">
      <div className="pa-dash-header">
        <div>
          <h2>Mis procesos</h2>
          <p>Organiza tus procesos en grandes macroprocesos o búscalos en la biblioteca unitaria.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="pa-btn pa-btn-primary" onClick={onCreateMacro}>
            <Plus size={16} /> Nuevo macroproceso
          </button>
        </div>
      </div>
      
      <div className="pa-tabs" style={{ marginBottom: '24px', borderBottom: '1px solid var(--line)' }}>
        <button className={dashTab === "jerarquia" ? "on" : ""} onClick={() => setDashTab("jerarquia")}>
          <FolderOpen size={16} /> Vista Jerárquica
        </button>
        <button className={dashTab === "unitaria" ? "on" : ""} onClick={() => setDashTab("unitaria")}>
          <FileText size={16} /> Biblioteca Unitaria
        </button>
      </div>

      {dashTab === "jerarquia" && (
        <>
          {macroprocesses.length === 0 ? (
            <div className="pa-empty" style={{ textAlign: "center", padding: 40 }}>
              <FolderOpen size={40} style={{ color: "#9AA8A8", marginBottom: 12 }} />
              <div>No hay macroprocesos aún. Pulsa <b>Nuevo macroproceso</b> para comenzar.</div>
            </div>
          ) : (
            <div className="pa-dash-macros">
              {macroprocesses.map((m) => {
                const mProcs = processes.filter(p => p.macroprocess_id === m.id);
                return (
                  <div key={m.id} className="pa-dash-macro-sec">
                    <div className="pa-dash-macro-head" style={{ cursor: 'pointer' }} onClick={() => setExpandedMacros(prev => ({ ...prev, [m.id]: !prev[m.id] }))}>
                      <div className="pa-dash-macro-title">
                        {expandedMacros[m.id] ? <ChevronDown size={20} style={{ color: "#0E9F9F" }} /> : <ChevronRight size={20} style={{ color: "#0E9F9F" }} />}
                        <FolderOpen size={20} style={{ color: "#0E9F9F", marginLeft: 4 }} />
                        <h3>{m.name}</h3>
                        <span className="pa-dash-code">{m.code}</span>
                      </div>
                      <div className="pa-dash-macro-actions" onClick={(e) => e.stopPropagation()}>
                        {mProcs.length > 0 && (
                          <button className="pa-btn pa-btn-primary" onClick={() => runOptimizeMacro(m.id)} disabled={macroOpts[m.id]?.status === "loading"}>
                            {macroOpts[m.id]?.status === "loading" ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} 
                            {macroOpts[m.id]?.status === "loading" ? (macroLongLoading?.[m.id] ? "Analizando macroproceso..." : "Optimizando...") : "Optimizar End-to-End"}
                          </button>
                        )}
                        <button className="pa-btn pa-btn-ghost" style={{ color: '#0E9F9F', border: '1px solid #E2E7E3' }} onClick={() => onCreateProcess(m.id)}>
                          <Plus size={14} /> Añadir proceso
                        </button>
                        <button className="pa-icon danger" style={{position:"static", width:34, height:34}} onClick={() => onDeleteMacro(m.id)} title="Eliminar macroproceso">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expandedMacros[m.id] && (
                      <>
                        {macroOpts[m.id]?.status === "error" && (
                          <div className="pa-alert" style={{margin: '16px 20px 0'}}>
                            <AlertTriangle size={18} style={{color:"var(--danger)"}}/>
                            <p>{macroOpts[m.id].error}</p>
                          </div>
                        )}
                        {macroOpts[m.id]?.status === "done" && macroOpts[m.id]?.data && (
                          <div className="pa-macro-opt-results" style={{ margin: '16px 20px 0', background: 'white', borderRadius: 8, border: '1px solid var(--teal)' }}>
                            <div 
                              style={{ padding: '12px 16px', background: 'var(--teal)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderRadius: openOpts[m.id] ? '8px 8px 0 0' : '8px' }}
                              onClick={() => setOpenOpts(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                            >
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <Sparkles size={16} />
                                <strong style={{ fontSize: 14 }}>Insights de IA a Nivel Macroproceso</strong>
                              </div>
                              {openOpts[m.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                            
                            {openOpts[m.id] && (
                              <div style={{ padding: 20 }}>
                                {/* Insight Principal */}
                                {macroOpts[m.id].data.macro_bottlenecks?.length > 0 && (
                                  <div style={{ background: 'var(--ink)', color: 'white', padding: 16, borderRadius: 8, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: 8, borderRadius: '50%' }}>
                                      <AlertTriangle size={24} style={{ color: 'var(--bg-nva)' }} />
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--inv-muted)', marginBottom: 4, fontWeight: 600 }}>Insight Principal</div>
                                      <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
                                        El cuello de botella más crítico está en el proceso <strong>{macroOpts[m.id].data.macro_bottlenecks[0].process_name}</strong>. Abordarlo reduciría significativamente el Lead Time total.
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                                  <div className="pa-stat">
                                    <span className="pa-stat-label">Lead Time Total (Estimado)</span>
                                    <span className="pa-stat-value">{macroOpts[m.id].data.summary.total_macro_lead_time_sec} s</span>
                                  </div>
                                  <div className="pa-stat">
                                    <span className="pa-stat-label">Eficiencia (PCE) Macro</span>
                                <span className="pa-stat-value">{Math.round(macroOpts[m.id].data.summary.macro_pce_percentage)}%</span>
                              </div>
                              <div className="pa-stat">
                                <span className="pa-stat-label">Proyección Optimizada</span>
                                <span className="pa-stat-value" style={{color: 'var(--teal)'}}>{macroOpts[m.id].data.projected_macro_lead_time_sec} s</span>
                              </div>
                            </div>
                            
                            {macroOpts[m.id].data.macro_bottlenecks?.length > 0 && (
                              <div style={{marginBottom: 20}}>
                                <h4 style={{marginBottom: 8}}>Cuellos de Botella (TOC)</h4>
                                {macroOpts[m.id].data.macro_bottlenecks.map((b, i) => (
                                  <div key={i} className="pa-alert" style={{background: b.severity === 'critical' ? 'var(--bg-nva)' : 'var(--bg-nnva)'}}>
                                    <AlertTriangle size={16} style={{color: b.severity === 'critical' ? 'var(--danger)' : 'var(--nnva)'}}/>
                                    <div>
                                      <strong>{b.process_code} - {b.process_name}</strong>
                                      <p>{b.impact_description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
    
                            {macroOpts[m.id].data.interface_wastes?.length > 0 && (
                              <div style={{marginBottom: 20}}>
                                <h4 style={{marginBottom: 8}}>Desperdicios de Interfaz</h4>
                                <ul style={{paddingLeft: 20}}>
                                  {macroOpts[m.id].data.interface_wastes.map((w, i) => (
                                    <li key={i} style={{marginBottom: 4}}><strong>{w.from_process_code} &rarr; {w.to_process_code}:</strong> {w.description} (Retraso: {w.estimated_delay_sec}s)</li>
                                  ))}
                                </ul>
                              </div>
                            )}
    
                            {macroOpts[m.id].data.recommendations?.length > 0 && (
                              <div>
                                <h4 style={{marginBottom: 8}}>Recomendaciones Estratégicas</h4>
                                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                                  {macroOpts[m.id].data.recommendations.map((r, i) => (
                                    <div key={i} style={{padding: 12, background: '#F8F9FA', borderRadius: 4, border: '1px solid var(--line)'}}>
                                      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:4}}>
                                        <span className="pa-tag" style={{background:'var(--teal)', color:'white'}}>{r.action_type}</span>
                                        <strong>{r.target_process_codes.join(', ')}</strong>
                                      </div>
                                      <p style={{margin:0, fontSize:13}}>{r.description}</p>
                                      <p style={{margin:'4px 0 0', fontSize:12, color:'var(--muted)'}}>Beneficio: {r.expected_benefit}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {mProcs.length === 0 ? (
                      <div className="pa-empty" style={{ padding: 20 }}>
                        <p>No hay procesos en este macroproceso.</p>
                        <button className="pa-btn pa-btn-ghost" style={{ marginTop: 12 }} onClick={() => onCreateProcess(m.id)}>
                          <Plus size={16} style={{marginRight: 6}} /> Crear primer proceso
                        </button>
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '400px', marginTop: '16px' }}>
                        <MacroprocessDiagram macroprocessId={m.id} processes={mProcs} onProcessDoubleClick={onSelect} />
                      </div>
                    )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {dashTab === "unitaria" && (
        <div className="pa-dash-unitary">
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              className="pa-input" 
              placeholder="Buscar por código o nombre..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: '400px' }}
            />
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{filteredProcesses.length} procesos encontrados</span>
          </div>
          
          <div style={{ overflowX: 'auto', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F9FAFA', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Código</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre del Proceso</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Macroproceso</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Evento de Inicio</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Resultado Final</th>
                  <th style={{ padding: '12px 16px', width: '80px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcesses.map(p => {
                  const macro = macroprocesses.find(m => m.id === p.macroprocess_id);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--line)', background: '#fff', cursor: 'pointer' }} onClick={() => onSelect(p)}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}><span className="pa-tag" style={{ margin: 0, fontSize: 11 }}>{p.code}</span></td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--teal-deep)' }}>{p.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{macro ? macro.name : '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.trigger_event || p.trigger || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.output_result || p.output || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="pa-btn pa-btn-ghost" style={{ padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); onSelect(p); }}>Abrir</button>
                          <button className="pa-icon danger small" onClick={(e) => { e.stopPropagation(); onDeleteProcess(p.id); }} title="Eliminar proceso"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {processes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      La biblioteca está vacía. Crea procesos desde la Vista Jerárquica para poblarla.
                    </td>
                  </tr>
                ) : filteredProcesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      No se encontraron procesos que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
