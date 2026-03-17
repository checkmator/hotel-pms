'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { User, BedDouble, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GuestSearchModal } from '@/components/guests/GuestSearchModal';
import { GuestForm, type GuestFormData } from '@/components/guests/GuestForm';
import { Modal } from '@/components/ui/Modal';
import { roomsService } from '@/services/rooms.service';
import { guestsService } from '@/services/guests.service';
import { formatCurrency } from '@/lib/utils';
import type { Guest } from '@/lib/types';
import type { CreateReservationPayload } from '@/services/reservations.service';

const today = new Date().toISOString().split('T')[0];

const schema = z.object({
  checkInDate:  z.string().date('Data inválida.'),
  checkOutDate: z.string().date('Data inválida.'),
  roomId:       z.string().uuid('Selecione um quarto.'),
  discount:     z.coerce.number().min(0).default(0),
  notes:        z.string().max(500).optional(),
}).refine((d) => d.checkOutDate > d.checkInDate, {
  message: 'Check-out deve ser após check-in.',
  path: ['checkOutDate'],
});

interface FormData {
  checkInDate: string;
  checkOutDate: string;
  roomId: string;
  discount: number;
  notes?: string;
}

interface ReservationFormProps {
  onSubmit: (payload: CreateReservationPayload) => Promise<unknown>;
  onCancel: () => void;
  loading?: boolean;
}

export function ReservationForm({ onSubmit, onCancel, loading }: ReservationFormProps) {
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestModal, setGuestModal] = useState<'search' | 'create' | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { checkInDate: today, checkOutDate: '', discount: 0 },
  });

  const checkIn  = watch('checkInDate');
  const checkOut = watch('checkOutDate');
  const roomId   = watch('roomId');
  const discount = watch('discount');

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', 'availability', checkIn, checkOut],
    queryFn: () => roomsService.getAvailability(checkIn, checkOut),
    enabled: !!checkIn && !!checkOut && checkOut > checkIn,
  });

  const selectedRoom = rooms.find((r) => r.id === roomId);

  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
    : 0;

  const baseAmount  = selectedRoom ? Number(selectedRoom.basePrice) * nights : 0;
  const totalAmount = Math.max(baseAmount - Number(discount || 0), 0);

  const handleCreateGuest = async (d: GuestFormData) => {
    const guest = await guestsService.create(d as Omit<Guest, 'id'>);
    setSelectedGuest(guest);
    setGuestModal(null);
  };

  const handleFormSubmit = async (data: FormData) => {
    if (!selectedGuest) return;
    await onSubmit({ ...data, guestId: selectedGuest.id });
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
        {/* Guest selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Hóspede *</label>
          {selectedGuest ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedGuest.fullName}</p>
                  <p className="text-xs text-gray-500">{selectedGuest.cpfPassport}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedGuest(null)} className="text-xs text-gray-400 hover:text-gray-600">Trocar</button>
            </div>
          ) : (
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => setGuestModal('search')}>
              <User className="h-4 w-4" />
              Selecionar ou cadastrar hóspede...
            </Button>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Input {...register('checkInDate')} id="checkInDate" label="Check-in *" type="date" min={today} error={errors.checkInDate?.message} />
          <Input {...register('checkOutDate')} id="checkOutDate" label="Check-out *" type="date" min={checkIn || today} error={errors.checkOutDate?.message} />
        </div>

        {/* Room selector */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Quarto *</label>
          {!checkIn || !checkOut || checkOut <= checkIn ? (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">Selecione as datas primeiro para ver quartos disponíveis.</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">Nenhum quarto disponível nesse período.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {rooms.filter(r => r.isAvailable).map((room) => (
                <label key={room.id} className={`flex cursor-pointer rounded-lg border-2 p-2.5 transition-colors ${roomId === room.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <input type="radio" value={room.id} {...register('roomId')} className="sr-only" />
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Nº {room.number}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(room.basePrice)}/noite</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {errors.roomId && <p className="text-xs text-red-600 mt-1">{errors.roomId.message}</p>}
        </div>

        {/* Discount + summary */}
        {selectedRoom && nights > 0 && (
          <>
            <Input {...register('discount')} id="discount" label="Desconto (R$)" type="number" min="0" step="0.01" error={errors.discount?.message} />
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1"><Calculator className="h-3.5 w-3.5" />{nights} noite(s) × {formatCurrency(selectedRoom.basePrice)}</span>
                <span>{formatCurrency(baseAmount)}</span>
              </div>
              {Number(discount) > 0 && <div className="flex justify-between text-gray-500"><span>Desconto</span><span>− {formatCurrency(discount)}</span></div>}
              <div className="flex justify-between font-bold text-blue-800 pt-1 border-t border-blue-200"><span>Total</span><span>{formatCurrency(totalAmount)}</span></div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <textarea {...register('notes')} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" placeholder="Pedidos especiais, aniversário, etc." />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={loading} disabled={!selectedGuest}>Criar Reserva</Button>
        </div>
      </form>

      <GuestSearchModal
        open={guestModal === 'search'}
        onClose={() => setGuestModal(null)}
        onSelect={(g) => { setSelectedGuest(g); setGuestModal(null); }}
        onCreateNew={() => setGuestModal('create')}
      />

      <Modal open={guestModal === 'create'} onClose={() => setGuestModal('search')} title="Novo Hóspede" size="lg">
        <GuestForm onSubmit={handleCreateGuest} onCancel={() => setGuestModal('search')} />
      </Modal>
    </>
  );
}
