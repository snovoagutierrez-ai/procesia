// Shared domain constants — imported by AiProces.jsx, Editors.jsx, FlowDiagrams.jsx

export const VALUE = {
  VA:   { label: "Valor agregado",     short: "VA",   color: "#1FA463", bg: "#E8F5E9" },
  NNVA: { label: "Necesario sin valor", short: "NNVA", color: "#C98A12", bg: "#FFF8E1" },
  NVA:  { label: "Desperdicio",         short: "NVA",  color: "#D9503C", bg: "#FFEBEE" },
};

export const WASTE = {
  defects: "Defectos / reproceso",
  overproduction: "Sobreproducción",
  waiting: "Espera",
  non_utilized_talent: "Talento desaprovechado",
  transportation: "Transporte",
  inventory: "Inventario",
  motion: "Movimiento",
  excess_processing: "Sobreprocesamiento",
};

export const TYPES = {
  user:    { label: "Persona",  Icon: null, bpmn: "userTask" },
  manual:  { label: "Manual",   Icon: null, bpmn: "manualTask" },
  service: { label: "Sistema",  Icon: null, bpmn: "serviceTask" },
};

export const ACTION = {
  ELIMINATE:   { label: "Eliminar",     color: "#D9503C" },
  AUTOMATE:    { label: "Automatizar",  color: "#0E9F9F" },
  SIMPLIFY:    { label: "Simplificar",  color: "#0E9F9F" },
  MERGE:       { label: "Fusionar",     color: "#0E9F9F" },
  PARALLELIZE: { label: "Paralelizar",  color: "#7A5AF8" },
  REASSIGN:    { label: "Reasignar",    color: "#C98A12" },
  STANDARDIZE: { label: "Estandarizar", color: "#3B7DD8" },
};

export const SEVERITY = {
  low:      { label: "Baja",     color: "#5C6B6B" },
  medium:   { label: "Media",    color: "#C98A12" },
  high:     { label: "Alta",     color: "#D9503C" },
  critical: { label: "Crítica",  color: "#A4271A" },
};

export const WASTE_QUESTIONS = [
  { value: "waiting",             label: "Espera",                   question: "¿La tarea principal es solo esperar a que algo o alguien esté listo?" },
  { value: "defects",             label: "Defectos",                 question: "¿Este paso existe para corregir un error o repetir algo que salió mal antes?" },
  { value: "overproduction",      label: "Sobreproducción",          question: "¿Se está haciendo o generando más de lo que realmente se necesita?" },
  { value: "non_utilized_talent", label: "Talento desaprovechado",   question: "¿Una persona capacitada está haciendo algo muy por debajo de su capacidad?" },
  { value: "transportation",      label: "Transporte",               question: "¿El paso es mover físicamente algo de un lugar a otro sin transformarlo?" },
  { value: "inventory",           label: "Inventario",               question: "¿Es mantener o almacenar algo (físico o digital) en espera de ser usado?" },
  { value: "motion",              label: "Movimiento",               question: "¿La persona se mueve, busca o navega más de lo necesario para hacer el trabajo real?" },
  { value: "excess_processing",   label: "Sobreproceso",             question: "¿Se hace más trabajo, revisión o detalle del que el cliente realmente necesita?" },
];
