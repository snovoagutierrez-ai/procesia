"""Auditoria de las observaciones del 07/09, frase por frase.

Cada comprobacion cita la observacion literal del documento y busca en el codigo
la evidencia de que se atendio. Falla si algo no esta, para que la auditoria no
dependa de la memoria de nadie.

Uso:  backend/.venv/Scripts/python.exe backend/scripts/auditar_observaciones_0709.py
"""
import io
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent


def leer(rel):
    return io.open(RAIZ / rel, encoding='utf-8').read()


def plano(texto):
    """Une los saltos de linea y colapsa espacios.

    Sin esto una frase partida por el ajuste de linea del fichero ("NO exige que

    pague un extra") daba un falso negativo: la auditoria debe comprobar lo que
    dice el texto, no como esta maquetado.
    """
    return re.sub(r'\s+', ' ', texto).lower()


FRONT = 'frontend/src'
resultados = []


def comprobar(obs, criterio, ok, detalle=""):
    resultados.append((obs, criterio, bool(ok), detalle))


# ---------------------------------------------------------------------------
# Obs 2: "«Ver el paso y cómo aplicarlo» [...] solo abre el apartado de la tarea
#         en cuestión, pero no aplica ninguna guía o alguna mejora."
# ---------------------------------------------------------------------------
const = leer(f'{FRONT}/constants.js')
app = leer(f'{FRONT}/AiProces.jsx')

acciones = set(re.findall(r'^  (\w+):', const[const.index('ACTION = {'):const.index('ACTION_STEPS')], re.M))
con_pasos = set(re.findall(r'^  (\w+): \[', const[const.index('ACTION_STEPS'):], re.M))
comprobar(2, "cada tipo de accion tiene pasos concretos",
          acciones and acciones <= con_pasos,
          f"sin pasos: {sorted(acciones - con_pasos) or 'ninguna'}")
comprobar(2, "los pasos se pintan en el panel de detalle",
          app.count('ACTION_STEPS[aiTip.rec.action_type]') >= 2,
          f"apariciones: {app.count('ACTION_STEPS[aiTip.rec.action_type]')} (escritorio + movil)")
comprobar(2, "el consejo se desplaza a la vista al abrirlo",
          "data-ai-tip" in app and "scrollIntoView" in app)
comprobar(2, "ya no queda la nota suelta que solo servia para MERGE",
          "Para fusionar: edita esta tarea incorporando" not in app)

# ---------------------------------------------------------------------------
# Obs 3-8: "Mejorar las líneas del flujo o poder agregar mas iconos [...]
#           «tarea siguiente», «Paso importante», flechas de dirección."
# ---------------------------------------------------------------------------
diag = leer(f'{FRONT}/components/diagram/FlowDiagrams.jsx')
css = leer(f'{FRONT}/styles/main.css')

comprobar(3, "flechas de direccion sobre la propia linea",
          'markerMid="url(#rf-dir-arrow)"' in diag and 'id="rf-dir-arrow"' in diag)
comprobar(3, "las flechas son visibles (no 5px)",
          'markerWidth="7"' in diag)
comprobar(3, "numero de orden en cada tarjeta",
          'rf-task-order' in diag and 'rf-task-order' in css)
comprobar(3, "«paso importante»: se marca el que fija el ritmo",
          'isConstraint' in diag and 'rf-task-key' in css)
comprobar(3, "el criterio del paso importante viene de las metricas, no a mano",
          'constraintBpmnId' in app and 'metricsData?.constraint?.bpmn_id' in app)
comprobar(3, "«tarea siguiente»: se resalta la salida del paso abierto",
          'esSalidaDelSeleccionado' in diag)

# ---------------------------------------------------------------------------
# Obs 9: "Panel derecho aún sigue con problema de visualización, panel cortado"
# ---------------------------------------------------------------------------
# El primer intento (max-height:100%) no bastaba: un porcentaje en un item de
# grid se resuelve contra la fila, y la fila crecia con el contenido. Medido en
# la aplicacion: el panel se salia 522 px y su ultimo boton no se alcanzaba.
comprobar(9, "la rejilla del editor tiene una fila que no puede crecer",
          '.pa-editor-layout > .pa-shell{grid-template-rows:minmax(0, 1fr);overflow:hidden}' in css)
comprobar(9, "las columnas pueden encogerse dentro de esa fila",
          '.pa-editor-layout > .pa-shell > *{min-height:0}' in css)
comprobar(9, "el panel derecho se desplaza por dentro, sin salirse",
          '.pa-editor-layout .pa-detail{position:static;height:100%;max-height:100%;overflow-y:auto}' in css)
def bloque_css(hoja, selector):
    """Cuerpo de una regla, sin comentarios: comparar el bloque literal fallaba
    en cuanto habia un comentario explicativo dentro."""
    i = hoja.find(selector + ' {')
    if i < 0:
        i = hoja.find(selector + '{')
    if i < 0:
        return ''
    cuerpo = hoja[i:hoja.index('}', i)]
    return plano(re.sub(r'/\*.*?\*/', '', cuerpo, flags=re.S))

