MACRO_SYSTEM_PROMPT = """Eres un motor experto en optimizacin de procesos bajo metodologas Lean, Six Sigma y BPMN 2.0. Recibirs un objeto JSON que representa el levantamiento de un MACROPROCESO completo, incluyendo todos sus sub-procesos y mtricas agregadas.

Tu NICA funcin es analizar cualitativamente estos datos y devolver EXCLUSIVAMENTE un objeto JSON vlido conforme al esquema de salida. NO DEBES calcular mtricas, asume que las mtricas entregadas en "metrics" son perfectas. Tu trabajo es interpretar la causa raz y generar recomendaciones estructuradas a nivel macro.

REGLAS DE ANLISIS MACRO
1. Cuellos de botella macro (TOC): Identifica qu proceso limita el flujo completo basndote en el cycle time de los procesos individuales y reporta en "macro_bottlenecks".
2. Desperdicio de interfaz / handoffs: Evala las esperas o retrabajos que ocurren en las transiciones de un proceso a otro, y regstralos en "interface_wastes".
3. Redundancia entre procesos: Identifica pasos o validaciones repetidas en procesos distintos que podran consolidarse.
4. Secuenciacin / paralelizacin: Identifica procesos que actualmente son secuenciales pero que podran ejecutarse en paralelo.
5. Recomendaciones y Proyeccin: Propn acciones y un "projected_macro_lead_time_sec".
6. JSON Estricto: La respuesta DEBE ser nicamente el siguiente objeto JSON:

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
            
            p_lead = p_metrics.get("total_lead_time_sec", 0)
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
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(role="user", parts=[
                    types.Part.from_text(text=MACRO_SYSTEM_PROMPT),
                    types.Part.from_text(text=f"DATOS DEL MACROPROCESO:\n{json.dumps(snapshot, default=str)}")
                ])
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                top_p=0.95,
                top_k=20,
                candidate_count=1,
                max_output_tokens=8192
            )
        )
        
        raw_response_text = response.text if response.text else ""
        cleaned_json_str = clean_json_response(raw_response_text)
        
        try:
            validated_result = json.loads(cleaned_json_str)
        except json.JSONDecodeError as jde:
            print(f"JSON Decode Error in Macro Optimization: {jde}")
            raise ValueError("Failed to parse JSON")

        db_run.status = models.OptStatus.completed
        db_run.result = validated_result
        db_run.completed_at = func.now()
        db.commit()
        db.refresh(db_run)

    except Exception as e:
        print(f"Gemini API Error in Macro Optimization: {e}")
        db_run.status = models.OptStatus.failed
        db_run.result = {"error": str(e), "raw_response": raw_response_text}
        db.commit()
        db.refresh(db_run)

    return db_run
