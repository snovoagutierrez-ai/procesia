# Entorno de prueba de AiProces

Desde PowerShell, en la raíz del proyecto:

```powershell
./scripts/start-test-env.ps1 -SeedDemo
```

Abre [AiProces local](http://127.0.0.1:5173/) e inicia sesión con `sandbox@local.test` y `SandboxDePrueba123`.

En **Vista jerárquica**, abre la carpeta **Operaciones** y pulsa **Ver flujo** en **Evaluación crediticia**. La vista previa muestra tareas, una decisión con ramas Sí/No y una tarea deliberadamente aislada. En **Editar proceso** puedes mover nodos, cambiar tareas, guardar versiones y probar la restauración.

La API usa `backend/sandbox.db`, una base SQLite local separada de la base de producción. La opción `-SeedDemo` crea un proceso nuevo cada vez que se ejecuta; omítela para volver a abrir los datos existentes sin duplicarlos.

El entorno escucha solo en `127.0.0.1` y necesita que la computadora y los dos procesos sigan encendidos. Si falta `backend/.venv`, instala las dependencias de `backend/requirements.txt`; si falta `frontend/node_modules`, ejecuta `npm ci` en `frontend`.
