import React from 'react';

/* Infografías explicativas de AiProces.
 *
 * Son SVG inline (sin dependencias, sin imágenes externas) que muestran el
 * MECANISMO de cada concepto, no un icono decorativo: un usuario sin formación
 * en procesos debería entender la idea mirando el dibujo antes de leer el texto.
 *
 * Convenciones: viewBox 360x150 salvo indicación, colores de la paleta de la app,
 * y todo el texto dentro del SVG para que escale con el contenedor.
 */

const C = {
  teal: '#0E9F9F',
  tealDeep: '#0B7E7E',
  tealSoft: '#D7F0F0',
  ink: '#15232E',
  muted: '#5C6B6B',
  line: '#CBD8D8',
  va: '#1FA463',
  nnva: '#E0A012',
  nva: '#D9503C',
  paper: '#FFFFFF',
};

const Svg = ({ children, vb = '0 0 360 150', title }) => (
  <svg viewBox={vb} role="img" aria-label={title} style={{ width: '100%', height: 'auto', display: 'block' }}>
    <title>{title}</title>
    {children}
  </svg>
);

/* Flecha reutilizable */
const Arrow = ({ x1, y1, x2, y2, color = C.line, dashed = false }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2 - 7} y2={y2} stroke={color} strokeWidth="2"
          strokeDasharray={dashed ? '4 3' : undefined} />
    <polygon points={`${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}`} fill={color} />
  </g>
);

const Box = ({ x, y, w = 74, h = 34, label, sub, fill = C.paper, stroke = C.line, accent }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={stroke} strokeWidth="1.5" />
    {accent && <rect x={x} y={y} width="4" height={h} rx="2" fill={accent} />}
    <text x={x + w / 2} y={sub ? y + h / 2 - 2 : y + h / 2 + 4} textAnchor="middle"
          fontSize="10.5" fontWeight="600" fill={C.ink}>{label}</text>
    {sub && <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" fontSize="8.5" fill={C.muted}>{sub}</text>}
  </g>
);

/* 1 — Qué es un proceso: Inicio → pasos → Fin */
export const InfoProceso = () => (
  <Svg title="Un proceso es una serie de pasos entre un inicio y un fin">
    <circle cx="26" cy="75" r="13" fill={C.paper} stroke={C.teal} strokeWidth="3" />
    <text x="26" y="103" textAnchor="middle" fontSize="9" fill={C.muted}>Inicio</text>
    <Arrow x1="41" y1="75" x2="66" y2="75" />
    <Box x={66} y={58} label="Recibir" sub="solicitud" accent={C.va} />
    <Arrow x1="142" y1="75" x2="166" y2="75" />
    <Box x={166} y={58} label="Revisar" sub="documentos" accent={C.nnva} />
    <Arrow x1="242" y1="75" x2="266" y2="75" />
    <circle cx="292" cy="75" r="13" fill={C.paper} stroke={C.ink} strokeWidth="3" />
    <circle cx="292" cy="75" r="6" fill={C.ink} />
    <text x="292" y="103" textAnchor="middle" fontSize="9" fill={C.muted}>Fin</text>
    <text x="180" y="25" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      Todo proceso va de un Inicio a un Fin
    </text>
    <text x="180" y="40" textAnchor="middle" fontSize="9.5" fill={C.muted}>
      Las flechas indican el orden de los pasos
    </text>
  </Svg>
);

/* 2 — Compuerta de decisión Sí/No con retrabajo */
export const InfoCompuerta = () => (
  <Svg title="Una compuerta divide el camino según una decisión">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      El rombo es una decisión: el camino se divide
    </text>
    <Box x={14} y={62} w={68} label="Revisar" sub="solicitud" accent={C.nnva} />
    <Arrow x1="82" y1="79" x2="104" y2="79" />
    {/* rombo */}
    <polygon points="132,55 160,79 132,103 104,79" fill={C.paper} stroke={C.teal} strokeWidth="2.5" />
    <text x="132" y="83" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.teal}>X</text>
    <text x="132" y="120" textAnchor="middle" fontSize="8.5" fill={C.muted}>¿Aprobado?</text>
    {/* rama Sí */}
    <Arrow x1="160" y1="72" x2="212" y2="48" color={C.va} />
    <rect x="168" y="32" width="34" height="14" rx="7" fill={C.paper} stroke={C.va} />
    <text x="185" y="42" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.va}>Sí 80%</text>
    <Box x={212} y={32} w={64} h={30} label="Entregar" fill={C.paper} accent={C.va} />
    {/* rama No (retrabajo) */}
    <Arrow x1="160" y1="88" x2="212" y2="112" color={C.nva} />
    <rect x="168" y="112" width="34" height="14" rx="7" fill={C.paper} stroke={C.nva} />
    <text x="185" y="122" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.nva}>No 20%</text>
    <Box x={212} y={98} w={64} h={30} label="Corregir" fill={C.paper} accent={C.nva} />
    <text x="300" y="80" fontSize="8.5" fill={C.muted}>El %</text>
    <text x="300" y="91" fontSize="8.5" fill={C.muted}>indica</text>
    <text x="300" y="102" fontSize="8.5" fill={C.muted}>cuántos</text>
    <text x="300" y="113" fontSize="8.5" fill={C.muted}>casos van</text>
    <text x="300" y="124" fontSize="8.5" fill={C.muted}>por ahí</text>
  </Svg>
);

