# Arreglos de las observaciones de AiProces del 1 de octubre

Implementación local del adjunto `Observaciones de Aiproces (5).docx`, realizada el 8 de octubre de 2026.

## Macroprocesos

- Las conexiones tienen el mismo botón de eliminación que el flujo de un proceso. También se pueden seleccionar y borrar por teclado.
- El cambio se guarda en el servidor; si falla, el diagrama recupera el último estado confirmado y muestra el error. Los guardados consecutivos se ejecutan en orden y conservan la posición de las tarjetas.
- Cada tarjeta permite solicitar la eliminación del proceso indicando un motivo. Solicitarla conserva el proceso y sus versiones hasta que un administrador apruebe el borrado.
- La bandeja **Solicitudes de eliminación**, en la barra superior del inicio, muestra las solicitudes propias a cada usuario y todas las solicitudes al administrador. Permite aprobar con confirmación o rechazar, con un comentario opcional.
- Una aprobación elimina el proceso y sus conexiones en una transacción. La solicitud conserva el nombre, código, motivo, estado y resolución después del borrado. Se impiden solicitudes pendientes duplicadas y el borrado directo o mediante la carpeta por parte del solicitante mientras espera la decisión.

## Panel derecho del flujo

Se ajustaron las columnas, el ancho de la tarjeta, los márgenes del pie y los campos dobles. Los tiempos y campos RACI se apilan cuando el panel es estrecho. Las ayudas respetan el ancho disponible para evitar el desbordamiento que muestra la captura del adjunto.

## Notas

El lápiz permite editar el texto directamente sobre el lienzo. Pulsar la barra superior guarda y cierra; el botón de cierre también guarda un borrador activo. **Ctrl+Enter** o **Cmd+Enter** guardan, y **Escape** cancela la edición. Un error conserva el borrador abierto y permite reintentar. Se rechaza el texto vacío y se respeta el límite de 2.000 caracteres. Las vistas de solo lectura conservan esa restricción.

## Publicación y comprobación

La migración `g7b8c9d0e1f2_add_deletion_requests.py` agrega la tabla de solicitudes, sus claves e índices. El despliegue del backend debe ejecutar `alembic upgrade head` antes de servir esta versión; Render ya configura ese paso. No se publicó ni se aplicó la migración a la base de producción.

- Frontend: 153 pruebas aprobadas, análisis estático sin errores ni advertencias y compilación de producción correcta.
- Servidor: 46 pruebas aprobadas sobre SQLite desechable, incluidas solicitudes, permisos, protección de versiones, colaboración y creación/reversión de la migración. Permanece una advertencia existente de deprecación de `python_multipart`.
- No se pudo completar la inspección visual interactiva: el navegador integrado falló al adjuntar la página local en dos intentos. El ajuste de diseño se revisó en el código; las interacciones se verificaron mediante pruebas de componentes.
