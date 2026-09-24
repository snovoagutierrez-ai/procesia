// Una sola conversión para el editor, restauración y vistas previas.
export function mapBackendTaskToFrontend(t) {
  return {
    id: t.id, bpmnId: t.bpmn_id, name: t.name, description: t.description || '', type: t.task_type,
    cycleTime: Number(t.std_cycle_time_sec) || 0,
    waitTime: Number(t.std_wait_time_sec) || 0,
    valueClass: t.value_classification, wasteType: t.waste_type || '',
    responsible: t.responsible || '', accountable: t.accountable || '',
    consulted: t.consulted || '', informed: t.informed || '',
    systems: t.systems || '', position_order: t.position_order,
  };
}