/* 3 — SIPOC */
export const InfoSipoc = () => (
  <Svg title="SIPOC: proveedores, entradas, proceso, salidas y clientes">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      SIPOC: de dónde viene y a dónde va tu proceso
    </text>
    {[
      { x: 6, l: 'S', t: 'Proveedores', s: 'quién provee' },
      { x: 76, l: 'I', t: 'Entradas', s: 'qué llega' },
    ].map((d) => (
      <g key={d.l}>
        <rect x={d.x} y={50} width="62" height="46" rx="8" fill={C.paper} stroke={C.line} strokeWidth="1.5" />
        <text x={d.x + 31} y={66} textAnchor="middle" fontSize="14" fontWeight="800" fill={C.teal}>{d.l}</text>
        <text x={d.x + 31} y={79} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={C.ink}>{d.t}</text>
        <text x={d.x + 31} y={89} textAnchor="middle" fontSize="7.5" fill={C.muted}>{d.s}</text>
      </g>
    ))}
    {/* P destacado */}
    <rect x={146} y={44} width="68" height="58" rx="9" fill={C.tealSoft} stroke={C.teal} strokeWidth="2" />
    <text x={180} y={64} textAnchor="middle" fontSize="15" fontWeight="800" fill={C.tealDeep}>P</text>
    <text x={180} y={78} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.tealDeep}>Proceso</text>
    <text x={180} y={90} textAnchor="middle" fontSize="7.5" fill={C.tealDeep}>lo que mapeas</text>
    {[
      { x: 222, l: 'O', t: 'Salidas', s: 'qué entrega' },
      { x: 292, l: 'C', t: 'Clientes', s: 'quién recibe' },
    ].map((d) => (
      <g key={d.l}>
        <rect x={d.x} y={50} width="62" height="46" rx="8" fill={C.paper} stroke={C.line} strokeWidth="1.5" />
        <text x={d.x + 31} y={66} textAnchor="middle" fontSize="14" fontWeight="800" fill={C.teal}>{d.l}</text>
        <text x={d.x + 31} y={79} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={C.ink}>{d.t}</text>
        <text x={d.x + 31} y={89} textAnchor="middle" fontSize="7.5" fill={C.muted}>{d.s}</text>
      </g>
    ))}
    <Arrow x1="68" y1="73" x2="76" y2="73" />
    <Arrow x1="138" y1="73" x2="146" y2="73" />
    <Arrow x1="214" y1="73" x2="222" y2="73" />
    <Arrow x1="284" y1="73" x2="292" y2="73" />
    <text x="180" y="122" textAnchor="middle" fontSize="9" fill={C.muted}>
      Saber quién es el Cliente define qué pasos realmente agregan valor
    </text>
  </Svg>
);

