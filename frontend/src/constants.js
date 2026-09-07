// Shared domain constants — imported by AiProces.jsx, Editors.jsx, FlowDiagrams.jsx

// Las tres clases siguen siendo las de Lean, pero la redaccion anterior
// encasillaba: "Valor agregado" se leia como "solo lo que el cliente pagaria
// aparte", y "Necesario sin valor" hacia parecer inutil un paso imprescindible.
// En la metodologia, NNVA es el "valor para el negocio" (business value added):
// no lo paga el cliente, pero sostiene el proceso. Se ajustan las etiquetas y se
// anade una explicacion, sin tocar los valores que guarda la base (VA/NNVA/NVA).
export const VALUE = {
  VA:   {
    label: "Valor para el cliente", short: "VA", color: "#1FA463", bg: "#E8F5E9",
    help: "El resultado le llega al cliente y él lo nota: transforma, decide o resuelve algo de lo que recibe. No hace falta que pague un extra por ello, basta con que su ausencia empeore lo que recibe.",
  },
  NNVA: {
    label: "Necesario para la organización", short: "NNVA", color: "#C98A12", bg: "#FFF8E1",
    help: "El cliente no lo pediría, pero la organización lo necesita: controles, requisitos legales, revisiones de calidad, coordinación o trazabilidad. Aporta valor al negocio aunque no al cliente final; no es desperdicio.",
  },
  NVA:  {
    label: "Desperdicio", short: "NVA", color: "#D9503C", bg: "#FFEBEE",
    help: "Ni el cliente ni la organización lo echarían de menos: existe por un error anterior, por una espera o por costumbre. Es lo que conviene atacar primero.",
  },
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

// "Persona" y "Manual" parecian lo mismo. La diferencia real es si media un
// sistema digital, no si hay alguien trabajando.
export const TYPES = {
  user:    {
    label: "Persona", Icon: null, bpmn: "userTask",
    help: "Alguien hace el trabajo apoyándose en un sistema digital: correo, Excel, Word, SANP, SIGE, un ERP...",
  },
  manual:  {
    label: "Manual", Icon: null, bpmn: "manualTask",
    help: "Se hace a mano, sin que intervenga ningún sistema digital: papel, firma física, revisión visual, traslado.",
  },
  service: {
    label: "Sistema", Icon: null, bpmn: "serviceTask",
    help: "Ocurre solo, sin que nadie lo ejecute: un correo automático, una consulta programada, una carga en Power BI.",
  },
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

// Obs 07/09: "Ver el paso y cómo aplicarlo" llevaba a la tarea pero repetia la
// misma descripcion que ya estaba en la lista, asi que no guiaba nada. Estos son
// los pasos concretos de cada tipo de accion, escritos contra los campos reales
// del editor. No dependen de lo que conteste el modelo.
export const ACTION_STEPS = {
  ELIMINATE: [
    "Comprueba que ningún otro paso dependa de este.",
    "En el diagrama, conecta el paso anterior con el siguiente para no cortar el flujo.",
    "Bórralo con la papelera de la lista de la izquierda.",
  ],
  AUTOMATE: [
    "En «Sistemas / Herramientas» anota con qué se automatizaría.",
    "Cambia «Tipo» a Sistema.",
    "Ajusta el tiempo de ciclo al que esperas una vez automatizado.",
  ],
  SIMPLIFY: [
    "Quita del paso lo que el cliente no note: revisiones repetidas, campos que nadie lee.",
    "Baja el tiempo de ciclo al que quedaría ya simplificado.",
    "Revisa la clasificación de valor: al simplificar puede dejar de ser desperdicio.",
  ],
  MERGE: [
    "Edita esta tarea incorporando lo que hace la otra.",
    "Suma los tiempos de ciclo de ambas en esta.",
    "Elimina la otra tarea y reconecta el flujo por el hueco que deja.",
  ],
  PARALLELIZE: [
    "Añade una compuerta y ponle tipo Paralela (+).",
    "Conecta la compuerta con los pasos que pueden ocurrir a la vez.",
    "Vuelve a unir las ramas: el tiempo total pasa a ser el de la rama más larga.",
  ],
  REASSIGN: [
    "En RACI, cambia el Responsable (R) al rol que corresponda.",
    "Deja un único Aprobador (A): dos aprobadores duplican el trabajo.",
    "Si el cambio evita un traspaso entre áreas, baja el tiempo de espera.",
  ],
  STANDARDIZE: [
    "Sigue la instrucción de conexión de arriba: arrastra desde el punto relleno del borde derecho hasta el punto hueco del paso destino.",
    "Si es una compuerta, etiqueta cada rama (Sí/No) y su porcentaje.",
    "Comprueba que el aviso de problemas de conexión desaparece.",
  ],
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
