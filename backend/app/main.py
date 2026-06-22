from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router as api_router

app = FastAPI(
    title="Procesia Backend API",
    description="Backend para optimización de procesos Lean/BPMN con integración a Gemini API",
    version="1.0.0"
)

# Configurar middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Habilita el acceso desde cualquier origen
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rutas de la API
app.include_router(api_router, prefix="")

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app": "Procesia Backend",
        "version": "1.0.0"
    }
