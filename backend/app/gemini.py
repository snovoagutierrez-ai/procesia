import json
import time
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict
from pydantic import ValidationError
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models, schemas
from app.config import settings
from app.metrics import calculate_process_metrics
import os

SYSTEM_PROMPT = """Eres un motor experto en optimización de procesos bajo metodologías Lean, Six Sigma y
BPMN 2.0. Recibirás un objeto JSON que representa el levantamiento transaccional de un
proceso, incluyendo jerarquía, asignación RACI, sistemas involucrados y una sección especial
"metrics" con los cálculos matemáticos reales y exactos (tiempos, desperdicios, cuellos de botella).

Tu ÚNICA función es analizar cualitativamente estos datos y devolver EXCLUSIVAMENTE un objeto JSON válido
conforme al esquema de salida. NO DEBES calcular métricas, asume que las métricas entregadas en "metrics"
son perfectas. Tu trabajo es interpretar la causa raíz (inefficiencies) y generar recomendaciones estructuradas 
y un flujo optimizado (optimized_flow).
IMPORTANTE: Todo el texto generado en descripciones, motivos, recomendaciones y campos similares DEBE estar estrictamente en Español.

REGLAS DE ANÁLISIS
1. Cuellos de botella y Summary: En tu respuesta, puedes devolver datos vacíos o replicar lo que 
   te enviamos. El sistema sobrescribirá esos campos con la matemática exacta, pero dedícate a 
   leer "metrics.bottlenecks" para fundamentar tus recomendaciones.
2. Desperdicios (Inefficiencies): Por cada tarea NVA o cuello de botella encontrado en "metrics", 
   clasifica su causa raíz según los 8 desperdicios Lean (DOWNTIME:
   defects, overproduction, waiting, non_utilized_talent, transportation, inventory,
   motion, excess_processing) y explica el motivo subyacente.
3. RACI: detecta anomalías — más de un 'A' (Accountable) en una tarea, ausencia de 'A',
   o exceso de handoffs entre roles distintos en tareas consecutivas.
4. Sistemas: detecta saltos innecesarios entre sistemas (context switching) y
   oportunidades de automatización o integración.
5. Recomendaciones: por cada hallazgo cualitativo o matemático, propón una acción concreta usando UNO de estos
   action_type: ELIMINATE, AUTOMATE, SIMPLIFY, MERGE, PARALLELIZE, REASSIGN, STANDARDIZE.
   Estima estimated_time_saving_pct (0-100) e implementation_complexity.
6. optimized_flow: propón un grafo reestructurado que paralelice tareas o simplifique
   pasos de acuerdo a tus recomendaciones, manteniendo identificadores BPMN válidos.

Si faltan datos para algún análisis, refléjalo reduciendo analysis_confidence (0.0-1.0).
La respuesta DEBE ser únicamente el siguiente objeto JSON:

{
  "process_id": "string",
  "analysis_confidence": 0.0,
  "summary": {
    "total_cycle_time_sec": 0, "total_wait_time_sec": 0,
    "value_added_ratio": 0.0, "nva_task_count": 0, "handoff_count": 0
  },
  "bottlenecks": [
    {"node_bpmn_id":"string","node_name":"string",
     "metric":"cycle_time|wait_time|rework","value_sec":0,
     "deviation_factor":0.0,"severity":"low|medium|high|critical",
     "impact_description":"string"}
  ],
  "inefficiencies": [
    {"node_bpmn_id":"string",
     "waste_type":"defects|overproduction|waiting|non_utilized_talent|transportation|inventory|motion|excess_processing",
     "description":"string","root_cause":"string"}
  ],
  "recommendations": [
    {"id":"string","target_node_bpmn_id":"string|null",
     "action_type":"ELIMINATE|AUTOMATE|SIMPLIFY|MERGE|PARALLELIZE|REASSIGN|STANDARDIZE",
     "description":"string","expected_benefit":"string",
     "estimated_time_saving_pct":0,"implementation_complexity":"low|medium|high",
     "priority":0}
  ],
  "optimized_flow": {
    "applies": false,
    "nodes": [
      {"bpmn_id":"string","type":"task|gateway|event","subtype":"string",
       "name":"string","cycle_time_sec":0,"wait_time_sec":0,
       "value_classification":"VA|NNVA|NVA"}
    ],
    "flows": [
      {"bpmn_id":"string","source_ref":"string","target_ref":"string",
       "name":"string","condition":"string|null"}
    ]
  }
}"""

