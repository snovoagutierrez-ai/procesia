import React, { useState } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

const VARIANTS = {
  info: {
    color: '#0E9F9F',
    Icon: Info,
    bgTint: 'rgba(14, 159, 159, 0.05)',
    iconBg: 'rgba(14, 159, 159, 0.12)'
  },
  warning: {
    color: '#C98A12',
    Icon: AlertTriangle,
    bgTint: 'rgba(201, 138, 18, 0.05)',
    iconBg: 'rgba(201, 138, 18, 0.12)'
  },
  error: {
    color: '#D9503C', // NVA Color
    Icon: XCircle,
    bgTint: 'rgba(217, 80, 60, 0.05)',
    iconBg: 'rgba(217, 80, 60, 0.12)'
  },
  success: {
    color: '#27AE60',
    Icon: CheckCircle,
    bgTint: 'rgba(39, 174, 96, 0.05)',
    iconBg: 'rgba(39, 174, 96, 0.12)'
  }
};

export default function Banner({ variant = 'info', title, children, dismissible = false, onClose, style = {} }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const cfg = VARIANTS[variant] || VARIANTS.info;
  const Icon = cfg.Icon;

  const handleDismiss = () => {
    setVisible(false);
    if (onClose) onClose();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '16px',
      background: '#fff',
      border: '1px solid #E2E7E3',
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      position: 'relative',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      animation: 'pa-fade-in 0.3s ease',
      ...style
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: cfg.iconBg,
        color: cfg.color,
        flexShrink: 0
      }}>
        <Icon size={18} />
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#13202B', marginBottom: '4px' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: '12.5px', color: '#5C6B6B', lineHeight: 1.5 }}>
          {children}
        </div>
      </div>

      {dismissible && (
        <button 
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: '#8C9B9B',
            flexShrink: 0,
            marginTop: '-4px',
            marginRight: '-4px'
          }}
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
