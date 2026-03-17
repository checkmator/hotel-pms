import { api } from './api';
import type { FiscalNote } from '@/lib/types';

export interface CreateFiscalNotePayload {
  reservationId: string;
  invoiceId: string;
  prestadorCnpj: string;
  prestadorRazaoSocial: string;
  prestadorIm?: string;
  prestadorMunicipio: string;
  tomadorDocumento: string;
  tomadorNome: string;
  tomadorEmail?: string;
  discriminacao: string;
  codigoServico?: string;
  aliquotaIss?: number;
  valorDeducoes?: number;
}

export const fiscalNoteService = {
  async listByReservation(reservationId: string) {
    const { data } = await api.get<{ data: FiscalNote[] }>(`/reservations/${reservationId}/fiscal-notes`);
    return data.data;
  },

  async create(reservationId: string, payload: Omit<CreateFiscalNotePayload, 'reservationId'>) {
    const { data } = await api.post<{ data: FiscalNote }>(
      `/reservations/${reservationId}/fiscal-notes`,
      { ...payload, reservationId },
    );
    return data.data;
  },

  async emit(id: string) {
    const { data } = await api.post<{ data: FiscalNote }>(`/fiscal-notes/${id}/emit`);
    return data.data;
  },

  async cancel(id: string, motivo: string) {
    const { data } = await api.post<{ data: FiscalNote }>(`/fiscal-notes/${id}/cancel`, { motivo });
    return data.data;
  },

  async remove(id: string) {
    await api.delete(`/fiscal-notes/${id}`);
  },
};
