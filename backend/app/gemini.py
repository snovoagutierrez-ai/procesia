import json
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

SYSTEM_PROMPT = """Eres un motor experto en optimización de procesos bajo metodologías Lean, Six Sigma y
BPMN 2.0. Recibirás un objeto JSON que representa el levantamiento transaccional de un
proceso, incluyendo jerarquía, tiempos de ciclo y espera, asignación RACI, sistemas
involucrados y clasificación de valor agregado por tarea (VA=valor agregado,
NNVA=necesario sin valor, NVA=desperdicio).

Tu ÚNICA función es analizar estos datos y devolver EXCLUSIVAMENTE un objeto JSON válido
conforme al esquema de salida definido más abajo. No incluyas texto, explicaciones,
markdown ni bloques de código fuera del JSON. No inventes métricas: toda conclusión debe
derivarse de los datos provistos.

REGLAS DE ANÁLISIS
1. Cuellos de botella: identifica nodos cuyo cycle_time o wait_time supere 1.5x la media
   del proceso, o que concentren reprocesos. Reporta el deviation_factor y cuantifica el
   impacto.
2. Desperdicios: clasifica cada tarea NVA según los 8 desperdicios Lean (DOWNTIME:
   defects, overproduction, waiting, non_utilized_talent, transportation, inventory,
   motion, excess_processing) e indica su causa raíz.
3. RACI: detecta anomalías — más de un 'A' (Accountable) en una tarea, ausencia de 'A',
   o exceso de handoffs entre roles distintos en tareas consecutivas.
4. Sistemas: detecta saltos innecesarios entre sistemas (context switching) y
   oportunidades de automatización o integración.
5. Recomendaciones: por cada hallazgo propón una acción concreta usando UNO de estos
   action_type: ELIMINATE, AUTOMATE, SIMPLIFY, MERGE, PARALLELIZE, REASSIGN, STANDARDIZE.
   Estima estimated_time_saving_pct (0-100) e implementation_complexity.
6. optimized_flow: cuando aporte valor, propón un grafo reestructurado que paralelice
   tareas independientes y elimine esperas, manteniendo identificadores BPMN válidos.

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

def run_optimization(db: Session, process_id: int) -> models.OptimizationRun:
    # 1. Build Process Snapshot
    try:
        snapshot = build_process_snapshot(db, process_id)
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
    if not settings.gemini_ssl_verify:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        h_client = httpx.Client(verify=False)
        http_opts = types.HttpOptions(httpx_client=h_client)

    client = genai.Client(api_key=settings.gemini_api_key, http_options=http_opts)

    raw_response_text = ""
    validated_result = None

    try:
        # First call to Gemini
        contents_json = json.dumps(snapshot, indent=2)
        print("\n" + "="*60)
        print("[GEMINI] Sending optimization request (attempt 1)...")
        print("="*60)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"Aquí tienes el snapshot del proceso para optimizar:\n\n{contents_json}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )
        raw_response_text = response.text
        print("\n" + "="*60)
        print("[GEMINI] RAW RESPONSE (attempt 1):")
        print("="*60)
        print(raw_response_text)
        print("="*60 + "\n")

        cleaned_text = clean_json_response(raw_response_text)
        parsed_json = json.loads(cleaned_text)
        
        # Pydantic v2 validation
        validated_result = schemas.OptimizationResult.model_validate(parsed_json)
        print("[GEMINI] OK: Pydantic validation PASSED on attempt 1")
        
    except (json.JSONDecodeError, ValidationError, Exception) as first_err:
        print(f"\n[GEMINI] ERROR: Attempt 1 FAILED: {type(first_err).__name__}: {first_err}\n")
        # Attempt retry exactly once
        try:
            retry_prompt = (
                f"El JSON anterior falló la validación.\n"
                f"Error de validación:\n{str(first_err)}\n\n"
                f"Por favor, corrige el JSON y devuélvelo estrictamente de acuerdo con el esquema especificado en el system prompt.\n"
                f"Datos del proceso original:\n{json.dumps(snapshot, indent=2)}"
            )
            print("[GEMINI] Sending retry request (attempt 2)...")
            response_retry = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=retry_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json"
                )
            )
            raw_response_text_retry = response_retry.text
            print("\n" + "="*60)
            print("[GEMINI] RAW RESPONSE (attempt 2):")
            print("="*60)
            print(raw_response_text_retry)
            print("="*60 + "\n")

            cleaned_text_retry = clean_json_response(raw_response_text_retry)
            parsed_json_retry = json.loads(cleaned_text_retry)
            
            validated_result = schemas.OptimizationResult.model_validate(parsed_json_retry)
            print("[GEMINI] OK: Pydantic validation PASSED on attempt 2")
        except Exception as retry_err:
            print(f"\n[GEMINI] ERROR: Attempt 2 FAILED: {type(retry_err).__name__}: {retry_err}\n")
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
        db_run.status = models.OptStatus.completed
        db_run.result = result_dict
        
        # Extract value_added_ratio from summary if available
        va_ratio = result_dict.get('summary', {}).get('value_added_ratio', 0.0)
        db_run.value_added_ratio = Decimal(str(va_ratio))
        db_run.completed_at = func.now()
        db.commit()
        db.refresh(db_run)

    return db_run