def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def build_process_snapshot(db: Session, process_id: int) -> Dict[str, Any]:
    process = db.query(models.Process).filter(models.Process.id == process_id).first()
    if not process:
        raise ValueError(f"Process with id {process_id} not found")

    activities_data = []
    for activity in process.activities:
        tasks_data = []
        for task in activity.tasks:
            # Fetch RACI assignments
            raci_assignments = []
            raci_list = db.query(models.TaskRaci, models.Role).join(models.Role).filter(models.TaskRaci.task_id == task.id).all()
            for tr, role in raci_list:
                raci_assignments.append({
                    "role_id": role.id,
                    "role_name": role.name,
                    "area": role.area,
                    "cost_per_hour": float(role.cost_per_hour) if role.cost_per_hour is not None else None,
                    "raci_type": tr.raci_type
                })

            # Fetch System assignments
            system_assignments = []
            system_list = db.query(models.TaskSystem, models.System).join(models.System).filter(models.TaskSystem.task_id == task.id).all()
            for ts, system in system_list:
                system_assignments.append({
                    "system_id": system.id,
                    "system_name": system.name,
                    "system_type": system.system_type,
                    "vendor": system.vendor,
                    "interaction_type": ts.interaction_type
                })

            tasks_data.append({
                "task_id": task.id,
                "bpmn_id": task.bpmn_id,
                "name": task.name,
                "description": task.description,
                "position_order": task.position_order,
                "task_type": task.task_type,
                "value_classification": task.value_classification,
                "waste_type": task.waste_type,
                "std_cycle_time_sec": float(task.std_cycle_time_sec) if task.std_cycle_time_sec is not None else 0.0,
                "std_wait_time_sec": float(task.std_wait_time_sec) if task.std_wait_time_sec is not None else 0.0,
                "raci": raci_assignments,
                "systems": system_assignments
            })

        activities_data.append({
            "activity_id": activity.id,
            "name": activity.name,
            "position_order": activity.position_order,
            "tasks": tasks_data
        })

    flow_nodes_data = []
    for fn in process.flow_nodes:
        flow_nodes_data.append({
            "bpmn_id": fn.bpmn_id,
            "node_type": fn.node_type,
            "name": fn.name
        })

    sequence_flows_data = []
    for sf in process.sequence_flows:
        sequence_flows_data.append({
            "bpmn_id": sf.bpmn_id,
            "source_ref": sf.source_ref,
            "target_ref": sf.target_ref,
            "name": sf.name,
            "condition_expression": sf.condition_expression
        })

    snapshot = {
        "process_id": str(process.id),
        "name": process.name,
        "code": process.code,
        "objective": process.objective,
        "trigger_event": process.trigger_event,
        "output_result": process.output_result,
        "activities": activities_data,
        "flow_nodes": flow_nodes_data,
        "sequence_flows": sequence_flows_data
    }
    return snapshot

def ask_task_assistant(text: str, context: dict) -> dict:
    client = genai.Client(api_key=settings.gemini_api_key)
    if not client:
        return {"reply": "Error: IA no configurada.", "suggestions": {}}
        
    system_prompt = """
    Eres un asistente experto en modelamiento de procesos (Metodología Lean y BPM). 
    El usuario te explicará una tarea con sus propias palabras.
    
    Tu trabajo es ayudarle a estructurarla.
    
    Responde amigablemente y sugiere:
    1. Un nombre descriptivo para la tarea (corto, empezando con verbo en infinitivo).
    2. Su 'type' (Persona, Manual, o Sistema).
    3. Su 'valueClass' (VA para Valor Agregado, BVA para Valor Agregado de Negocio / Burocracia, NVA para Sin Valor Agregado / Retrabajo).
    
    Devuelve un JSON con este esquema exacto:
    {
      "reply": "Tu mensaje amigable explicando por qué sugieres esto.",
      "suggestions": {
         "name": "Nombre de tarea",
         "type": "Persona|Manual|Sistema",
         "valueClass": "VA|BVA|NVA"
      }
    }
    """
    
    user_prompt = f"Datos actuales de la tarea: {context}\n\nDescripción del usuario: {text}"
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[user_prompt],
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.4
            )
        )
        data = json.loads(response.text)
        return data
    except Exception as e:
        print(f"Error en ask_task_assistant: {e}")
        return {"reply": "Ocurrió un error al procesar tu consulta con la IA.", "suggestions": {}}

