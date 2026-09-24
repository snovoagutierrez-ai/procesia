import { describe, it, expect, vi } from 'vitest';
import { restorationPayload, restoreProcessVersion, optimizedFlowSnapshot } from './processRestoration.js';
import { apiMutate } from '../api.js';

vi.mock('../api.js', () => ({ apiMutate: vi.fn() }));

describe('Restauración transaccional', () => {
  it('convierte versiones históricas sin perder RACI, ramas ni posiciones', () => {
    const result = restorationPayload({
      tasks: [{ id: 20, bpmnId: 'Task_A', name: 'A', cycleTime: 60, valueClass: 'NVA',
                wasteType: 'waiting', responsible: 'Analista', systems: 'ERP' }],
      gateways: [{ bpmn_id: 'G', node_type: 'exclusiveGateway' }],
      sequence_flows: [{ bpmn_id: 'F', source_ref: 'G', target_ref: '20', condition: 'Sí',
                         branch_probability: 40, source_handle: 'bottom' }],
      layout: { 'task:Task_A': { x: 20, y: 40 } },
    });
    expect(result.tasks[0]).toMatchObject({ bpmn_id: 'Task_A', std_cycle_time_sec: 60,
      waste_type: 'waiting', responsible: 'Analista', systems: 'ERP' });
    expect(result.sequence_flows[0]).toMatchObject({ target_ref: 'Task_A', condition_expression: 'Sí',
      branch_probability: 40, source_handle: 'bottom' });
    expect(result.layout['task:Task_A']).toEqual({ x: 20, y: 40 });
  });

  it('admite los respaldos del servidor y procesos vacíos explícitos', () => {
    expect(restorationPayload({ tasks: [{ bpmn_id: 'A', name: 'A', std_cycle_time_sec: '30' }] })
      .tasks[0].std_cycle_time_sec).toBe(30);
    expect(restorationPayload({ tasks: [] }).tasks).toEqual([]);
    expect(() => restorationPayload({})).toThrow('lista válida');
  });

  it('envía una sola petición de restauración y propaga el rechazo del servidor', async () => {
    apiMutate.mockResolvedValueOnce({ json: async () => ({ tasks: [] }) });
    expect(await restoreProcessVersion(7, { tasks: [] })).toEqual({ tasks: [] });
    expect(apiMutate).toHaveBeenCalledWith('/processes/7/restore', expect.objectContaining({ method: 'POST' }));
    expect(apiMutate).toHaveBeenCalledTimes(1);
    apiMutate.mockRejectedValueOnce(new Error('No autorizado'));
    await expect(restoreProcessVersion(7, { tasks: [] })).rejects.toThrow('No autorizado');
  });

  it('convierte una propuesta IA en un flujo nuevo y conserva todas sus conexiones', () => {
    let next = 0;
    const snapshot = optimizedFlowSnapshot({
      nodes: [{ bpmn_id: 'AI1', name: 'Revisar', value_classification: 'NVA', waste_type: 'waiting' },
        { bpmn_id: 'AI2', name: 'Aprobar', cycle_time_sec: 90 }],
      flows: [{ source_ref: 'start', target_ref: 'AI1' },
        { source_ref: 'AI1', target_ref: 'AI2', condition: 'Sí' },
        { source_ref: 'AI2', target_ref: 'end' }],
    }, () => `Task_new_${++next}`);
    expect(snapshot.tasks.map(task => task.bpmnId)).toEqual(['Task_new_1', 'Task_new_2']);
    expect(snapshot.sequence_flows.map(flow => [flow.source_ref, flow.target_ref])).toEqual([
      ['start', 'Task_new_1'], ['Task_new_1', 'Task_new_2'], ['Task_new_2', 'end'],
    ]);
    expect(snapshot.sequence_flows[1].condition_expression).toBeNull();
    expect(restorationPayload(snapshot).tasks[0].waste_type).toBe('waiting');
  });
});