/* 4 — Clasificación de valor VA / NNVA / NVA */
export const InfoValor = () => (
  <Svg title="Clasificación de valor: VA, NNVA y NVA">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      Cada paso se clasifica según cuánto aporta
    </text>
    {[
      { x: 8, c: C.va, l: 'VA', t: 'Valor agregado', s: 'El cliente lo valora', e: 'Fabricar, atender' },
      { x: 124, c: C.nnva, l: 'NNVA', t: 'Necesario', s: 'Obligatorio pero', e: 'Control legal' },
      { x: 240, c: C.nva, l: 'NVA', t: 'Desperdicio', s: 'No aporta nada', e: 'Esperas, retrabajo' },
    ].map((d) => (
      <g key={d.l}>
        <rect x={d.x} y={34} width="112" height="82" rx="9" fill={C.paper} stroke={d.c} strokeWidth="1.8" />
        <rect x={d.x} y={34} width="112" height="20" rx="9" fill={d.c} />
        <rect x={d.x} y={46} width="112" height="8" fill={d.c} />
        <text x={d.x + 56} y={48} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#fff">{d.l}</text>
        <text x={d.x + 56} y={70} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.ink}>{d.t}</text>
        <text x={d.x + 56} y={84} textAnchor="middle" fontSize="8" fill={C.muted}>{d.s}</text>
        <text x={d.x + 56} y={101} textAnchor="middle" fontSize="8" fontStyle="italic" fill={d.c}>{d.e}</text>
      </g>
    ))}
    <text x="180" y="134" textAnchor="middle" fontSize="8.5" fill={C.muted}>
      Reducir los pasos rojos (NVA) es la forma más rápida de mejorar
    </text>
  </Svg>
);

/* 5 — PCE: qué mide realmente */
export const InfoPce = () => (
  <Svg title="PCE: proporción del tiempo total que agrega valor">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      Eficiencia de Ciclo (PCE)
    </text>
    <text x="180" y="34" textAnchor="middle" fontSize="9.5" fill={C.muted}>
      De todo el tiempo que tarda el proceso, ¿cuánto agrega valor?
    </text>
    {/* barra */}
    <rect x="20" y="48" width="320" height="26" rx="6" fill="#EEF1EE" />
    <rect x="20" y="48" width="58" height="26" rx="6" fill={C.va} />
    <rect x="72" y="48" width="46" height="26" fill={C.nnva} />
    <rect x="118" y="48" width="222" height="26" fill="#E3E9E9" />
    <rect x="334" y="48" width="6" height="26" rx="3" fill="#E3E9E9" />
    <text x="49" y="65" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">VA</text>
    <text x="95" y="65" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">NNVA</text>
    <text x="229" y="65" textAnchor="middle" fontSize="9" fontWeight="600" fill={C.muted}>Esperas y trabajo sin valor</text>
    <line x1="20" y1="82" x2="340" y2="82" stroke={C.line} strokeWidth="1" />
    <text x="180" y="96" textAnchor="middle" fontSize="8.5" fill={C.muted}>Lead time = tiempo total de principio a fin</text>
    {/* fórmula */}
    <text x="180" y="120" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={C.ink}>
      PCE = tiempo VA ÷ lead time
    </text>
    <text x="180" y="136" textAnchor="middle" fontSize="8.5" fill={C.muted}>
      Un proceso sin esperas puede igual tener PCE bajo si sus pasos no agregan valor
    </text>
  </Svg>
);

