import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Loader2, Mail, Lock, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCover, setShowCover] = useState(true);
  const [coverLeaving, setCoverLeaving] = useState(false);

  const enterApp = () => {
    setCoverLeaving(true);
    setTimeout(() => setShowCover(false), 420);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (isRegister && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        const ok = await login(email, password);
        if (!ok) setError("Correo o contraseña inválidos");
      }
    } catch (err) {
      setError(err.message || "Error de red. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pa-bg" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', fontFamily: 'system-ui, sans-serif'
    }}>
      <style>{`
        body { margin: 0; background-color: #13202B; }
        .pa-input {
          box-sizing: border-box;
          border: 1px solid #3B4B58;
          border-radius: 9px;
          background: #15232E;
          color: #EAF1EF;
          outline: none;
          transition: 0.15s;
        }
        .pa-input:focus {
          border-color: #0E9F9F;
          box-shadow: 0 0 0 3px rgba(14,159,159,0.12);
        }
        .pa-input::placeholder {
          color: #9AA8A8;
        }
        .pa-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 9px;
          padding: 9px 14px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: 0.15s;
          background: #0E9F9F;
          color: #fff;
        }
        .pa-btn:hover:not(:disabled) {
          background: #0B7A7A;
        }
        .pa-btn:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes paFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes paFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .pa-cover { animation: paFadeUp 0.7s ease both; }
        .pa-cover-leaving { animation: paFadeOut 0.45s ease forwards; }
        .pa-login-card { animation: paFadeUp 0.55s ease both; }
        .pa-cover-line { animation: paFadeUp 0.7s ease both; }
        .pa-cover-cta:hover { background: #0B7A7A !important; transform: translateY(-1px); }
      `}</style>
      {showCover ? (
        <div className={"pa-cover" + (coverLeaving ? " pa-cover-leaving" : "")} style={{ textAlign: 'center', maxWidth: '480px', padding: '1rem' }}>
          <img src="/aiproces-logo.svg" alt="AiProces" style={{ height: '88px', objectFit: 'contain', marginBottom: '1.5rem' }} />
          <h1 style={{ fontSize: '2.6rem', fontWeight: 800, color: '#EAF1EF', margin: 0, letterSpacing: '-0.02em' }}>AiProces</h1>
          <div style={{ color: '#0E9F9F', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '0.6rem' }}>
            Levanta · Optimiza · Exporta
          </div>
          <p className="pa-cover-line" style={{ color: '#C7D3D3', fontSize: '1.12rem', lineHeight: 1.6, marginTop: '1.8rem', animationDelay: '0.15s' }}>
            Transforma la manera en que tu empresa entiende y mejora sus procesos.
          </p>
          <p className="pa-cover-line" style={{ color: '#9AA8A8', fontSize: '0.98rem', lineHeight: 1.6, marginTop: '0.6rem', animationDelay: '0.3s' }}>
            Del levantamiento al diagrama BPMN, con optimización impulsada por IA.
          </p>
          <button
            onClick={enterApp}
            className="pa-cover-cta"
            style={{
              marginTop: '2.4rem', background: '#0E9F9F', color: '#fff', border: 'none',
              borderRadius: '10px', padding: '13px 38px', fontSize: '1rem', fontWeight: 700,
              cursor: 'pointer', transition: '0.18s', boxShadow: '0 8px 24px rgba(14,159,159,0.28)',
              animation: 'paFadeUp 0.7s ease both', animationDelay: '0.45s'
            }}
          >
            Comenzar
          </button>
        </div>
      ) : (
      <div className="pa-login-card" style={{
        backgroundColor: '#1C2E3B', padding: '2.5rem', borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', border: '1px solid #3B4B58',
        width: '100%', maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <img src="/aiproces-logo.svg" alt="AiProces Logo" style={{ height: '40px', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#EAF1EF', margin: 0 }}>
            {isRegister ? "Crear una cuenta" : "Inicia sesión"}
          </h1>
          <p style={{ color: '#9AA8A8', marginTop: '0.5rem' }}>
            {isRegister ? "Regístrate para comenzar a optimizar tus procesos" : "Ingresa para continuar en AiProces"}
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#3b2222', color: '#ff6b6b', padding: '0.75rem',
            borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.875rem', border: '1px solid #ff6b6b'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#EAF1EF', marginBottom: '0.5rem' }}>
              Correo electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9AA8A8' }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pa-input"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                placeholder="tu@empresa.com"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#EAF1EF', marginBottom: '0.5rem' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9AA8A8' }}>
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pa-input"
                style={{ paddingLeft: '2.5rem', width: '100%' }}
                placeholder="••••••••"
              />
            </div>
            {isRegister && <p style={{ color: '#9AA8A8', fontSize: '11px', marginTop: '4px' }}>Debe tener al menos 8 caracteres e incluir letras y números.</p>}
          </div>

          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#EAF1EF', marginBottom: '0.5rem' }}>
                Confirmar Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9AA8A8' }}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pa-input"
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pa-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            {isRegister ? "Registrarse" : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); setPassword(''); setConfirmPassword(''); }}
            style={{
              background: 'none', border: 'none', color: '#0E9F9F', fontSize: '0.875rem',
              cursor: 'pointer', textDecoration: 'underline'
            }}
          >
            {isRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
