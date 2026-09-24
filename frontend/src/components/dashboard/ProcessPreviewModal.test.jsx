import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ProcessPreviewModal from './ProcessPreviewModal.jsx';
import { apiFetch } from '../../api.js';

vi.mock('../../api.js', () => ({ apiFetch: vi.fn() }));
vi.mock('../diagram/FlowDiagrams.jsx', () => ({
  FlowDiagram: (props) => <div data-testid="flow">{JSON.stringify(props)}</div>,
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const process = { id: 1, name: 'Proceso', code: 'P1', layout_json: {} };
const saved = { ...process, layout_json: { 'task-4': { x: 600, y: 300 } } };
const graph = { gateways: [], sequence_flows: [{ bpmn_id: 'F', source_ref: 'start', target_ref: 'T' }] };
function respond(path) {
  const data = path.endsWith('/tasks') ? [{ id: 4, bpmn_id: 'T', name: 'Paso', systems: 'ERP' }]
    : path.endsWith('/graph') ? graph
    : path.endsWith('/notes') ? [{ id: 2, text: 'Aviso' }] : saved;
  return Promise.resolve({ ok: true, json: async () => data });
}

describe('Vista previa del macroproceso', () => {
  it('carga el flujo completo y la disposición actual, no la ficha antigua del listado', async () => {
    apiFetch.mockImplementation(respond);
    render(<ProcessPreviewModal process={process} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    const flow = JSON.parse((await screen.findByTestId('flow')).textContent);
    expect(flow.proc.layout_json).toEqual(saved.layout_json);
    expect(flow.tasks[0]).toMatchObject({ bpmnId: 'T', systems: 'ERP' });
    expect(flow.sequenceFlows).toEqual(graph.sequence_flows);
    expect(flow.notas).toEqual([{ id: 2, text: 'Aviso' }]);
    expect(flow.readOnly).toBe(true);
    expect(flow.height).toBe('100%');
  });

  it('muestra un fallo real y permite reintentar sin decir que no hay tareas', async () => {
    apiFetch.mockResolvedValue({ ok: false });
    render(<ProcessPreviewModal process={process} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.queryByText(/no tiene un flujo/)).not.toBeInTheDocument();
    apiFetch.mockImplementation(respond);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('flow')).toBeInTheDocument();
  });

  it('muestra conexiones y compuertas aunque el proceso no tenga tareas', async () => {
    apiFetch.mockImplementation(path => path.endsWith('/tasks')
      ? Promise.resolve({ ok: true, json: async () => [] }) : respond(path));
    render(<ProcessPreviewModal process={process} onClose={vi.fn()} onEdit={vi.fn()} />);
    expect(await screen.findByTestId('flow')).toBeInTheDocument();
  });

  it('descarta respuestas tardías de otro proceso', async () => {
    let finish;
    const delayed = new Promise(resolve => { finish = resolve; });
    apiFetch.mockImplementation(path => path.startsWith('/processes/1') ? delayed : respond(path));
    const { rerender } = render(<ProcessPreviewModal process={process} onClose={vi.fn()} onEdit={vi.fn()} />);
    rerender(<ProcessPreviewModal process={{ ...process, id: 2 }} onClose={vi.fn()} onEdit={vi.fn()} />);
    await screen.findByTestId('flow');
    finish({ ok: true, json: async () => [] });
    await waitFor(() => expect(JSON.parse(screen.getByTestId('flow').textContent).tasks[0].bpmnId).toBe('T'));
  });
});