/* 6 — Restricción del sistema (TOC) */
export const InfoToc = () => (
  <Svg title="La restricción es el paso más lento y fija el ritmo de todo el proceso">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      La restricción manda: el paso más lento fija el ritmo
    </text>
    {/* tuberías de distinto ancho */}
    <rect x="24" y="52" width="76" height="34" rx="6" fill={C.paper} stroke={C.line} strokeWidth="1.5" />
    <text x="62" y="70" textAnchor="middle" fontSize="9.5" fontWeight="600" fill={C.ink}>Recibir</text>
    <text x="62" y="81" textAnchor="middle" fontSize="8" fill={C.muted}>60/hora</text>

    <rect x="140" y="46" width="80" height="46" rx="6" fill="#FDECEA" stroke={C.nva} strokeWidth="2.5" />
    <text x="180" y="66" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.nva}>Aprobar</text>
    <text x="180" y="78" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.nva}>4/hora</text>
    <text x="180" y="106" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.nva}>RESTRICCIÓN</text>

    <rect x="260" y="52" width="76" height="34" rx="6" fill={C.paper} stroke={C.line} strokeWidth="1.5" />
    <text x="298" y="70" textAnchor="middle" fontSize="9.5" fontWeight="600" fill={C.ink}>Entregar</text>
    <text x="298" y="81" textAnchor="middle" fontSize="8" fill={C.muted}>90/hora</text>

    <Arrow x1="100" y1="69" x2="140" y2="69" />
    <Arrow x1="220" y1="69" x2="260" y2="69" />
    {/* cola acumulada antes de la restricción */}
    <g fill={C.nnva} opacity="0.85">
      <circle cx="112" cy="40" r="4" /><circle cx="124" cy="40" r="4" /><circle cx="136" cy="40" r="4" />
    </g>
    <text x="124" y="30" textAnchor="middle" fontSize="7.5" fill={C.muted}>la cola se acumula aquí</text>

    {/* Una sola línea uniforme: mezclar tramos de texto con distinto estilo en
        SVG es frágil (se encima según el renderizador). El énfasis ya lo da el
        recuadro rojo de la restricción. */}
    <text x="180" y="128" textAnchor="middle" fontSize="9" fontWeight="600" fill={C.ink}>
      Todo el proceso rinde 4/hora, por rápidos que sean los demás pasos
    </text>
    <text x="180" y="142" textAnchor="middle" fontSize="8.5" fill={C.muted}>
      Mejorar “Recibir” o “Entregar” no sube la capacidad: hay que mejorar la restricción
    </text>
  </Svg>
);

/* 7 — Camino crítico vs suma (paralelas) */
export const InfoCaminoCritico = () => (
  <Svg title="Con tareas en paralelo el tiempo total es la rama más larga, no la suma">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      Tareas en paralelo: cuenta la rama más larga
    </text>
    <circle cx="24" cy="76" r="10" fill={C.paper} stroke={C.teal} strokeWidth="2.5" />
    <polygon points="70,60 88,76 70,92 52,76" fill={C.paper} stroke={C.teal} strokeWidth="2" />
    <text x="70" y="80" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.teal}>+</text>
    <Arrow x1="34" y1="76" x2="52" y2="76" />
    {/* rama corta */}
    <Arrow x1="88" y1="68" x2="126" y2="46" />
    <Box x={126} y={30} w={80} h={30} label="Verificar" sub="2 h" />
    {/* rama larga */}
    <Arrow x1="88" y1="84" x2="126" y2="108" color={C.nva} />
    <Box x={126} y={92} w={80} h={30} label="Cotizar" sub="5 h" accent={C.nva} />
    <Arrow x1="206" y1="46" x2="240" y2="70" />
    <Arrow x1="206" y1="108" x2="240" y2="84" color={C.nva} />
    <circle cx="252" cy="76" r="10" fill={C.paper} stroke={C.ink} strokeWidth="2.5" />
    <circle cx="252" cy="76" r="4.5" fill={C.ink} />
    {/* comparación */}
    <rect x="272" y="52" width="84" height="48" rx="7" fill="#F4FAFA" stroke={C.teal} strokeWidth="1.2" />
    {/* Tachado dibujado como línea: text-decoration no es fiable en todos los
        renderizadores de SVG. */}
    <text x="314" y="67" textAnchor="middle" fontSize="8.5" fill={C.muted}>2 + 5 = 7 h</text>
    <line x1="288" y1="64" x2="340" y2="64" stroke={C.nva} strokeWidth="1.4" />
    <text x="314" y="83" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.tealDeep}>5 h</text>
    <text x="314" y="94" textAnchor="middle" fontSize="7.5" fill={C.muted}>tiempo real</text>
    <text x="180" y="140" textAnchor="middle" fontSize="8.5" fill={C.muted}>
      Ocurren a la vez: cuando termina la más larga, ya terminaron ambas
    </text>
  </Svg>
);