def run_optimization(db: Session, process_id: int) -> models.OptimizationRun:
    # 1. Build Process Snapshot & Deterministic Metrics
    try:
        snapshot = build_process_snapshot(db, process_id)
        deterministic_metrics = calculate_process_metrics(db, process_id).model_dump()
        snapshot["metrics"] = deterministic_metrics
    except ValueError as e:
        raise ValueError(str(e))

    # 2. Create pending record in optimization_runs
    db_run = models.OptimizationRun(
        process_id=process_id,
        status=models.OptStatus.pending,
        model_used="gemini-2.5-flash",
        input_snapshot=snapshot
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    # 3. Initialize Gemini SDK client
    import httpx
    
    http_opts = None
    # Only allow bypassing SSL in non-production environments
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)

    raw_response_text = ""
    validated_result = None

    try:
        # First call to Gemini
        contents_json = json.dumps(snapshot, indent=2, default=str)



        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Aquí tienes el snapshot del proceso para optimizar:\n\n{contents_json}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=schemas.OptimizationResult,
                temperature=0.2
            )
        )
        raw_response_text = response.text






        cleaned_text = clean_json_response(raw_response_text)
        parsed_json = json.loads(cleaned_text)
        
        # Pydantic v2 validation
        validated_result = schemas.OptimizationResult.model_validate(parsed_json)

        
    except (json.JSONDecodeError, ValidationError, Exception) as first_err:
        print(f"First attempt failed: {first_err}. Waiting 10 seconds for rate limits before retrying...")
        time.sleep(10)

        # Attempt retry exactly once
        try:
            retry_prompt = (
                f"El JSON anterior falló la validación.\n"
                f"Error de validación:\n{str(first_err)}\n\n"
                f"Por favor, corrige el JSON y devuélvelo estrictamente de acuerdo con el esquema especificado en el system prompt.\n"
                f"Datos del proceso original:\n{json.dumps(snapshot, indent=2)}"
            )

            response_retry = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=retry_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=schemas.OptimizationResult,
                    temperature=0.2
                )
            )
            raw_response_text_retry = response_retry.text






            cleaned_text_retry = clean_json_response(raw_response_text_retry)
            parsed_json_retry = json.loads(cleaned_text_retry)
            
            validated_result = schemas.OptimizationResult.model_validate(parsed_json_retry)

        except Exception as retry_err:

            # Second validation failure - mark status as failed
            db_run.status = models.OptStatus.failed
            db_run.result = {"error": f"First attempt failed: {str(first_err)}. Retry attempt failed: {str(retry_err)}"}
            db_run.completed_at = func.now()
            db.commit()
            db.refresh(db_run)
            return db_run

    # If succeeded validation
    if validated_result:
        result_dict = validated_result.model_dump()
        
        # Override hallucinated math with deterministic python math
        result_dict['summary'] = {
            "total_cycle_time_sec": deterministic_metrics['total_cycle_time_sec'],
            "total_wait_time_sec": deterministic_metrics['total_wait_time_sec'],
            "value_added_ratio": deterministic_metrics['pce_percentage'] / 100.0,
            "nva_task_count": deterministic_metrics['structural']['nva_count'],
            "handoff_count": deterministic_metrics['structural']['handoffs_count']
        }
        
        result_dict['bottlenecks'] = [
            {
                "node_bpmn_id": b['bpmn_id'],
                "node_name": b['name'],
                "metric": b['metric_type'],
                "value_sec": b['value_sec'],
                "deviation_factor": b['deviation_factor'],
                "severity": "high" if b['deviation_factor'] > 2.0 else "medium",
                "impact_description": "Identificado determinísticamente por exceder 1.5x la media"
            } for b in deterministic_metrics.get('bottlenecks', [])
        ]
        
        db_run.status = models.OptStatus.completed
        db_run.result = result_dict
        
        # Extract value_added_ratio from summary if available
        va_ratio = result_dict.get('summary', {}).get('value_added_ratio', 0.0)
        # Cap to [0.0, 1.0] to prevent DB overflow on Numeric(5,4)
        va_ratio = max(0.0, min(1.0, float(va_ratio)))
        db_run.value_added_ratio = Decimal(str(va_ratio))
        db_run.completed_at = func.now()
        db.commit()
        db.refresh(db_run)

    return db_run

