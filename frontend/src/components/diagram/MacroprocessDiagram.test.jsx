import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import MacroprocessDiagram from './MacroprocessDiagram.jsx';
import { apiFetch, apiMutate } from '../../api.js';

vi.mock('../../api.js', () => ({ apiFetch: vi.fn(), apiMutate: vi.fn() }));
vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  const empty = () => null;
  return {
    ReactFlow: ({ nodes, edges, nodeTypes, onConnect, onEdgesChange }) => <div>
      <button onClick={() => onConnect({ source: '1', target: '2' })}>Conectar</button>
      <button onClick={() => onEdgesChange(edges.map(edge => ({ type: 'remove', id: edge.id })))}>Borrar seleccionadas</button>
      {edges.map(edge => <button key={edge.id} onClick={() => edge.data?.onDelete(edge.id)}>Eliminar conexión {edge.id}</button>)}
      {nodes.map(node => React.createElement(nodeTypes[node.type], { key: node.id, data: node.data }))}
      <span data-testid="edge-count">{edges.length}</span>
    </div>,
    useNodesState: (initial) => { const [value, setValue] = React.useState(initial); return [value, setValue, empty]; },
    useEdgesState: (initial) => { const [value, setValue] = React.useState(initial); return [value, setValue, empty]; },
    addEdge: (edge, edges) => [...edges, { ...edge, id: 'new-edge' }],
    applyEdgeChanges: (changes, edges) => edges.filter(edge => !changes.some(c => c.type === 'remove' && c.id === edge.id)),
    MarkerType: { ArrowClosed: 'arrowclosed' }, Position: { Left: 'left', Right: 'right' },
    Controls: empty, MiniMap: empty, Background: empty, Handle: empty,
  };
});

const processes = [{ id: 1, code: 'P1', name: 'Primero' }, { id: 2, code: 'P2', name: 'Segundo' }];
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Guardado del diagrama de macroprocesos', () => {
  it('mantiene un borrado rápido mientras termina el guardado anterior', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [] }) });
    let finishFirst;
    apiMutate.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce({ json: async () => ({ sequence_flows: [] }) });
    let rendered;
    await act(async () => { rendered = render(<MacroprocessDiagram macroprocessId={1} processes={processes} />); });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    await waitFor(() => expect(apiMutate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar conexión new-edge' }));
    rendered.rerender(<MacroprocessDiagram macroprocessId={1} processes={[...processes]} />);
    expect(screen.getByTestId('edge-count')).toHaveTextContent('0');
    await act(async () => { finishFirst({ json: async () => ({ sequence_flows: [{ id: 7, source_ref: '1', target_ref: '2' }] }) }); });
    await waitFor(() => expect(apiMutate).toHaveBeenCalledTimes(2));
    expect(JSON.parse(apiMutate.mock.calls[1][1].body).sequence_flows).toEqual([]);
    expect(screen.getByTestId('edge-count')).toHaveTextContent('0');
  });
  it('borra la conexión desde su botón y persiste el grafo vacío', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [{ id: 7, source_ref: '1', target_ref: '2' }] }) });
    apiMutate.mockResolvedValue({ json: async () => ({ sequence_flows: [] }) });
    await act(async () => { render(<MacroprocessDiagram macroprocessId={1} processes={processes} />); });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar conexión 7' }));
    await waitFor(() => expect(screen.getByTestId('edge-count')).toHaveTextContent('0'));
    expect(JSON.parse(apiMutate.mock.calls[0][1].body).sequence_flows).toEqual([]);
  });

  it('restaura una conexión si falla el borrado por teclado', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [{ id: 7, source_ref: '1', target_ref: '2' }] }) });
    apiMutate.mockRejectedValue(new Error('Sin permiso'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { render(<MacroprocessDiagram macroprocessId={1} processes={processes} />); });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar seleccionadas' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardaron');
    await waitFor(() => expect(screen.getByTestId('edge-count')).toHaveTextContent('1'));
    log.mockRestore();
  });

  it('solicita la eliminación desde la tarjeta sin retirar el proceso', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [] }) });
    const solicitar = vi.fn();
    render(<MacroprocessDiagram macroprocessId={1} processes={processes} onDeleteProcess={solicitar} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar eliminación de Primero' }));
    expect(solicitar).toHaveBeenCalledWith(1);
    expect(screen.getByText('Primero')).toBeInTheDocument();
    expect(apiMutate).not.toHaveBeenCalled();
  });
  it('revierte una conexión optimista y avisa si el servidor rechaza el PUT', async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ sequence_flows: [] }) });
    apiMutate.mockRejectedValue(new Error('Permiso denegado'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { render(<MacroprocessDiagram macroprocessId={1} processes={processes} />); });
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
    await act(async () => { render(<MacroprocessDiagram macroprocessId={1} processes={processes} />); });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    await waitFor(() => expect(screen.getByTestId('edge-count')).toHaveTextContent('1'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
