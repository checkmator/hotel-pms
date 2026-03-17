'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle, User, Calendar, Search, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ReservationStatusBadge } from '@/components/ui/Badge';
import type { Room, Reservation } from '@/lib/types';

interface CheckInModalProps {
  room: Room;
  onClose: () => void;
}

export function CheckInModal({ room, onClose }: CheckInModalProps) {
  const [step, setStep] = useState<'search' | 'confirm' | 'success'>('search');
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Search reservations for this room that are confirmed/pending
  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ['reservations', 'checkin', room.id, guestSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ roomId: room.id, limit: '10' });
      if (guestSearch.length >= 2) params.set('search', guestSearch);
      const { data } = await api.get(`/reservations?${params}&status=confirmed&status=pending`);
      // Filter manually for guest name search since API filters by status only
      const all: Reservation[] = data.data;
      if (guestSearch.length >= 2) {
        return all.filter(r =>
          r.guest.fullName.toLowerCase().includes(guestSearch.toLowerCase()) ||
          r.guest.cpfPassport.includes(guestSearch)
        );
      }
      return all;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/reservations/${selectedReservation!.id}/check-in`);
      return res.data;
    },
    onSuccess: () => setStep('success'),
  });

  if (step === 'success') {
    return (
      <Modal open title="Check-in Realizado" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle className="h-14 w-14 text-emerald-500" />
          <div className="text-center">
            <p className="font-semibold text-gray-900">Check-in realizado com sucesso!</p>
            <p className="text-sm text-gray-500 mt-1">
              {selectedReservation?.guest.fullName} · Quarto {room.number}
            </p>
          </div>
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </div>
      </Modal>
    );
  }

  if (step === 'confirm' && selectedReservation) {
    return (
      <Modal open title={`Confirmar Check-in — Quarto ${room.number}`} onClose={onClose}>
        <div className="space-y-5">
          {/* Guest card */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {selectedReservation.guest.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedReservation.guest.fullName}</p>
                <p className="text-xs text-gray-500">{selectedReservation.guest.cpfPassport}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-blue-200">
              <div><p className="text-gray-400">Entrada</p><p className="font-medium">{formatDate(selectedReservation.checkInDate)}</p></div>
              <div><p className="text-gray-400">Saída</p><p className="font-medium">{formatDate(selectedReservation.checkOutDate)}</p></div>
              <div><p className="text-gray-400">Total</p><p className="font-medium">{formatCurrency(selectedReservation.totalAmount)}</p></div>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao realizar check-in.'}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep('search')}>Voltar</Button>
            <Button className="flex-1" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              <Calendar className="h-4 w-4" />
              Fazer Check-in
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // Step: search
  return (
    <Modal open title={`Check-in — Quarto ${room.number}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Room info */}
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
          <User className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Quarto {room.number}</p>
            <p className="text-xs text-gray-500">{room.type} · {formatCurrency(room.basePrice)}/noite</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={guestSearch}
            onChange={(e) => setGuestSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Buscar por nome ou CPF do hóspede..."
          />
        </div>

        {/* Reservations list */}
        {isLoading ? (
          <p className="text-center text-sm text-gray-400 py-4">Buscando...</p>
        ) : reservations.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4">
            {guestSearch ? 'Nenhuma reserva encontrada para este hóspede.' : 'Nenhuma reserva confirmada para este quarto.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {reservations.map((res) => (
              <button
                key={res.id}
                onClick={() => { setSelectedReservation(res); setStep('confirm'); }}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{res.guest.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)} · {formatCurrency(res.totalAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <ReservationStatusBadge status={res.status} />
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        )}

        <Button variant="secondary" className="w-full" onClick={onClose}>Cancelar</Button>
      </div>
    </Modal>
  );
}
