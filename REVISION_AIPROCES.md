# Revisión de AiProces — 23 de septiembre de 2026

Calificación técnica inicial: **7/10**, antes de los arreglos de esta entrega. Evaluación del código local y sus pruebas; no es una auditoría de producción ni una evaluación visual con usuarios reales.

## Contexto

AiProces permite levantar procesos, organizarlos en macroprocesos, diagramar flujos BPMN, asignar responsables RACI y sistemas, medir tiempos y analizar desperdicios Lean. Integra Gemini para asistencia y optimización, además de comentarios, auditoría de actividad, versiones y respaldos exportables.

La interfaz usa React/Vite y React Flow; el servidor usa FastAPI, SQLAlchemy y PostgreSQL, con migraciones Alembic. El repositorio configura frontend en Vercel y backend en Render.

## Evaluación

| Área | Nota | Evidencia y límites |
| --- | --- | --- |
| Funcionalidad | 8/10 | Diagramas, métricas, RACI, IA, historial y respaldos integrados. La calidad de las respuestas reales de Gemini no se verificó. |
| Protección de datos | 7/10 | Control de propietario y rol, contraseñas con hash y cookies HttpOnly. El cambio de esta revisión protege los procesos versionados contra borrado directo y en cascada. |
| Recuperación | 7/10 | Versiones previas a operaciones destructivas y respaldos JSON. La restauración ahora se confirma en una transacción del servidor, con reversión completa ante fallos. |
| Mantenibilidad | 6/10 | Pruebas de API y frontend disponibles; el componente AiProces.jsx concentra más de 3.000 líneas y múltiples responsabilidades. |
| Operación | 7/10 | Migraciones previas al arranque y endpoint de salud. No se verificaron despliegue, disponibilidad, carga ni recuperación de la base real. |

## Cambio aplicado

- Al existir cualquier versión guardada, un usuario normal ya no puede eliminar el proceso, aunque sea su propietario.
- Tampoco puede eliminar el macroproceso/carpeta que lo contiene. La API devuelve 403 antes de borrar datos.
- Una cuenta con el rol `admin` conserva la capacidad de eliminarlo, incluso cuando el propietario sea otro usuario.
- La protección incluye versiones anteriores al cambio y versiones automáticas; no requiere migración de datos.
- Los procesos sin versiones siguen siendo eliminables por su propietario. Editar, restaurar y mover procesos continúa permitido; moverlos conserva la protección.
- La interfaz informa la regla al guardar y en el historial, y muestra el motivo del rechazo al intentar eliminar.
- Se eligió la alternativa de eliminación exclusiva por administrador. No se implementó una bandeja de solicitudes de permiso.

## Arreglos realizados en la entrega 1.6.0

1. Restauración transaccional: valida los datos antes de modificar el flujo, crea un respaldo, conserva RACI, sistemas, ramas y posiciones, y registra la restauración. Ante fallos intermedios se revierte todo. Las tareas que mantienen su identificador conservan sus mediciones.
2. Módulos separados para restauración, conversión de tareas y vista previa. El componente principal mantiene otras responsabilidades que pueden seguir separándose gradualmente.
3. Detección compartida de producción mediante ENV, ENVIRONMENT y RENDER. En producción Gemini mantiene la verificación TLS incluso si la opción de desarrollo la desactiva.
4. Corrección de los 2 errores y las 17 advertencias del análisis estático, incluidas dependencias de hooks.
5. Vista previa de macroprocesos: recarga el proceso con su disposición actual, tareas, conexiones y notas; utiliza el mismo diagrama y conversión que el editor. Distingue carga, error y flujo vacío, permite reintentar y descarta respuestas tardías. El lienzo tiene espacio definido dentro del modal y es de solo lectura.

## Verificación

- Backend: 177 pruebas aprobadas, incluidas las de permisos y reversión tras fallos durante la restauración. Queda una advertencia de deprecación de python_multipart.
- Frontend: 136 pruebas aprobadas, incluidas carga completa, errores y respuestas tardías de la vista previa.
- Análisis estático: sin errores ni advertencias.
- Las pruebas usan una base SQLite desechable; no modifican la base de producción.
- El navegador integrado no pudo adjuntar la pestaña local, por lo que no se completó la inspección visual interactiva. La vista previa se verificó con pruebas de componentes.

La publicación conserva los servicios existentes en Vercel y Render y no necesita una migración nueva. La versión del backend y la revisión Git quedan visibles en el endpoint de salud para comprobar el despliegue.
