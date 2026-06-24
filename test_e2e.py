import requests
import random
import time
import json
import sys

BASE_URL = "http://localhost:8001"

def run_test():
    print("=== AiProces E2E Test ===")
    
    # 1. Register
    email = f"test_{random.randint(1000,9999)}@example.com"
    password = "SuperSecretPassword123"
    print(f"[*] Registering user {email}...")
    
    try:
        res = requests.post(f"{BASE_URL}/auth/register", json={
            "email": email,
            "password": password
        })
    except requests.exceptions.ConnectionError:
        print(f"ERROR: No se pudo conectar a {BASE_URL}. Asegúrate de tener el servidor local corriendo.")
        sys.exit(1)
        
    if res.status_code not in (200, 201):
        print("Registration failed:", res.text)
        return

    # 2. Login
    print("[*] Logging in...")
    res = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email,
        "password": password
    })
    
    token = res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Create Macroprocess
    print("[*] Creating Macroprocess...")
    mac_code = f"MAC-TEST-{random.randint(1000, 9999)}"
    res = requests.post(f"{BASE_URL}/macroprocesses", json={
        "code": mac_code,
        "name": "E2E Test Macro",
        "owner_area": "IT"
    }, headers=headers)
    macro_id = res.json()["id"]
    
    # 4. Create Process
    print("[*] Creating Process...")
    proc_code = f"PROC-TEST-{random.randint(1000, 9999)}"
    res = requests.post(f"{BASE_URL}/processes", json={
        "macroprocess_id": macro_id,
        "code": proc_code,
        "name": "E2E Test Process",
        "objective": "Test the optimization engine",
        "trigger_event": "Start",
        "output_result": "End"
    }, headers=headers)
    proc_id = res.json()["id"]
    
    # 5. Create Tasks
    print("[*] Creating Tasks...")
    task_ids = []
    task_bpmns = []
    gateway_bpmn = f"Gateway_E2E_{random.randint(1000,9999)}"
    
    for i in range(3):
        bpmn_id = f"Task_E2E_{random.randint(1000,9999)}_{i}"
        res = requests.post(f"{BASE_URL}/processes/{proc_id}/tasks", json={
            "bpmn_id": bpmn_id,
            "name": f"Test Task {i+1}",
            "description": "Dummy task",
            "position_order": i + 1,
            "task_type": "user",
            "value_classification": "NVA" if i == 1 else "VA",
            "waste_type": "waiting" if i == 1 else None,
            "std_cycle_time_sec": 300,
            "std_wait_time_sec": 1200 if i == 1 else 0,
            "responsible": "Agent A" if i < 2 else "Agent B",
            "accountable": "Manager",
            "consulted": "",
            "informed": "",
            "systems": ""
        }, headers=headers)
        data = res.json()
        task_ids.append(data["id"])
        task_bpmns.append(data["bpmn_id"])
        time.sleep(1)

    # 6. Create Gateway and Graph
    print("[*] Saving Graph structure...")
    gateways = [{
        "bpmn_id": gateway_bpmn,
        "node_type": "exclusiveGateway",
        "name": "Is it valid?"
    }]
    
    sequence_flows = [
        {"bpmn_id": f"Flow_E2E_{random.randint(1000,9999)}_1", "source_ref": task_bpmns[0], "target_ref": gateway_bpmn, "name": ""},
        {"bpmn_id": f"Flow_E2E_{random.randint(1000,9999)}_2", "source_ref": gateway_bpmn, "target_ref": task_bpmns[1], "name": "Yes"},
    ]
    
    res = requests.put(f"{BASE_URL}/processes/{proc_id}/graph", json={
        "gateways": gateways,
        "sequence_flows": sequence_flows
    }, headers=headers)
    
    # 7. Optimize!
    print("[*] Triggering AI Optimization (this might take 10-20 seconds)...")
    res = requests.post(f"{BASE_URL}/processes/{proc_id}/optimize", headers=headers)
    
    if res.status_code == 200:
        opt_result = res.json()
        print("\n\n====== OPTIMIZATION RESULT ======")
        print(json.dumps(opt_result, indent=2, ensure_ascii=False))
        print("=================================")
        print("\n\n[SUCCESS] E2E Test Completed.")
    else:
        print("Optimization failed:", res.status_code, res.text)
        
if __name__ == "__main__":
    run_test()
