import { apiMutate } from '../api.js';

// Admite versiones históricas del editor y respaldos generados por el servidor.
// El servidor valida y confirma el cambio completo en una sola transacción.
export function restorationPayload(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.tasks)) {
    throw new Error('La versión no contiene una lista válida de tareas.');
  }
  const tasks = snapshot.tasks.map((task, index) => {
    const value = task.valueClass || task.value_classification || 'VA';
    return {
      bpmn_id: task.bpmnId || task.bpmn_id,
      name: task.name || 'Paso',
      description: task.description || '',
      position_order: task.position_order || index + 1,
      task_type: task.type || task.task_type || 'user',
      value_classification: value,
      waste_type: value === 'NVA' ? (task.wasteType || task.waste_type || 'waiting') : null,
      std_cycle_time_sec: Number(task.cycleTime ?? task.std_cycle_time_sec ?? 0),
      std_wait_time_sec: Number(task.waitTime ?? task.std_wait_time_sec ?? 0),
      responsible: task.responsible || '', accountable: task.accountable || '',
      consulted: task.consulted || '', informed: task.informed || '', systems: task.systems || '',
    };
  });
  const references = new Map(snapshot.tasks.map((task, index) => [String(task.id), tasks[index].bpmn_id]));
  return {
    tasks,
    gateways: snapshot.gateways ?? [],
    sequence_flows: (snapshot.sequence_flows ?? []).map((flow) => ({
      ...flow,
      source_ref: references.get(flow.source_ref) || flow.source_ref,
      target_ref: references.get(flow.target_ref) || flow.target_ref,
      condition_expression: flow.condition_expression || flow.condition || null,
    })),
    layout: snapshot.layout || {},
  };
}

export function optimizedFlowSnapshot(optimizedFlow, createBpmnId) {
  const steps = optimizedFlow.nodes || optimizedFlow.steps || [];
  const refs = new Map();
  const tasks = steps.map((step, index) => {
    const bpmnId = createBpmnId();
    for (const ref of [step.bpmn_id, step.bpmnId, step.id]) {
      if (ref != null) refs.set(String(ref), bpmnId);
    }
    const valueClass = step.value_classification || step.valueClass || 'VA';
    return {
      bpmnId, name: step.name || step.node_name || 'Paso', description: step.description || '',
      position_order: index + 1, type: step.type || step.task_type || 'user', valueClass,
      wasteType: valueClass === 'NVA' ? (step.waste_type || step.wasteType || 'waiting') : null,
      cycleTime: Number(step.cycle_time_sec ?? step.cycleTime ?? 60),
      waitTime: Number(step.wait_time_sec ?? step.waitTime ?? 0),
    };
  });
  return {
    tasks, gateways: [], layout: {},
    sequence_flows: (optimizedFlow.flows || []).map((flow) => ({
      bpmn_id: `Flow_AI_${crypto.randomUUID()}`,
      source_ref: refs.get(String(flow.source_ref)) || flow.source_ref,
      target_ref: refs.get(String(flow.target_ref)) || flow.target_ref,
      name: flow.name || '',
      // La optimización actual entrega pasos, no compuertas de decisión.
      condition_expression: null,
    })),
  };
}

export async function restoreProcessVersion(processId, snapshot, reason = 'restaurar') {
  const response = await apiMutate(`/processes/${processId}/restore`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...restorationPayload(snapshot), reason }),
  });
  return response.json();
}
