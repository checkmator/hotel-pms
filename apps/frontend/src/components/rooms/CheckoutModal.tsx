'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle, FileText, CreditCard, Printer } from 'lucide-react';
import { InvoicePrintModal } from '@/components/fiscal/InvoicePrintModal';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { reservationsService } from '@/services/rooms.service';
import { formatCurrency } from '@/lib/utils';
import type { Room } from '@/lib/types';

const schema = z.object({
  paymentMethod: z.enum(['cash','credit_card','debit_card','pix','bank_transfer','invoice'] as const),
  discountOverride: z.coerce.number().min(0).optional(),
  notes: z.string().max(200).optional(),
});

type FormData = z.infer<typeof schema>;

const PAYMENT_LABELS: Record<string, string> = {
  cash:          '💵 Dinheiro',
  credit_card:   '💳 Cartão de Crédito',
  debit_card:    '💳 Cartão de Débito',
  pix:           '⚡ PIX',
  bank_transfer: '🏦 Transferência',
  invoice:       '📄 Fatura',
};

interface CheckOutModalProps {
  room: Room;
  onClose: () => void;
}

export function CheckOutModal({ room, onClose }: CheckOutModalProps) {
  const [result, setResult] = useState<{ invoice: { total: string | number }; reservation: { nights: number; id?: string } } | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const reservationId = room.reservations?.[0]?.id;

  const { data: invoicePreview } = useQuery({
    queryKey: ['invoice', reservationId],
    queryFn: () => reservationsService.getInvoice(reservationId!),
    enabled: !!reservationId,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: 'pix' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      reservationsService.checkOut(reservationId!, data),
    onSuccess: (res) => setResult(res.data),
  });

  if (result) {
    return (
      <>
        <Modal open title="Check-out Concluído" onClose={onClose}>
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="h-14 w-14 text-emerald-500" />
            <div className="text-center">
              <p className="font-semibold text-gray-900">Fatura fechada com sucesso!</p>
              <p className="text-sm text-gray-500 mt-1">
                {result.reservation?.nights} noite(s) · Total:{' '}
                <strong className="text-gray-900">{formatCurrency(result.invoice?.total)}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Quarto marcado como Sujo — aguardando limpeza.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="secondary" className="flex-1" onClick={() => setShowPrint(true)}>
                <Printer className="h-4 w-4" /> Imprimir Fatura
              </Button>
              <Button className="flex-1" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        </Modal>
        {showPrint && reservationId && (
          <InvoicePrintModal reservationId={reservationId} onClose={() => setShowPrint(false)} />
        )}
      </>
    );
  }

  const summary = (invoicePreview as { data?: { summary?: { subtotal: number; discount: number; taxes: number; total: number } } })?.data?.summary;

  return (
    <Modal open title={`Check-out — Quarto ${room.number}`} onClose={onClose} size="md">
      <div className="space-y-5">
        {/* Invoice preview */}
        {summary && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 bg-white">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-800">Resumo da Conta</span>
            </div>
            {[
              { label: 'Subtotal',  value: summary.subtotal  },
              { label: 'Desconto',  value: -summary.discount },
              { label: 'ISS (5%)', value: summary.taxes      },
            ].map((row) => (
              <div key={row.label} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-gray-500">{row.label}</span>
                <span className="text-gray-700">{formatCurrency(Math.abs(row.value))}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-blue-50">
              <span className="font-bold text-blue-800">Total</span>
              <span className="font-bold text-blue-800 text-lg">{formatCurrency(summary.total)}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Select {...register('paymentMethod')} id="paymentMethod" label="Forma de Pagamento" error={errors.paymentMethod?.message}>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>

          {mutation.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao realizar check-out.'}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" className="flex-1" loading={mutation.isPending}>
              <CreditCard className="h-4 w-4" />
              Fechar Conta
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