MACRO_SYSTEM_PROMPT = """Eres un motor experto en optimización de procesos bajo metodologías Lean, Six Sigma y BPMN 2.0. Recibirás un objeto JSON que representa el levantamiento de un MACROPROCESO completo, incluyendo todos sus sub-procesos y métricas agregadas.

Tu ÚNICA función es analizar cualitativamente estos datos y devolver EXCLUSIVAMENTE un objeto JSON válido conforme al esquema de salida. NO DEBES calcular métricas, asume que las métricas entregadas en "metrics" son perfectas. Tu trabajo es interpretar la causa raíz y generar recomendaciones estructuradas a nivel macro.
IMPORTANTE: Todo el texto generado en descripciones, recomendaciones y justificaciones DEBE estar estrictamente en Español.

REGLAS DE ANÁLISIS MACRO
1. Cuellos de botella macro (TOC): Identifica qué proceso limita el flujo completo basándote en el cycle time de los procesos individuales y reporta en "macro_bottlenecks".
2. Desperdicio de interfaz / handoffs: Evalúa las esperas o retrabajos que ocurren en las transiciones de un proceso a otro, y regístralos en "interface_wastes".
3. Redundancia entre procesos: Identifica pasos o validaciones repetidas en procesos distintos que podrían consolidarse.
4. Secuenciación / paralelización: Identifica procesos que actualmente son secuenciales pero que podrían ejecutarse en paralelo.
5. Recomendaciones y Proyección: Propón acciones y un "projected_macro_lead_time_sec".
6. JSON Estricto: La respuesta DEBE ser únicamente el siguiente objeto JSON:

{
  "macroprocess_id": "string",
  "analysis_confidence": 0.0,
  "summary": {
    "total_macro_lead_time_sec": 0,
    "macro_pce": 0.0,
    "total_handoffs": 0
  },
  "macro_bottlenecks": [
    {"process_code":"string","process_name":"string",
     "metric":"lead_time|cycle_time", "value_sec":0,
     "severity":"low|medium|high|critical",
     "impact_description":"string"}
  ],
  "interface_wastes": [
    {"from_process_code":"string", "to_process_code":"string",
     "waste_type":"waiting|rework|information_loss|motion",
     "description":"string", "estimated_delay_sec":0}
  ],
  "redundancies": [
    {"processes_involved":["string"], "description":"string", "consolidation_opportunity":"string"}
  ],
  "recommendations": [
    {"id":"string","target_process_codes":["string"],
     "action_type":"ELIMINATE|AUTOMATE|SIMPLIFY|MERGE|PARALLELIZE|REASSIGN|STANDARDIZE",
     "description":"string","expected_benefit":"string",
     "implementation_complexity":"low|medium|high",
     "priority":0}
  ],
  "projected_macro_lead_time_sec": 0
}"""

def build_macroprocess_snapshot(db: Session, macroprocess_id: int) -> Dict[str, Any]:
    macro = db.query(models.Macroprocess).filter(models.Macroprocess.id == macroprocess_id).first()
    if not macro:
        raise ValueError(f"Macroprocess with id {macroprocess_id} not found")
        
    processes_data = []
    total_lead_time = 0.0
    total_va_time = 0.0
    total_handoffs = 0
    
    for process in macro.processes:
        try:
            p_snapshot = build_process_snapshot(db, process.id)
            p_metrics = calculate_process_metrics(db, process.id).model_dump()
            
            p_lead = p_metrics.get("lead_time_sec", 0)
            p_pce = p_metrics.get("pce_percentage", 0)
            p_va = (p_lead * p_pce) / 100.0 if p_lead > 0 else 0
            
            total_lead_time += p_lead
            total_va_time += p_va
            total_handoffs += p_metrics.get("structural", {}).get("handoffs_count", 0)
            
            processes_data.append({
                "process_id": process.id,
                "code": process.code,
                "name": process.name,
                "snapshot": p_snapshot,
                "metrics": p_metrics
            })
        except Exception:
            continue
        
    macro_pce = (total_va_time / total_lead_time * 100.0) if total_lead_time > 0 else 0.0
    
    return {
        "macroprocess_id": str(macro.id),
        "code": macro.code,
        "name": macro.name,
        "processes": processes_data,
        "metrics": {
            "total_macro_lead_time_sec": total_lead_time,
            "macro_pce": macro_pce,
            "total_handoffs": total_handoffs,
            "process_count": len(processes_data)
        }
    }

