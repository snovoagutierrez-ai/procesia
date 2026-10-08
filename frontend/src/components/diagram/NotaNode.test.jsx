import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { nodeTypes } from './FlowDiagrams.jsx';

afterEach(cleanup);
const Nota = nodeTypes.notaNode;
function abrir(onEditar) {
  render(<ReactFlowProvider><Nota data={{ kind: 'nota', text: 'Original', nota: { id: 4, text: 'Original' }, onEditar }} /></ReactFlowProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir nota: Original' }));
}

describe('Guardado rápido de notas', () => {
  it('edita sobre el lienzo y guarda pulsando la barra superior', async () => {
    const save = vi.fn().mockResolvedValue({});
    abrir(save);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), { target: { value: 'Nuevo texto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar nota' }));
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(save).toHaveBeenCalledWith({ id: 4, text: 'Original' }, 'Nuevo texto');
  });
  it('conserva el borrador abierto ante un error y permite reintentar', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Error de red')).mockResolvedValueOnce({});
    abrir(save);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de red');
    expect(screen.getByRole('textbox')).toHaveValue('Borrador');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar nota' }));
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });
  it('rechaza un texto vacío y admite Ctrl+Enter', async () => {
    const save = vi.fn().mockResolvedValue({});
    abrir(save);
    fireEvent.click(screen.getByRole('button', { name: 'Editar nota' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar nota' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el texto');
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Atajo' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });
});
