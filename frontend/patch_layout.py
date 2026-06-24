import re

file_path = r"C:\Users\HP\Desktop\procesia\frontend\AiProces.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Inject state
state_injection = """  const [expertMode, setExpertMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileStep, setMobileStep] = useState(1);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);"""
content = content.replace("  const [expertMode, setExpertMode] = useState(false);", state_injection)

# 2. Update onNodeSelect
on_node_select_target = """  const onNodeSelect = useCallback((taskId) => {
    setSelectedId(taskId);
    setTab("detalle");
  }, []);"""
on_node_select_replace = """  const onNodeSelect = useCallback((taskId) => {
    setSelectedId(taskId);
    setTab("detalle");
    setMobileStep(3);
  }, []);"""
content = content.replace(on_node_select_target, on_node_select_replace)

# 3. Add mobile step change on task click
task_button_target = """<button key={t.id} className={"pa-step" + (t.id === selectedId ? " sel" : "")} onClick={() => { setSelectedId(t.id); setTab("detalle"); }}>"""
task_button_replace = """<button key={t.id} className={"pa-step" + (t.id === selectedId ? " sel" : "")} onClick={() => { setSelectedId(t.id); setTab("detalle"); setMobileStep(3); }}>"""
content = content.replace(task_button_target, task_button_replace)

# 4. Restructure Layout
# Target 1: <div className="pa-shell"> -> <div className="pa-editor-layout">
content = content.replace("""      ) : proc ? (
        <div className="pa-shell">
          <div className="pa-topbar">""", """      ) : proc ? (
        <div className="pa-editor-layout">
          <div className="pa-topbar" style={{ maxWidth: '1320px', margin: '0 auto', width: '100%' }}>""")

# Target 2: <div style={{ display: 'flex'... -> navigation + <div className="pa-shell">
nav_target = """            </div>

          <div style={{ display: 'flex', gap: '18px', padding: '18px', maxWidth: '1320px', margin: '0 auto', width: '100%' }}>
            <aside className="pa-side">"""
nav_replace = """            </div>

            {isMobile && (
              <div className="pa-mobile-nav">
                <button className={mobileStep === 1 ? 'on' : ''} onClick={() => setMobileStep(1)}>1. Tareas</button>
                <button className={mobileStep === 2 ? 'on' : ''} onClick={() => setMobileStep(2)}>2. Diagrama</button>
                <button className={mobileStep === 3 ? 'on' : ''} onClick={() => setMobileStep(3)}>3. Detalle</button>
              </div>
            )}

          <div className="pa-shell">
            {(!isMobile || mobileStep === 1) && (
              <aside className="pa-side">"""
content = content.replace(nav_target, nav_replace)

# Target 3: </aside> <main>
main_target = """            </aside>

            <main className="pa-main">
              <div className="pa-diagram-card">"""
main_replace = """            </aside>
            )}

            {(!isMobile || mobileStep === 2 || mobileStep === 3) && (
            <main className="pa-main">
              {(!isMobile || mobileStep === 2) && (
              <div className="pa-diagram-wrapper">
              <div className="pa-diagram-card" style={isMobile ? { minHeight: '60vh' } : {}}>"""
content = content.replace(main_target, main_replace)

# Target 4: </VSMLadder> <div className="pa-panel">
panel_target = """              <VSMLadder metrics={metricsData} />

              <div className="pa-panel" style={{ marginTop: 16 }}>"""
panel_replace = """              <VSMLadder metrics={metricsData} />
              </div>
              )}

              {(!isMobile || mobileStep === 3) && (
              <div className="pa-panel" style={{ marginTop: 16 }}>"""
content = content.replace(panel_target, panel_replace)

# Target 5: close the new tags at the end
end_target = """                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      )"""
end_replace = """                  )}
                </div>
              </div>
              )}
            </main>
            )}
          </div>
        </div>
      )"""
content = content.replace(end_target, end_replace)

# 5. Add CSS for mobile nav and flow container
css_target = """/* ---- shell ---- */
.pa-shell{display:grid;grid-template-columns:296px 1fr;gap:18px;padding:18px;max-width:1320px;margin:0 auto}"""
css_replace = """/* ---- mobile nav ---- */
.pa-mobile-nav{display:flex;background:var(--card);border-bottom:1px solid var(--line);padding:0 12px;overflow-x:auto}
.pa-mobile-nav button{flex:1;background:transparent;border:none;padding:12px;font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap;border-bottom:2px solid transparent}
.pa-mobile-nav button.on{color:var(--teal);border-bottom-color:var(--teal)}

/* ---- shell ---- */
.pa-shell{display:grid;grid-template-columns:296px 1fr;gap:18px;padding:18px;max-width:1320px;margin:0 auto;align-items:start}"""
content = content.replace(css_target, css_replace)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("AiProces.jsx updated successfully!")
