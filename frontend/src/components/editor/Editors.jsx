import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Copy, Trash2, Check, ChevronRight, Sparkles, Loader2, ArrowRight, AlertTriangle, TrendingUp } from 'lucide-react';

function ValueClassWizard({ valueClass, wasteType, onChange, expertMode, setExpertMode }

function Editor({ task, onChange, onMove, onDelete, isFirst, isLast, saveState = { status: 'idle' }, expertMode, setExpertMode, onDone }

function GatewayEditor({ gateway, onChange, onDelete, saveState = { status: 'idle' }, onDone }

function Optimization({ state, onRun, onApply, tasks }

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
