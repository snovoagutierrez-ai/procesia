/**
 * Obs 08/09: "al mirar una tarea se pueda saber si esta se está realizando en
 * una base de datos, página web, hoja de cálculo, carpeta, etc."
 *
 * El dato ya existe: el campo «Sistemas / Herramientas» de cada tarea. Aquí se
 * deduce de ese texto en qué clase de herramienta ocurre el trabajo, para poder
 * pintar un icono. Se hace por reconocimiento de nombres porque el campo es
 * libre: nadie tiene que rellenar nada nuevo.
 *
 * Devuelve la clave de la familia, no el icono: quien pinte decide con qué
 * dibujarlo (así esto se puede probar sin montar React).
 */

// El orden importa: gana la primera familia que reconozca algo. Las más
// específicas van antes que las genéricas.
const FAMILIAS = [
  { clave: "hoja",     etiqueta: "Hoja de cálculo", patrones: [/\bexcel\b/, /spreadsheet/, /hoja de c[aá]lculo/, /google sheets?/, /\bsheets?\b/, /\bcsv\b/, /\bxls/] },
  { clave: "base",     etiqueta: "Base de datos",   patrones: [/base de datos/, /\bbbdd\b/, /\bbd\b/, /\bsql\b/, /oracle/, /postgres/, /mysql/, /\bdb2?\b/, /\bquery\b/, /power ?bi/, /\berp\b/, /\bsap\b/, /\bcrm\b/] },
  { clave: "web",      etiqueta: "Página web",      patrones: [/\bweb\b/, /portal/, /navegador/, /\bhttps?:/, /\.com\b/, /\bintranet\b/, /p[aá]gina/] },
  { clave: "correo",   etiqueta: "Correo",          patrones: [/correo/, /\bmail\b/, /outlook/, /gmail/, /\bemail\b/] },
  { clave: "carpeta",  etiqueta: "Carpeta o archivo", patrones: [/carpeta/, /\bdrive\b/, /sharepoint/, /onedrive/, /\bftp\b/, /servidor de archivos/, /repositorio/] },
  { clave: "documento", etiqueta: "Documento",      patrones: [/\bword\b/, /\bpdf\b/, /documento/, /formulario/, /\bdocs?\b/] },
  { clave: "papel",    etiqueta: "En papel",        patrones: [/papel/, /\bfísic[ao]\b/, /\bfisic[ao]\b/, /impres/, /a mano/, /manuscrito/, /firma f[ií]sica/] },
];

/**
 * @param {string} sistemas texto libre del campo «Sistemas / Herramientas»
 * @param {string} [tipoTarea] 'user' | 'manual' | 'service', como respaldo
 * @returns {{clave: string, etiqueta: string}|null}
 */
export function familiaDeSistema(sistemas, tipoTarea) {
  const texto = String(sistemas || "").toLowerCase().trim();

  if (texto) {
    for (const familia of FAMILIAS) {
      if (familia.patrones.some((re) => re.test(texto))) {
        return { clave: familia.clave, etiqueta: familia.etiqueta };
      }
    }
    // Hay herramienta, pero no se reconoce cuál: mejor decir "un sistema" que
    // no decir nada, porque el usuario sí anotó algo.
    return { clave: "sistema", etiqueta: "Sistema" };
  }

  // Sin herramienta anotada, el tipo de tarea aún dice algo.
  if (tipoTarea === "manual") return { clave: "papel", etiqueta: "En papel" };
  if (tipoTarea === "service") return { clave: "sistema", etiqueta: "Automático" };
  return null;
}

/** Todas las familias reconocidas, para documentación y pruebas. */
export const FAMILIAS_CONOCIDAS = FAMILIAS.map((f) => f.clave);
