import hashlib
import xml.etree.ElementTree as ET
from typing import Any, Dict
from sqlalchemy.orm import Session
from app import models

NS = {
    "bpmn":   "http://www.omg.org/spec/BPMN/20100524/MODEL",
    "bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI",
    "dc":     "http://www.omg.org/spec/DD/20100524/DC",
    "di":     "http://www.omg.org/spec/DD/20100524/DI",
    "xsi":    "http://www.w3.org/2001/XMLSchema-instance",
    "lean":   "http://procesia.app/schema/lean",
}

for prefix, uri in NS.items():
    ET.register_namespace(prefix, uri)

def q(prefix: str, tag: str) -> str:
    return f"{{{NS[prefix]}}}{tag}"

TASK_MAP    = {"manual": "manualTask", "user": "userTask",
               "service": "serviceTask", "script": "scriptTask", "default": "task"}
GATEWAY_MAP = {"exclusive": "exclusiveGateway", "parallel": "parallelGateway",
               "inclusive": "inclusiveGateway"}

def build_bpmn_xml(process: dict[str, Any]) -> bytes:
    definitions = ET.Element(
        q("bpmn", "definitions"),
        attrib={"id": f"Definitions_{process['id']}",
                "targetNamespace": "http://procesia.app/bpmn"},
    )
    process_bpmn_id = f"Process_{process['id']}"
    proc = ET.SubElement(definitions, q("bpmn", "process"),
                            attrib={"id": process_bpmn_id, "isExecutable": "false"})
    if process.get("name"):
        proc.set("name", process["name"])

    incoming, outgoing = {}, {}
    for f in process["flows"]:
        outgoing.setdefault(f["source"], []).append(f["id"])
        incoming.setdefault(f["target"], []).append(f["id"])

    Y_CENTER, X0, GAP = 180, 160, 60
    W_TASK, H_TASK, SZ_EVENT, SZ_GW = 110, 80, 36, 50
    bounds: dict[str, tuple[int, int, int, int]] = {}
    cursor_x = X0

    for node in process["nodes"]:
        nid, ntype = node["id"], node["type"]
        if ntype == "event":
            tag = "startEvent" if node.get("subtype") == "start" else "endEvent"
            w = h = SZ_EVENT
        elif ntype == "gateway":
            tag = GATEWAY_MAP.get(node.get("subtype", "exclusive"), "exclusiveGateway")
            w = h = SZ_GW
        else:
            tag = TASK_MAP.get(node.get("subtype", "default"), "task")
            w, h = W_TASK, H_TASK

        el = ET.SubElement(proc, q("bpmn", tag), attrib={"id": nid})
        if node.get("name"):
            el.set("name", node["name"])

        if node.get("description"):
            ET.SubElement(el, q("bpmn", "documentation")).text = node["description"]

        if any(k in node for k in ("cycle_time", "wait_time", "value_class")):
            ext = ET.SubElement(el, q("bpmn", "extensionElements"))
            metrics = ET.SubElement(ext, q("lean", "metrics"))
            for k in ("cycle_time", "wait_time", "value_class"):
                if node.get(k) is not None:
                    metrics.set(k, str(node[k]))

        for fid in incoming.get(nid, []):
            ET.SubElement(el, q("bpmn", "incoming")).text = fid
        for fid in outgoing.get(nid, []):
            ET.SubElement(el, q("bpmn", "outgoing")).text = fid

        bounds[nid] = (cursor_x, Y_CENTER - h // 2, w, h)
        cursor_x += w + GAP

    for f in process["flows"]:
        sf = ET.SubElement(proc, q("bpmn", "sequenceFlow"),
                              attrib={"id": f["id"],
                                      "sourceRef": f["source"], "targetRef": f["target"]})
        if f.get("name"):
            sf.set("name", f["name"])
        if f.get("condition"):
            cond = ET.SubElement(sf, q("bpmn", "conditionExpression"),
                                    attrib={q("xsi", "type"): "bpmn:tFormalExpression"})
            cond.text = f["condition"]

    diagram = ET.SubElement(definitions, q("bpmndi", "BPMNDiagram"),
                               attrib={"id": f"Diagram_{process['id']}"})
    plane = ET.SubElement(diagram, q("bpmndi", "BPMNPlane"),
                             attrib={"id": f"Plane_{process['id']}",
                                     "bpmnElement": process_bpmn_id})
    for nid, (x, y, w, h) in bounds.items():
        shape = ET.SubElement(plane, q("bpmndi", "BPMNShape"),
                                 attrib={"id": f"{nid}_di", "bpmnElement": nid})
        ET.SubElement(shape, q("dc", "Bounds"),
                         attrib={"x": str(x), "y": str(y),
                                 "width": str(w), "height": str(h)})
    for f in process["flows"]:
        edge = ET.SubElement(plane, q("bpmndi", "BPMNEdge"),
                                attrib={"id": f"{f['id']}_di", "bpmnElement": f["id"]})
        sx, sy, sw, sh = bounds[f["source"]]
        tx, ty, tw, th = bounds[f["target"]]
        ET.SubElement(edge, q("di", "waypoint"),
                         attrib={"x": str(sx + sw), "y": str(sy + sh // 2)})
        ET.SubElement(edge, q("di", "waypoint"),
                         attrib={"x": str(tx), "y": str(ty + th // 2)})

    ET.indent(definitions, space="  ")
    return ET.tostring(definitions, xml_declaration=True, encoding="UTF-8")

def generate_and_save_bpmn(db: Session, process_id: int) -> bytes:
    # 1. Fetch process from DB
    process = db.query(models.Process).filter(models.Process.id == process_id).first()
    if not process:
        raise ValueError(f"Process with id {process_id} not found")

    # 2. Collect task nodes sorted by position_order
    task_nodes = []
    for activity in process.activities:
        for task in activity.tasks:
            task_nodes.append({
                "id": task.bpmn_id,
                "type": "task",
                "subtype": task.task_type.value,
                "name": task.name,
                "description": task.description,
                "cycle_time": float(task.std_cycle_time_sec) if task.std_cycle_time_sec is not None else 0.0,
                "wait_time": float(task.std_wait_time_sec) if task.std_wait_time_sec is not None else 0.0,
                "value_class": task.value_classification.value,
                "_order": task.position_order
            })
    task_nodes.sort(key=lambda n: n["_order"])
    # Remove internal sort key before passing to builder
    for tn in task_nodes:
        del tn["_order"]

    # 3. Build event nodes and flow nodes from DB
    db_event_nodes = []
    db_gateway_nodes = []
    for fn in process.flow_nodes:
        if fn.node_type in (models.BpmnNodeType.startEvent, models.BpmnNodeType.endEvent, models.BpmnNodeType.intermediateEvent):
            ntype = "event"
            subtype = "start" if fn.node_type == models.BpmnNodeType.startEvent else "end"
            db_event_nodes.append({
                "id": fn.bpmn_id,
                "type": ntype,
                "subtype": subtype,
                "name": fn.name,
                "description": None
            })
        else:
            ntype = "gateway"
            subtype = fn.node_type.value.replace("Gateway", "")
            db_gateway_nodes.append({
                "id": fn.bpmn_id,
                "type": ntype,
                "subtype": subtype,
                "name": fn.name,
                "description": None
            })

    # 4. Build sequence flows from DB
    db_flows = []
    for sf in process.sequence_flows:
        db_flows.append({
            "id": sf.bpmn_id,
            "source": sf.source_ref,
            "target": sf.target_ref,
            "name": sf.name,
            "condition": sf.condition_expression
        })

    # 5. Check if we have proper start/end events and flows;
    #    if not, auto-generate a linear chain: start → task_1 → task_2 → … → end
    has_start = any(n["subtype"] == "start" for n in db_event_nodes)
    has_end   = any(n["subtype"] == "end"   for n in db_event_nodes)
    has_flows = len(db_flows) > 0

    if has_start and has_end and has_flows:
        # DB already contains a complete graph — use it as-is
        nodes = []
        # Put start events first
        nodes += [n for n in db_event_nodes if n["subtype"] == "start"]
        nodes += task_nodes
        nodes += db_gateway_nodes
        # Put end events last
        nodes += [n for n in db_event_nodes if n["subtype"] != "start"]
        flows = db_flows
    else:
        # Auto-generate a linear flow: StartEvent → tasks in order → EndEvent
        start_id = f"StartEvent_{process_id}"
        end_id   = f"EndEvent_{process_id}"

        start_node = {
            "id": start_id,
            "type": "event",
            "subtype": "start",
            "name": process.trigger_event or "Inicio",
            "description": None
        }
        end_node = {
            "id": end_id,
            "type": "event",
            "subtype": "end",
            "name": process.output_result or "Fin",
            "description": None
        }

        nodes = [start_node] + task_nodes + [end_node]

        # Build sequential flows
        flows = []
        for i in range(len(nodes) - 1):
            flows.append({
                "id": f"Flow_{process_id}_{i + 1}",
                "source": nodes[i]["id"],
                "target": nodes[i + 1]["id"],
                "name": None,
                "condition": None
            })

    process_dict = {
        "id": str(process.id),
        "name": process.name,
        "nodes": nodes,
        "flows": flows
    }

    # 6. Generate XML bytes
    xml_bytes = build_bpmn_xml(process_dict)

    # 5. Compute SHA256 Checksum
    checksum = hashlib.sha256(xml_bytes).hexdigest()

    # 6. Calculate new version number
    latest_artifact = db.query(models.BpmnArtifact)\
        .filter(models.BpmnArtifact.process_id == process_id)\
        .order_by(models.BpmnArtifact.version.desc())\
        .first()
    
    new_version = 1 if not latest_artifact else latest_artifact.version + 1

    # 7. Save to bpmn_artifacts table
    db_artifact = models.BpmnArtifact(
        process_id=process_id,
        version=new_version,
        source=models.ArtifactSource.manual,
        xml_content=xml_bytes.decode('utf-8'),
        checksum=checksum
    )
    db.add(db_artifact)
    db.commit()

    return xml_bytes
