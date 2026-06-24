from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import logging
import os

from app.api import router as api_router
from app.limiter import limiter

# Setup logger for uncaught exceptions
logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="AiProces Backend API",
    description="Backend para optimización de procesos Lean/BPMN con integración a Gemini API",
    version="1.5.0"
)

# Register Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Determinar regex base (vercel previews + localhost)
cors_regex = r"^https://aiproces.*\.vercel\.app$|^http://(localhost|127\.0\.0\.1)(:\d+)?$"

# Expandir para redes locales solo en desarrollo
is_production = os.environ.get("ENV", "development").lower() == "production" or os.environ.get("RENDER") == "true"
if not is_production:
    cors_regex = r"^https://aiproces.*\.vercel\.app$|^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$"

# Configurar middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://aiproces.vercel.app",
        "http://localhost:5173",  # Para desarrollo local frontend
    ],
    allow_origin_regex=cors_regex,
    allow_credentials=True, # Necesario para SameSite cookies / JWT
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Global Exception Handler (To prevent leaking stacktraces)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error occurred. Please try again later."},
    )

# Incluir rutas de la API
app.include_router(api_router, prefix="")

# Add rate limit to auth and optimize directly on the app or via limiter wrapper if we put it in api.py
# Wait, to apply rate limiting easily to specific endpoints defined in APIRouter, 
# we need to decorate them with @limiter.limit("5/minute") in api.py.
# But `limiter` is defined in main.py. Let's move limiter initialization to a separate file or just pass it to api.py.
# Actually, slowapi can be applied at the router level by importing the limiter instance. 
# We will do that in api.py later.

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "app": "AiProces Backend",
        "version": "1.5.0"
    }
