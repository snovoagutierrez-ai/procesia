"""Detección de producción compartida por autenticación, CORS e IA."""
import os


def is_production():
    return (
        os.environ.get("ENV", "").lower() == "production"
        or os.environ.get("ENVIRONMENT", "").lower() == "production"
        or os.environ.get("RENDER", "").lower() == "true"
    )
