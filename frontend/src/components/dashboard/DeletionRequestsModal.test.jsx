import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react';
import DeletionRequestsModal from './DeletionRequestsModal.jsx';
import { apiFetch, apiMutate } from '../../api.js';

vi.mock('../../api.js', () => ({ apiFetch: vi.fn(), apiMutate: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const request = { id: 4, process_id: 2, process_code: 'P2', process_name: 'Duplicado', reason: 'Se reemplazó',
  status: 'pending', requester_email: 'usuario@example.com', created_at: '2026-10-08T12:00:00Z' };

async function abrir(isAdmin = true, onDeleted = vi.fn()) {
  apiFetch.mockResolvedValue({ ok: true, json: async () => [request] });
  await act(async () => { render(<DeletionRequestsModal isAdmin={isAdmin} onClose={vi.fn()} onDeleted={onDeleted} />); });
}

describe('Bandeja de solicitudes de eliminación', () => {
  it('muestra el estado al solicitante sin botones de resolución', async () => {
    await abrir(false);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar y eliminar' })).not.toBeInTheDocument();
  });

  it('pide confirmación y retira el proceso después de la aprobación', async () => {
    const deleted = vi.fn();
    apiMutate.mockResolvedValue({ json: async () => ({ ...request, process_id: null, status: 'approved' }) });
    await abrir(true, deleted);
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y eliminar' }));
    expect(apiMutate).not.toHaveBeenCalled();
    const confirmation = screen.getByRole('dialog', { name: 'Eliminar proceso' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Aprobar y eliminar' }));
    await waitFor(() => expect(deleted).toHaveBeenCalledWith(2));
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(JSON.parse(apiMutate.mock.calls[0][1].body).decision).toBe('approved');
  });

  it('rechaza con comentario conservando el proceso', async () => {
    const deleted = vi.fn();
    apiMutate.mockResolvedValue({ json: async () => ({ ...request, status: 'rejected' }) });
    await abrir(true, deleted);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Se necesita conservar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await screen.findByText('Rechazada');
    expect(deleted).not.toHaveBeenCalled();
    expect(JSON.parse(apiMutate.mock.calls[0][1].body)).toEqual({ decision: 'rejected', review_note: 'Se necesita conservar' });
  });

  it('conserva la solicitud pendiente si el servidor rechaza la aprobación', async () => {
    const deleted = vi.fn();
    apiMutate.mockRejectedValue(new Error('No se pudo eliminar'));
    await abrir(true, deleted);
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar');
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(deleted).not.toHaveBeenCalled();
  });
});
