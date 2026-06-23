import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AiProces.jsx'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import Login from './Login.jsx'
import { AlertTriangle, Loader2 } from 'lucide-react'

const AuthWrapper = () => {
  const { user, loading, connectionError, checkAuth } = useAuth();
  
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#13202B' }}>
        <Loader2 className="spin" size={32} color="#0E9F9F" />
      </div>
    );
  }
  
  if (connectionError) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#13202B', color: '#EAF1EF', fontFamily: 'sans-serif', gap: 16 }}>
        <AlertTriangle size={48} color="#D9503C" />
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 style={{ margin: '0 0 8px 0' }}>Sin conexión al servidor</h2>
          <p style={{ margin: 0, color: '#9AA8A8' }}>No se pudo establecer conexión con el backend. Es posible que el servidor esté inactivo o reiniciándose.</p>
        </div>
        <button 
          onClick={() => checkAuth()} 
          style={{ background: '#0E9F9F', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return user ? <App /> : <Login />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  </React.StrictMode>,
)
