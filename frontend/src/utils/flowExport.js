/**
 * Descarga del diagrama en JPG o PDF.
 *
 * Hasta ahora solo se podia exportar en BPMN, que es un XML util para otra
 * herramienta pero ilegible para una persona. Aqui se parte del SVG generado
 * desde los datos (ver flowSvg.js):
 *
 *  - JPG: se rasteriza el SVG en un lienzo y se descarga. Se usa un factor de
 *    escala para que la imagen no salga pixelada al ampliarla.
 *  - PDF: se abre una ventana de impresion con el diagrama a pagina completa y
 *    se deja que el navegador lo guarde como PDF. Sin dependencias nuevas y
 *    respetando el tamano de papel que elija el usuario.
 */
import { diagramaSvg } from "./flowSvg.js";

const ESCALA_JPG = 2; // el doble de resolucion: legible al ampliar o al imprimir

function nombreArchivo(proc, extension) {
  const base = (proc?.code || proc?.name || "proceso")
    .toString().trim().replace(/[^\w\-]+/g, "_").slice(0, 60) || "proceso";
  return `${base}.${extension}`;
}

function descargar(url, nombre) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Descarga el diagrama como JPG.
 * @returns {Promise<{ok: boolean, motivo?: string}>}
 */
export async function descargarJpg(datos) {
  const generado = diagramaSvg(datos);
  if (!generado) return { ok: false, motivo: "Este proceso no tiene pasos que dibujar." };

  const { svg, ancho, alto } = generado;
  // Se pasa por un blob y no por un data URI: los data URI muy largos fallan en
  // algunos navegadores y este SVG crece con el numero de pasos.
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("no se pudo rasterizar el diagrama"));
      i.src = url;
    });

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho * ESCALA_JPG;
    lienzo.height = alto * ESCALA_JPG;
    const ctx = lienzo.getContext("2d");
    // JPG no tiene transparencia: sin fondo blanco explicito saldria negro.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

    descargar(lienzo.toDataURL("image/jpeg", 0.92), nombreArchivo(datos.proc, "jpg"));
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e.message || "no se pudo generar la imagen" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Abre el diagrama en una ventana lista para imprimir o guardar como PDF.
 * @returns {{ok: boolean, motivo?: string}}
 */
export function descargarPdf(datos) {
  const generado = diagramaSvg(datos);
  if (!generado) return { ok: false, motivo: "Este proceso no tiene pasos que dibujar." };

  const { svg, ancho, alto } = generado;
  const ventana = window.open("", "_blank");
  if (!ventana) {
    return { ok: false, motivo: "El navegador bloqueó la ventana. Permite pop-ups para este sitio." };
  }

  const proc = datos.proc || {};
  // Apaisado si el diagrama es mas ancho que alto, que es lo habitual.
  const orientacion = ancho >= alto ? "landscape" : "portrait";

  ventana.document.write(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${(proc.name || "Diagrama de flujo").replace(/</g, "&lt;")}</title>
<style>
  @page { size: A4 ${orientacion}; margin: 12mm; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #15232E; }
  header { margin-bottom: 10px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .codigo { font-size: 11px; color: #5C6B6B; font-family: monospace; }
  .lienzo { width: 100%; }
  .lienzo svg { width: 100%; height: auto; }
  @media print { .aviso { display: none; } }
  .aviso { margin-top: 14px; font-size: 12px; color: #5C6B6B; }
</style></head>
<body>
  <header>
    <h1>${(proc.name || "Diagrama de flujo").replace(/</g, "&lt;")}</h1>
    <div class="codigo">${(proc.code || "").replace(/</g, "&lt;")}</div>
  </header>
  <div class="lienzo">${svg}</div>
  <p class="aviso">Se abrirá el diálogo de impresión: elige «Guardar como PDF» para descargarlo.</p>
</body></html>`);
  ventana.document.close();
  // Se espera a que el SVG este maquetado antes de llamar a imprimir.
  ventana.onload = () => setTimeout(() => ventana.print(), 250);
  return { ok: true };
}

/** Formatos que ofrece el selector de descarga. */
export const FORMATOS = [
  { valor: "jpg", etiqueta: "JPG (imagen)", descripcion: "Para pegar en una presentación o un correo." },
  { valor: "pdf", etiqueta: "PDF (documento)", descripcion: "Para imprimir o compartir en tamaño A4." },
  { valor: "bpmn", etiqueta: "BPMN 2.0 (XML)", descripcion: "Para abrirlo en otra herramienta de procesos." },
];