/* 8 — Los 8 desperdicios (DOWNTIME) */
export const InfoDowntime = () => {
  const items = [
    ['D', 'Defectos'], ['O', 'Sobreproducción'], ['W', 'Esperas'], ['N', 'Talento'],
    ['T', 'Transporte'], ['I', 'Inventario'], ['M', 'Movimiento'], ['E', 'Sobreproceso'],
  ];
  return (
    <Svg title="Los 8 desperdicios Lean (DOWNTIME)" vb="0 0 360 150">
      <text x="180" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
        Los 8 desperdicios — DOWNTIME
      </text>
      <text x="180" y="30" textAnchor="middle" fontSize="8.5" fill={C.muted}>
        La inicial de cada uno forma la palabra
      </text>
      {items.map(([l, t], i) => {
        const x = 8 + (i % 4) * 88;
        const y = 42 + Math.floor(i / 4) * 52;
        return (
          <g key={l}>
            <rect x={x} y={y} width="80" height="44" rx="7" fill={C.paper} stroke={C.line} strokeWidth="1.3" />
            <circle cx={x + 40} cy={y + 15} r="10" fill={C.tealSoft} />
            <text x={x + 40} y={y + 19} textAnchor="middle" fontSize="11" fontWeight="800" fill={C.tealDeep}>{l}</text>
            <text x={x + 40} y={y + 36} textAnchor="middle" fontSize="8" fill={C.ink}>{t}</text>
          </g>
        );
      })}
    </Svg>
  );
};

/* 9 — Cómo conectar nodos (arrastrar) */
export const InfoConectar = () => (
  <Svg title="Conectar tareas arrastrando desde los puntos del borde">
    <text x="180" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.tealDeep}>
      Conecta arrastrando desde los puntos del borde
    </text>
    <Box x={40} y={58} w={96} h={40} label="Revisar" sub="ciclo 10 min" accent={C.va} />
    <circle cx="40" cy="78" r="5.5" fill="#9AA8A8" stroke="#fff" strokeWidth="2" />
    <circle cx="136" cy="78" r="6.5" fill={C.teal} stroke="#fff" strokeWidth="2" />
    <Box x={224} y={58} w={96} h={40} label="Aprobar" sub="ciclo 5 min" accent={C.nnva} />
    <circle cx="224" cy="78" r="6.5" fill={C.teal} stroke="#fff" strokeWidth="2" />
    <circle cx="320" cy="78" r="5.5" fill="#9AA8A8" stroke="#fff" strokeWidth="2" />
    <path d="M136 78 C 170 78, 190 78, 224 78" stroke={C.teal} strokeWidth="2.5" fill="none" strokeDasharray="5 4" />
    <polygon points="224,78 216,74 216,82" fill={C.teal} />
    {/* cursor */}
    <path d="M172 88 l0 16 l4 -4 l3 6 l3 -1.5 l-3 -6 l6 0 z" fill={C.ink} />
    <text x="180" y="128" textAnchor="middle" fontSize="9" fill={C.muted}>
      Mantén pulsado en un punto y suelta sobre el punto del otro nodo
    </text>
    <text x="180" y="142" textAnchor="middle" fontSize="8.5" fill={C.muted}>
      Para borrar una flecha, usa el botón rojo que aparece sobre ella
    </text>
  </Svg>
);

export default {
  InfoProceso, InfoCompuerta, InfoSipoc, InfoValor,
  InfoPce, InfoToc, InfoCaminoCritico, InfoDowntime, InfoConectar,
};
