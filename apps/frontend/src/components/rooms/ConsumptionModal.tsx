'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, LogOut, Receipt, ShoppingCart } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { reservationsService } from '@/services/rooms.service';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Room, TransactionCategory } from '@/lib/types';

const CATEGORIES: { value: TransactionCategory; label: string; emoji: string }[] = [
  { value: 'minibar',      label: 'Frigobar',       emoji: '🍺' },
  { value: 'restaurant',   label: 'Restaurante',     emoji: '🍽️' },
  { value: 'room_service', label: 'Room Service',    emoji: '🛎️' },
  { value: 'laundry',      label: 'Lavanderia',      emoji: '👕' },
  { value: 'parking',      label: 'Estacionamento',  emoji: '🚗' },
  { value: 'extra',        label: 'Extra',           emoji: '➕' },
];

const schema = z.object({
  reservationId: z.string().uuid('ID de reserva inválido.'),
  category: z.enum(['minibar','laundry','restaurant','room_service','parking','extra'] as const),
  description: z.string().min(3, 'Mínimo 3 caracteres.').max(100),
  amount: z.coerce.number().positive('Valor deve ser positivo.'),
});

type FormData = z.infer<typeof schema>;

interface ConsumptionModalProps {
  room: Room;
  onClose: () => void;
  onCheckout: () => void;
}

export function ConsumptionModal({ room, onClose, onCheckout }: ConsumptionModalProps) {
  const [tab, setTab] = useState<'statement' | 'add'>('statement');
  const reservationId = room.reservations?.[0]?.id;

  const { data: statement, refetch } = useQuery({
    queryKey: ['statement', reservationId],
    queryFn: () => reservationsService.getStatement(reservationId!),
    enabled: !!reservationId,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { reservationId: reservationId ?? '', category: 'minibar' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      reservationsService.postTransaction(data.reservationId, {
        category: data.category,
        description: data.description,
        amount: data.amount,
      }),
    onSuccess: () => {
      reset({ reservationId: reservationId ?? '', category: 'minibar', description: '', amount: 0 });
      refetch();
      setTab('statement');
    },
  });

  return (
    <Modal open title={`Quarto ${room.number} — ${room.reservations?.[0]?.guestName ?? ''}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('statement')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${tab === 'statement' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            <Receipt className="inline h-4 w-4 mr-1.5" />Extrato
          </button>
          <button
            onClick={() => setTab('add')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${tab === 'add' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            <Plus className="inline h-4 w-4 mr-1.5" />Lançar Consumo
          </button>
        </div>

        {tab === 'statement' && (
          <div className="space-y-3">
            {!reservationId ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma reserva ativa.</p>
            ) : statement?.transactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum consumo lançado.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                {statement?.transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 bg-white">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.description}</p>
                      <p className="text-xs text-gray-400">{formatDateTime(t.transactionDate)} · {t.createdBy.name}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(t.amount)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {statement && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 border border-gray-200">
                <span className="text-sm font-semibold text-gray-700">Total em aberto</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(statement.runningTotal)}
                </span>
              </div>
            )}

            {/* Checkout CTA */}
            <Button
              variant="danger"
              className="w-full"
              onClick={() => { onClose(); onCheckout(); }}
            >
              <LogOut className="h-4 w-4" />
              Iniciar Check-out
            </Button>
          </div>
        )}

        {tab === 'add' && (
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <input type="hidden" {...register('reservationId')} />

            <Select {...register('category')} id="category" label="Categoria" error={errors.category?.message}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </Select>

            <Input
              {...register('description')}
              id="description"
              label="Descrição"
              placeholder="Ex: 2x Água mineral 500ml"
              error={errors.description?.message}
            />

            <Input
              {...register('amount')}
              id="amount"
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              error={errors.amount?.message}
            />

            {mutation.error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao lançar consumo.'}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setTab('statement')}>
                Voltar
              </Button>
              <Button type="submit" className="flex-1" loading={mutation.isPending}>
                <ShoppingCart className="h-4 w-4" />
                Lançar
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
