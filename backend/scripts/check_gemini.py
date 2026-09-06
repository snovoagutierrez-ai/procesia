import os
import sys

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("ERROR: no encontré GEMINI_API_KEY en las variables de entorno de este entorno.")
    sys.exit(1)

print(f"Usando key con prefijo: {api_key[:6]}... (largo total: {len(api_key)} caracteres)")
print("-" * 60)

try:
    from google import genai
except ImportError:
    print("ERROR: el paquete google-genai no está instalado en este entorno.")
    sys.exit(1)

# PRUEBA 1: modelo viejo conocido (gemini-2.5-flash), sin nada extra
print("PRUEBA 1: gemini-2.5-flash, prompt simple, sin schema, sin system_instruction")
try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Responde solamente con la palabra: OK",
    )
    print("  RESULTADO: ÉXITO")
    print(f"  Respuesta del modelo: {response.text!r}")
except Exception as e:
    print("  RESULTADO: FALLÓ")
    print(f"  Tipo de error: {type(e).__name__}")
    print(f"  Mensaje completo: {e}")

print("-" * 60)

# PRUEBA 2: el modelo nuevo que Antigravity puso (gemini-3.5-flash)
print("PRUEBA 2: gemini-3.5-flash, prompt simple, sin schema, sin system_instruction")
try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents="Responde solamente con la palabra: OK",
    )
    print("  RESULTADO: ÉXITO")
    print(f"  Respuesta del modelo: {response.text!r}")
except Exception as e:
    print("  RESULTADO: FALLÓ")
    print(f"  Tipo de error: {type(e).__name__}")
    print(f"  Mensaje completo: {e}")

print("-" * 60)
print("FIN DEL DIAGNÓSTICO. Copia toda esta salida completa, sin resumir.")
