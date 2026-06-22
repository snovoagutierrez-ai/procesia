"""
mermaid_export.py — Generate Mermaid flowchart syntax from a process and its tasks.
"""
from sqlalchemy.orm import Session
from app import models
import re


def _sanitize_label(text: str) -> str:
    """Escape characters that break Mermaid syntax."""
    if not text:
        return "?"
    # Remove or replace problematic chars
    text = text.replace('"', "'").replace('\n', ' ').strip()
    # If it contains special Mermaid chars, wrap in quotes
    if re.search(r'[[\]{}()|<>&]', text):
        text = text.replace('"', "'")
    return text


def _value_class_style(vc: str) -> str:
    """Return Mermaid style for value classification."""
    styles = {
        "VA":   "fill:#E8F5E9,stroke:#1FA463,stroke-width:2px,color:#15232E",
        "NNVA": "fill:#FFF8E1,stroke:#C98A12,stroke-width:2px,color:#15232E",
        "NVA":  "fill:#FFEBEE,stroke:#D9503C,stroke-width:2px,color:#15232E",
    }
    return styles.get(vc, "fill:#fff,stroke:#9AA8A8,stroke-width:1px")


def build_mermaid_syntax(process: models.Process, tasks: list[models.Task]) -> str:
    """
    Generate Mermaid flowchart LR syntax for a process and its ordered tasks.

    Example output:
    ```
    flowchart LR
      Start(("Solicitud recibida")) --> Task_01["Recepción de solicitud"]
      Task_01 --> Task_02["Espera de validación"]
      ...
      Task_06 --> End_(("Cuenta activada"))

      style Task_01 fill:#E8F5E9,stroke:#1FA463,...
    ```
    """
    lines = ["flowchart LR"]
    lines.append("")

    trigger = _sanitize_label(process.trigger_event or "Inicio")
    output = _sanitize_label(process.output_result or "Fin")

    # Start event node (double-circle in Mermaid)
    start_id = "Start_"
    end_id = "End_"

    lines.append(f'  {start_id}(("{trigger}"))')

    # Task nodes
    task_ids = []
    for t in tasks:
        tid = t.bpmn_id or f"Task_{t.id}"
        # Sanitize the ID to be Mermaid-safe
        safe_id = re.sub(r'[^a-zA-Z0-9_]', '_', tid)
        task_ids.append(safe_id)
        label = _sanitize_label(t.name or "Tarea")

        # Build label with type info
        type_labels = {
            "user": "👤",
            "manual": "✍️",
            "service": "⚙️",
        }
        type_emoji = type_labels.get(t.task_type, "")
        vc_label = t.value_classification or "VA"

        full_label = f"{type_emoji} {label}\\n{vc_label}"
        lines.append(f'  {safe_id}["{full_label}"]')

    # End event node
    lines.append(f'  {end_id}(("{output}"))')
    lines.append("")

    # Connections
    all_ids = [start_id] + task_ids + [end_id]
    for i in range(len(all_ids) - 1):
        src = all_ids[i]
        tgt = all_ids[i + 1]
        lines.append(f"  {src} --> {tgt}")

    lines.append("")

    # Styles for value classification
    for i, t in enumerate(tasks):
        safe_id = task_ids[i]
        vc = t.value_classification or "VA"
        style = _value_class_style(vc)
        lines.append(f"  style {safe_id} {style}")

    # Start/End styles
    lines.append(f"  style {start_id} fill:#E0F7F7,stroke:#0E9F9F,stroke-width:2px,color:#15232E")
    lines.append(f"  style {end_id} fill:#E8EDF0,stroke:#15232E,stroke-width:3px,color:#15232E")

    return "\n".join(lines) + "\n"


def generate_mermaid(db: Session, process_id: int) -> str:
    """
    Fetch process and tasks from DB and return Mermaid flowchart syntax as string.
    """
    process = db.query(models.Process).filter(models.Process.id == process_id).first()
    if not process:
        raise ValueError(f"Process with id={process_id} not found")

    # Get the default "General" activity
    default_act = db.query(models.Activity).filter(
        models.Activity.process_id == process_id,
        models.Activity.name == "General"
    ).first()

    if not default_act:
        return build_mermaid_syntax(process, [])

    tasks = db.query(models.Task).filter(
        models.Task.activity_id == default_act.id
    ).order_by(models.Task.position_order.asc()).all()

    return build_mermaid_syntax(process, tasks)