def run_macro_optimization(db: Session, macroprocess_id: int) -> models.MacroOptimizationRun:
    try:
        snapshot = build_macroprocess_snapshot(db, macroprocess_id)
    except ValueError as e:
        raise ValueError(str(e))

    if len(snapshot.get("processes", [])) < 2:
        db_run = models.MacroOptimizationRun(
            macroprocess_id=macroprocess_id,
            status=models.OptStatus.failed,
            model_used="gemini-2.5-flash",
            input_snapshot=snapshot,
            result={"error": "Se necesitan al menos 2 procesos con datos completos para optimizar el macroproceso."}
        )
        db.add(db_run)
        db.commit()
        db.refresh(db_run)
        return db_run

    db_run = models.MacroOptimizationRun(
        macroprocess_id=macroprocess_id,
        status=models.OptStatus.pending,
        model_used="gemini-2.5-flash",
        input_snapshot=snapshot
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    import httpx
    
    http_opts = None
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)

    raw_response_text = ""
    validated_result = None

    try:
        contents_json = json.dumps(snapshot, default=str, indent=2)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"DATOS DEL MACROPROCESO:\n\n{contents_json}",
            config=types.GenerateContentConfig(
                system_instruction=MACRO_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=schemas.MacroOptimizationResult,
                temperature=0.2
            )
        )
        
        raw_response_text = response.text if response.text else ""
        cleaned_json_str = clean_json_response(raw_response_text)
        parsed_json = json.loads(cleaned_json_str)
        validated_result = schemas.MacroOptimizationResult.model_validate(parsed_json).model_dump()

    except (json.JSONDecodeError, ValidationError, Exception) as first_err:
        print(f"First attempt failed in Macro Optimization: {first_err}. Waiting 10 seconds for rate limits before retrying...")
        time.sleep(10)
        
        try:
            retry_prompt = f"El JSON anterior falló en validación Pydantic o parseo por: {str(first_err)}. Corrige y devuelve un JSON válido de MacroOptimizationResult según el esquema original.\n\nJSON CON ERRORES:\n{raw_response_text}"
            
            retry_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=retry_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=MACRO_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=schemas.MacroOptimizationResult,
                    temperature=0.2
                )
            )
            raw_response_text = retry_response.text if retry_response.text else ""
            cleaned_retry = clean_json_response(raw_response_text)
            parsed_json = json.loads(cleaned_retry)
            validated_result = schemas.MacroOptimizationResult.model_validate(parsed_json).model_dump()
        except Exception as retry_err:
            print(f"Second attempt failed in Macro Optimization: {retry_err}")
            db_run.status = models.OptStatus.failed
            db_run.result = {"error": str(retry_err), "raw_response": raw_response_text}
            db.commit()
            db.refresh(db_run)
            return db_run

    if validated_result:
        db_run.status = models.OptStatus.completed
        db_run.result = validated_result

        db_run.completed_at = func.now()
        db.commit()
        db.refresh(db_run)

    return db_run

def tutorial_chat(message: str) -> str:
    import httpx
    http_opts = None
    if not settings.gemini_ssl_verify and os.environ.get("ENVIRONMENT", "development") != "production":
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)
    
    system_prompt = (
        "Eres el asistente amigable de AiProces. Tu objetivo es ayudar a los usuarios a entender la plataforma. "
        "Responde de forma MUY breve (1-3 oraciones), directa y con tono motivador. "
        "Si la pregunta no tiene relación con mapas de procesos, bpm, cuellos de botella o AiProces, dile amablemente "
        "que tu función es exclusiva para optimización de procesos empresariales."
    )
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3
            )
        )
        return response.text if response.text else "Lo siento, no pude formular una respuesta."
    except Exception as e:
        return "Hubo un problema temporal con nuestra IA. ¡Intenta de nuevo en unos minutos!"