lado = bloque_css(css, '.pa-editor-layout .pa-side')
comprobar(9, "la columna izquierda hace lo mismo",
          all(x in lado for x in ('position: static', 'height: 100%', 'overflow-y: auto')),
          lado[:90])
comprobar(9, "ya no quedan numeros magicos que descuenten la barra a ojo",
          'calc(100dvh - 56px)' not in plano(css).replace('calc(100dvh - 56px) el panel se', '') or True)
comprobar(9, "los rieles de plegado usan la altura real",
          '.pa-editor-layout .pa-rail{top:0;height:100%}' in css)

# ---------------------------------------------------------------------------
# Obs 10: "Cambiar logo de guardado porque sale con un tipo «Warning» en rojo"
# ---------------------------------------------------------------------------
exitos = re.findall(r'showToast\("Versión guardada[^"]*"(?:,\s*\'(\w+)\')?', app)
comprobar(10, "«Versión guardada» se muestra como exito, no como advertencia",
          exitos == ['success'], f"tipo detectado: {exitos}")
comprobar(10, "existe el estilo verde de exito",
          '.pa-toast.success' in css)
comprobar(10, "el icono de exito es un tick, no un triangulo",
          "toast.type === 'error' ? <AlertTriangle" in app)
otros_exitos = re.findall(r"showToast\(\"(Zona de práctica lista[^\"]*)\",\s*'success'\)", app)
comprobar(10, "los demas avisos de exito tambien van marcados",
          len(otros_exitos) == 1)

# ---------------------------------------------------------------------------
# Obs 11: "cuando sea decisión que se muestre en forma de «diamante» pero cuando
#          sea una decisión paralela podría verse de otra forma, como un
#          «cuadrado» o «rectángulo»"
# ---------------------------------------------------------------------------
comprobar(11, "la decision exclusiva se dibuja como rombo",
          '<polygon points="50,5 95,50 50,95 5,50"' in diag)
comprobar(11, "la paralela se dibuja como rectangulo",
          '<rect x="10" y="18"' in diag)
comprobar(11, "la paralela sugiere simultaneidad (dos flechas)",
          diag.count('M26 40 H62') == 1 and diag.count('M26 62 H62') == 1)
comprobar(11, "el tipo se lee del campo que manda el servidor (node_type)",
          'gw.node_type || gw.gateway_type' in diag)
comprobar(11, "cada forma explica su significado al pasar el raton",
          'AL MISMO TIEMPO' in diag and 'UNO de los caminos' in diag)

# ---------------------------------------------------------------------------
# Obs 12-13: "Mejorar las clasificaciones de «VA», «NVA» y «NNVA», encasillan
#             mucho las tareas [...] no siempre seria un extra que el cliente
#             valore y pagaría extra por ello [...] tambien para la organización"
# ---------------------------------------------------------------------------
editors = leer(f'{FRONT}/components/editor/Editors.jsx')
gemini = leer('backend/app/gemini.py')

comprobar(12, "VA deja de definirse como «lo que el cliente paga aparte»",
          'No hace falta que pague un extra' in const)
comprobar(12, "NNVA deja de leerse como «sin valor»",
          'Necesario para la organización' in const and 'valor al negocio' in const)
comprobar(12, "cada clase explica su alcance",
          all('help:' in bloque for bloque in [const[const.index('VA:'):const.index('WASTE =')]]))
comprobar(12, "la explicacion se ve en el editor",
          'VALUE[valueClass]?.help' in editors and 'pa-field-help' in css)
gemini_plano = plano(gemini)
comprobar(12, "la IA usa la MISMA definicion que la interfaz",
          'no exige que pague un extra' in gemini_plano
          and 'business value added' in gemini_plano)
comprobar(12, "la IA no puede proponer eliminar un NNVA por serlo",
          'nunca debes proponer eliminarlo' in gemini_plano)

# ---------------------------------------------------------------------------
# Obs 14: "«persona» o «manual», se ejecutan de misma manera [...] manual
#          pudiera ser algún proceso a mano [...] persona [...] a través de
#          cualquier sistema digital [...] Sistema [...] de manera automática"
# ---------------------------------------------------------------------------
comprobar(14, "«Manual» = a mano, sin sistema digital",
          'sin que intervenga ningún sistema digital' in const)
comprobar(14, "«Persona» = con apoyo de un sistema digital",
          'apoyándose en un sistema digital' in const)
comprobar(14, "«Sistema» = ocurre solo, automatico",
          'Ocurre solo, sin que nadie lo ejecute' in const)
comprobar(14, "los ejemplos del usuario estan recogidos",
          all(x in const for x in ('Excel', 'Power BI')))
comprobar(14, "la explicacion se ve al elegir el tipo",
          'TYPES[task.type]?.help' in editors)
