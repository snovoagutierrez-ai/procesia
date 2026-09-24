/* Contenido de «Fundamentos»: las metodologías en las que se apoya AiProces.
 *
 * Vive en datos planos, aparte del componente, para que corregir un texto no
 * obligue a tocar JSX. Cada concepto cabe en una tarjeta: si necesita más, es
 * que son dos conceptos.
 *
 * `infografia` es la CLAVE del dibujo de Infographics.jsx (se resuelve en
 * FundamentosModal). Los textos deben decir lo que la aplicación CALCULA de
 * verdad (backend/app/metrics.py), no lo que dice el libro en general.
 */

/* Orden de lectura: el orden en que una persona nueva se tropieza con las
 * cosas. Primero cómo se dibuja, después quién hace qué, después cómo se mide
 * y solo al final dónde se pierde valor y cómo se mejora. */
export const CAPITULOS = [
  {
    id: 'dibujar',
    titulo: '1 · Cómo se dibuja un proceso: BPMN 2.0',
    intro:
      'El diagrama no es un dibujo libre: usa la notación BPMN 2.0, el estándar internacional ' +
      'para modelar procesos. Así cualquier persona que conozca la notación lo lee igual, y el ' +
      'flujo se puede exportar a otras herramientas.',
    conceptos: [
      {
        key: 'proceso',
        titulo: 'Inicio, tareas y fin',
        infografia: 'proceso',
        formula: 'Inicio → tareas → Fin',
        fuente: 'BPMN 2.0 · OMG',
        texto:
          'Todo proceso empieza en un evento de Inicio y termina en uno de Fin. Cada tarjeta es ' +
          'una tarea y cada flecha dice qué viene después. Si una tarea queda suelta, sin flecha ' +
          'de entrada o de salida, el sistema no puede calcular por dónde pasa el trabajo.',
      },
      {
        key: 'tipos-tarea',
        titulo: 'Persona, Manual o Sistema',
        formula: 'userTask · manualTask · serviceTask',
        fuente: 'BPMN 2.0 · tipos de tarea',
        texto:
          'La diferencia no es si hay alguien trabajando, sino si media un sistema digital. ' +
          'Persona: alguien trabaja apoyándose en correo, Excel o un ERP. Manual: papel, firma ' +
          'física, revisión visual. Sistema: ocurre solo, sin que nadie lo ejecute. Es el dato ' +
          'que después muestra dónde se puede automatizar.',
      },
      {
        key: 'compuerta',
        titulo: 'Compuertas: decidir o hacer a la vez',
        infografia: 'compuerta',
        formula: 'Exclusiva (X): un camino · Paralela (+): todos',
        fuente: 'BPMN 2.0 · compuertas',
        texto:
          'La compuerta exclusiva es una decisión: cada caso toma UN camino, y por eso cada rama ' +
          'lleva el % de casos que la toman (deben sumar 100). La paralela abre varias ramas que ' +
          'ocurren a la vez. Con los porcentajes, una rama que recorre el 20% de los casos pesa ' +
          'un 20% en los tiempos y en el costo.',
      },
      {
        key: 'macroproceso',
        titulo: 'Macroprocesos y procesos',
        formula: 'Macroproceso ⊃ procesos ⊃ tareas',
        fuente: 'Arquitectura de procesos (BPM)',
        texto:
          'Un macroproceso agrupa los procesos de una gran área del negocio; cada proceso detalla ' +
          'sus tareas. Separar niveles evita diagramas gigantes que nadie lee, y permite comparar ' +
          'procesos entre sí para ver cuál limita el flujo del área completa.',
      },
    ],
  },
  {
    id: 'limites',
    titulo: '2 · Los límites y los responsables: SIPOC y RACI',
    intro:
      'Antes de medir hay que saber dónde empieza y termina el proceso, para quién trabaja y ' +
      'quién hace cada cosa. Sin eso no se puede decidir qué pasos agregan valor ni a quién se ' +
      'le carga el costo.',
    conceptos: [
      {
        key: 'sipoc',
        titulo: 'SIPOC: de dónde viene y a dónde va',
        infografia: 'sipoc',
        formula: 'Proveedores → Entradas → Proceso → Salidas → Clientes',
        fuente: 'Six Sigma · fase Definir',
        texto:
          'SIPOC fija los límites del proceso: quién entrega lo que se necesita para empezar y ' +
          'quién recibe el resultado. Identificar al Cliente es lo que después permite decidir ' +
          'qué pasos le agregan valor y cuáles no.',
      },
      {
        key: 'raci',
        titulo: 'RACI: quién hace qué',
        formula: 'R ejecuta · A aprueba · C consultado · I informado',
        fuente: 'Matriz de responsabilidades',
        texto:
          'Cada tarea tiene un Responsable (R) que la ejecuta y un Aprobador (A) que responde por ' +
          'ella; C y I se consultan o se informan. El costo y los traspasos se calculan sobre el ' +
          'R, no sobre el A: el jefe que aprueba suele ser el mismo en todo el proceso, y cobrar ' +
          'a su tarifa un trabajo que hace otra persona inflaría el costo.',
      },
      {
        key: 'traspasos',
        titulo: 'Traspasos y saltos de sistema',
        formula: 'traspaso = cambia quien ejecuta · salto = cambia el sistema',
        fuente: 'Lean · handoffs',
        texto:
          'Cada vez que el trabajo pasa de una persona a otra hay un traspaso; cada vez que cambia ' +
          'de sistema, un salto. En esos puntos se pierde información, se generan esperas y ' +
          'aparecen errores de transcripción. Menos traspasos casi siempre significa un proceso ' +
          'más rápido.',
      },
    ],
  },
  {
    id: 'medir',
    titulo: '3 · Cómo se mide el tiempo: flujo de valor',
    intro:
      'Lo que el cliente percibe no es cuánto trabaja cada persona, sino cuánto tarda el caso ' +
      'de principio a fin. La diferencia entre las dos cifras es casi siempre tiempo de espera.',
    conceptos: [
      {
        key: 'ciclo-espera',
        titulo: 'Tiempo de ciclo y tiempo de espera',
        formula: 'lead time = Σ ciclo + Σ espera',
        fuente: 'Lean · Value Stream Mapping',
        texto:
          'El tiempo de ciclo es lo que tarda una tarea mientras alguien trabaja en ella. El de ' +
          'espera, lo que el caso pasa detenido antes de que empiece. El lead time es el total de ' +
          'principio a fin. La escalera de valor (VSM) muestra las dos cosas paso a paso: en ' +
          'procesos administrativos la espera suele ser la mayor parte.',
      },
      {
        key: 'camino-critico',
        titulo: 'Tareas en paralelo: la rama más larga',
        infografia: 'caminoCritico',
        formula: 'lead time = duración del camino crítico',
        fuente: 'Método del camino crítico (CPM)',
        texto:
          'Si dos tareas ocurren a la vez, el tiempo total no es la suma: es la rama más larga. ' +
          'Cuando el flujo está conectado, AiProces calcula el lead time por el camino crítico. ' +
          'Sumar las ramas paralelas inflaría el tiempo y haría parecer el proceso peor de lo que es.',
      },
      {
        key: 'pce',
        titulo: 'Eficiencia de ciclo (PCE)',
        infografia: 'pce',
        formula: 'PCE = tiempo VA ÷ lead time',
        fuente: 'Lean Six Sigma',
        texto:
          'De todo el tiempo que tarda el proceso, qué parte le agrega valor al cliente. Un PCE ' +
          'de 5% significa que 95 de cada 100 minutos el caso está esperando o en pasos que no ' +
          'aportan. En procesos administrativos es habitual que quede por debajo del 10%: no es ' +
          'un error de la medición, es la oportunidad.',
      },
    ],
  },
  {
    id: 'valor',
    titulo: '4 · Dónde se pierde valor: Lean',
    intro:
      'Clasificar cada paso es la parte más importante del levantamiento: de esa clasificación ' +
      'salen el PCE, el costo del desperdicio y las propuestas de mejora.',
    conceptos: [
      {
        key: 'va-nnva-nva',
        titulo: 'Valor, necesario o desperdicio',
        infografia: 'valor',
        formula: 'VA · NNVA · NVA',
        fuente: 'Lean · análisis de valor',
        texto:
          'VA: el cliente nota el resultado; transforma, decide o resuelve algo de lo que recibe. ' +
          'NNVA: el cliente no lo pediría, pero la organización lo necesita (controles legales, ' +
          'calidad, trazabilidad); no es desperdicio. NVA: nadie lo echaría de menos; existe por ' +
          'un error anterior, una espera o por costumbre. Es lo primero que conviene atacar.',
      },
      {
        key: 'downtime',
        titulo: 'Los 8 desperdicios',
        infografia: 'downtime',
        formula: 'Defectos · Sobreproducción · Esperas · Talento · Transporte · Inventario · Movimiento · Sobreproceso',
        fuente: 'Lean · Toyota Production System',
        texto:
          'Cuando un paso es desperdicio, se indica de qué tipo. Las iniciales en inglés forman ' +
          'DOWNTIME. AiProces suma el tiempo y el costo de cada tipo, así se ve cuál pesa más en ' +
          'el proceso en lugar de quedarse como una etiqueta.',
      },
      {
        key: 'retrabajo',
        titulo: 'Tasa de retrabajo',
        formula: 'retrabajo = % de casos que vuelven atrás',
        fuente: 'Six Sigma',
        texto:
          'Se calcula con las probabilidades de las ramas que devuelven el caso a un paso ' +
          'anterior. Si no hay un ciclo de vuelta modelado, el dato queda como desconocido, no ' +
          'como cero: un proceso sin retrabajo dibujado no es lo mismo que un proceso sin retrabajo.',
      },
      {
        key: 'costo',
        titulo: 'Costo por ejecución',
        formula: 'costo = Σ (ciclo × tarifa del R × frecuencia de la rama)',
        fuente: 'Costeo basado en actividades (ABC)',
        texto:
          'Cada tarea cuesta su tiempo de ciclo por la tarifa de quien la ejecuta. Con el volumen ' +
          'mensual del proceso se proyecta al mes y al año. La parte que corresponde a pasos NVA ' +
          'es el costo del desperdicio: lo que se paga por trabajo que nadie necesita.',
      },
    ],
  },
  {
    id: 'restriccion',
    titulo: '5 · Qué limita la capacidad: Teoría de Restricciones',
    intro:
      'Mejorar cualquier paso no mejora el proceso. Solo mejora si se trabaja sobre el paso que ' +
      'fija el ritmo del conjunto.',
    conceptos: [
      {
        key: 'toc',
        titulo: 'La restricción del sistema',
        infografia: 'toc',
        formula: 'capacidad (casos/hora) = 3.600 ÷ ciclo del paso más lento (s)',
        fuente: 'Goldratt · Teoría de Restricciones',
        texto:
          'Siempre existe una restricción: el paso con el ciclo más largo fija cuántos casos por ' +
          'hora puede sacar el proceso completo. Acelerar cualquier otro paso no sube la capacidad; ' +
          'solo aumenta la cola que se acumula delante de la restricción.',
      },
      {
        key: 'desbalanceo',
        titulo: 'Pasos desbalanceados',
        formula: 'alerta si ciclo o espera > 1,5 × el promedio',
        fuente: 'Balanceo de línea',
        texto:
          'Además de la restricción, AiProces marca los pasos cuyo ciclo o espera supera en 1,5 ' +
          'veces el promedio del proceso. No son «la» restricción: son pasos atípicos que merece ' +
          'la pena mirar. Una espera alta suele ser el síntoma, la cola que se forma antes del ' +
          'paso lento, no la causa.',
      },
    ],
  },
  {
    id: 'mejorar',
    titulo: '6 · Cómo se mejora',
    intro:
      'Con el proceso dibujado, clasificado y medido, las mejoras dejan de ser opiniones: cada ' +
      'propuesta dice qué paso toca, qué hacer y cuánto tiempo o costo libera.',
    conceptos: [
      {
        key: 'ecrs',
        titulo: 'Tipos de acción de mejora',
        formula: 'Eliminar · Simplificar · Fusionar · Paralelizar · Reasignar · Estandarizar · Automatizar',
        fuente: 'ECRS (Eliminar, Combinar, Reordenar, Simplificar)',
        texto:
          'El orden importa: primero se elimina lo que sobra, después se simplifica, se juntan ' +
          'pasos o se hacen a la vez, y solo al final se automatiza. Automatizar un paso inútil ' +
          'solo lo hace inútil más rápido. Cada tipo de acción trae sus pasos concretos para ' +
          'aplicarla en el editor.',
      },
      {
        key: 'ia',
        titulo: 'Optimización asistida por IA',
        formula: 'diagrama + métricas → propuestas → revisión humana',
        fuente: 'Lean · Six Sigma · BPMN 2.0',
        texto:
          'La optimización lee el diagrama y las métricas calculadas (restricción, PCE, ' +
          'desperdicios) y propone cambios con estas mismas metodologías. Son propuestas, no ' +
          'decisiones: cada una se revisa antes de aplicarse, y antes de aplicar se guarda una ' +
          'versión del proceso para poder volver atrás.',
      },
    ],
  },
];

export const TRADICIONES =
  'Nada de esto se inventó aquí. La notación del diagrama viene de BPMN 2.0, el estándar del ' +
  'Object Management Group. Los límites y responsables vienen de SIPOC y RACI. El análisis de ' +
  'valor, los 8 desperdicios y la eficiencia de ciclo vienen de Lean, y la medición del ' +
  'retrabajo, de Six Sigma. La idea de que un solo paso limita todo el proceso viene de la ' +
  'Teoría de Restricciones de Goldratt. Lo propio de AiProces es juntarlos en un solo flujo, ' +
  'calcular las métricas a partir del dibujo y explicarlas a quien no estudió ninguna de ellas.';
