import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import MacroprocessDiagram from './MacroprocessDiagram.jsx';
import { apiFetch, apiMutate } from '../../api.js';

vi.mock('../../api.js', () => ({ apiFetch: vi.fn(), apiMutate: vi.fn() }));
vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  const empty = () => null;
  return {
    ReactFlow: ({ edges, onConnect }) => <div>
      <button onClick={() => onConnect({ source: '1', target: '2' })}>Conectar</button>
      <span data-testid="edge-count">{edges.length}</span>
    </div>,
    useNodesState: (initial) => { const [value, setValue] = React.useState(initial); return [value, setValue, empty]; },
    useEdgesState: (initial) => { const [value, setValue] = React.useState(initial); return [value, setValue, empty]; },
    addEdge: (edge, edges) => [...edges, { ...edge, id: 'new-edge' }],
    MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
    Controls: empty, MiniMap: empty, Background: empty, Handle: empty,
  };
});

const processes = [{ id: 1, code: 'P1', name: 'Primero' }, { id: 2, code: 'P2', name: 'Segundo' }];
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Guardado del diagrama de macroprocesos', () => {
  it('revierte una conexión optimista y avisa si el servidor rechaza el PUT', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [] }) });
    apiMutate.mockRejectedValue(new Error('Permiso denegado'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MacroprocessDiagram macroprocessId={1} processes={processes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardaron las conexiones');
    await waitFor(() => expect(screen.getByTestId('edge-count')).toHaveTextContent('0'));
    expect(apiMutate).toHaveBeenCalledWith('/macroprocesses/1/graph', expect.objectContaining({ method: 'PUT' }));
    log.mockRestore();
  });

  it('muestra la conexión confirmada por el servidor', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [] }) });
    apiMutate.mockResolvedValue({ json: async () => ({ sequence_flows: [
      { id: '7', source_ref: '1', target_ref: '2' },
    ] }) });
    render(<MacroprocessDiagram macroprocessId={1} processes={processes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    await waitFor(() => expect(screen.getByTestId('edge-count')).toHaveTextContent('1'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