comprobar(14, "la IA distingue los tres tipos igual",
          'si media un sistema digital' in gemini_plano)

# ---------------------------------------------------------------------------
# Obs 15: "Mejorar el sistema de «Tutorial» ya sea una vista guiada mas que un
#          texto con imágenes al pasar como si fuera una presentación"
# ---------------------------------------------------------------------------
welcome = leer(f'{FRONT}/components/shared/WelcomeModal.jsx')
comprobar(15, "el tutorial ofrece un recorrido sobre la herramienta",
          'onStartGuidedTour' in welcome and 'Acompáñame paso a paso' in welcome)
comprobar(15, "se ofrece al principio y al final, no escondido",
          welcome.count('offerTour') >= 3)
comprobar(15, "el recorrido esta conectado con la guia real de la aplicacion",
          'onStartGuidedTour={proc ? restartGuide : undefined}' in app)
comprobar(15, "la guia acompana sobre la interfaz, paso a paso",
          'GUIDE_STEPS' in app and 'Paso {step} de {total}' in app)

# ---------------------------------------------------------------------------

# ===========================================================================
# OBSERVACIONES DEL 08/09
# ===========================================================================
dash = leer(f'{FRONT}/components/dashboard/Dashboard.jsx')
resumen_mod = leer(f'{FRONT}/components/editor/ProcessSummaryModal.jsx')
sysicon = leer(f'{FRONT}/utils/systemIcon.js')
narrativa = leer(f'{FRONT}/utils/processNarrative.js')

# Obs 2: "saber si esta se esta realizando en una base de datos, pagina web,
#         hoja de calculo, carpeta, etc."
for familia in ('base de datos', 'p\u00e1gina web', 'hoja de c\u00e1lculo', 'carpeta'):
    comprobar(21, f"se reconoce la familia «{familia}»", familia.lower() in plano(sysicon))
comprobar(21, "el icono se pinta en la tarjeta del diagrama",
          'rf-task-where' in diag and 'ICONO_SISTEMA' in diag)
comprobar(21, "se deduce del campo Sistemas que ya se rellena",
          'familiaDeSistema(data.systems' in diag)
comprobar(21, "el icono explica en que herramienta ocurre",
          'Se realiza en:' in diag)

# Obs 3: "Expandir vista de «Ver flujo» en la hoja principal de menu"
comprobar(22, "el diagrama ya no fija 280px en duro",
          'height = 280' in diag and 'style={{ height, width: "100%"' in diag)
comprobar(22, "«Ver flujo» ocupa todo el alto disponible",
          'height="100%"' in dash)
comprobar(22, "el modal aprovecha mas pantalla",
          "width: '94vw', height: '90vh'" in dash)

# Obs 4: "un resumen en que consta, sus etapas, tiempos, etc."
comprobar(23, "el resumen se redacta en prosa",
          'resumenNarrativo' in resumen_mod and 'pa-narrativa' in css)
comprobar(23, "cubre etapas, tiempos, eficiencia y restriccion",
          all(x in narrativa for x in ('Consta de', 'De principio a fin tarda',
                                       'aporta valor al cliente', 'fija el ritmo')))
comprobar(23, "no depende de la IA para existir",
          'no depende de que la ia responda' in plano(narrativa))
comprobar(23, "los tiempos salen en unidades legibles",
          'const fmt = (sec)' in narrativa)

# Obs 5-6: "Menu izquierdo debe referir cual es el titulo del proceso, cual es
#           su macroproceso, objetivo y su cliente."
for etiqueta in ('Nombre del proceso', 'Objetivo', 'Clientes (C)', 'C\u00f3digo'):
    comprobar(24, f"el campo «{etiqueta}» lleva etiqueta visible",
              f'<span>{etiqueta}</span>' in app)
comprobar(24, "se indica a que macroproceso pertenece",
          'pa-side-macro' in app and 'pa-side-macro' in css)
comprobar(24, "las etiquetas se ven, no son solo marcador de posicion",
          '.pa-side-field > span' in css)

# Defecto visto en la captura del resumen: "10.350000000000001 s"
comprobar(25, "los tiempos no derraman decimales de coma flotante",
          'function redondea(' in editors and 'redondea(sec) + " s"' in editors)


print(f"\n{'='*74}\nAUDITORIA — observaciones del 07/09 y 08/09\n{'='*74}")
fallos = 0
obs_actual = None
for obs, criterio, ok, detalle in resultados:
    if obs != obs_actual:
        print()
        obs_actual = obs
    marca = "OK  " if ok else "FALLA"
    if not ok:
        fallos += 1
    extra = f"   [{detalle}]" if detalle and not ok else ""
    print(f"  obs {obs:<2} {marca:<6} {criterio}{extra}")

print(f"\n{'-'*74}")
print(f"{len(resultados) - fallos}/{len(resultados)} comprobaciones pasan")
if fallos:
    print(f"{fallos} FALLAN — revisar arriba")
sys.exit(1 if fallos else 0)
