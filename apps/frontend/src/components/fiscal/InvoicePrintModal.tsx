'use client';

import { useQuery } from '@tanstack/react-query';
import { Printer, X, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/lib/utils';
import type { InvoicePreview, InvoiceLineItem } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  daily_rate:   'Diária',
  minibar:      'Frigobar',
  laundry:      'Lavanderia',
  restaurant:   'Restaurante',
  room_service: 'Room Service',
  parking:      'Estacionamento',
  extra:        'Extra',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash:          'Dinheiro',
  credit_card:   'Cartão de Crédito',
  debit_card:    'Cartão de Débito',
  pix:           'PIX',
  bank_transfer: 'Transferência Bancária',
  invoice:       'Fatura',
};

const TYPE_LABELS: Record<string, string> = {
  standard:     'Standard',
  deluxe:       'Deluxe',
  suite:        'Suíte',
  master_suite: 'Suíte Master',
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nights(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

interface InvoicePrintModalProps {
  reservationId: string;
  onClose: () => void;
}

export function InvoicePrintModal({ reservationId, onClose }: InvoicePrintModalProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice-print', reservationId],
    queryFn: async () => {
      const res = await api.get<{ data: InvoicePreview }>(`/reservations/${reservationId}/invoice`);
      return res.data.data;
    },
  });

  const handlePrint = () => window.print();

  return (
    <>
      {/* ── Print-only styles injected inline ── */}
      <style>{`
        @media print {
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print-root { display: block !important; position: static !important; }
          #invoice-print-overlay { display: none !important; }
          #invoice-print-actions { display: none !important; }
          #invoice-print-doc {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div id="invoice-print-root" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Overlay */}
        <div id="invoice-print-overlay" className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          {/* Actions bar */}
          <div id="invoice-print-actions" className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between z-10">
            <p className="text-sm font-semibold text-gray-700">Fatura da Reserva</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando fatura…
            </div>
          )}
          {isError && (
            <div className="py-16 text-center text-sm text-red-500">Erro ao carregar fatura.</div>
          )}
          {data && <InvoiceDoc inv={data} />}
        </div>
      </div>
    </>
  );
}

function InvoiceDoc({ inv }: { inv: InvoicePreview }) {
  const checkIn  = inv.reservation.actualCheckIn  ?? inv.reservation.checkInDate;
  const checkOut = inv.reservation.actualCheckOut ?? inv.reservation.checkOutDate;
  const n = nights(checkIn, checkOut);

  return (
    <div id="invoice-print-doc" className="p-8 space-y-6 text-sm text-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hotel PMS</h1>
          <p className="text-gray-400 text-xs mt-0.5">Sistema de Gestão Hoteleira</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Fatura</p>
          <p className="font-mono text-gray-700 text-xs mt-0.5">{inv.reservation.id.slice(0, 8).toUpperCase()}</p>
          {inv.closedAt && (
            <p className="text-xs text-gray-400 mt-0.5">Emitida em {fmtDateTime(inv.closedAt)}</p>
          )}
        </div>
      </div>

      {/* Guest + Room */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Hóspede</p>
          <p className="font-semibold text-gray-900">{inv.guest.fullName}</p>
          <p className="text-gray-500">CPF/Passaporte: {inv.guest.cpfPassport}</p>
          {inv.guest.email && <p className="text-gray-500">{inv.guest.email}</p>}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Acomodação</p>
          <p className="font-semibold text-gray-900">Quarto {inv.room.number} — {TYPE_LABELS[inv.room.type] ?? inv.room.type}</p>
          <p className="text-gray-500">Check-in: {fmtDate(checkIn)}</p>
          <p className="text-gray-500">Check-out: {fmtDate(checkOut)}</p>
          <p className="text-gray-500">{n} noite{n !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Line items */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Lançamentos</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="text-left py-2 px-3 rounded-tl-lg font-medium">Descrição</th>
              <th className="text-left py-2 px-2 font-medium">Categoria</th>
              <th className="text-left py-2 px-2 font-medium">Data</th>
              <th className="text-right py-2 px-3 rounded-tr-lg font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {inv.lineItems.map((item: InvoiceLineItem, i) => (
              <tr key={item.id ?? i} className="border-b border-gray-50">
                <td className="py-2 px-3 text-gray-800">{item.description}</td>
                <td className="py-2 px-2 text-gray-500">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                <td className="py-2 px-2 text-gray-400 whitespace-nowrap">{fmtDate(item.transactionDate)}</td>
                <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(Number(item.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 border-t border-gray-200 pt-4">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(inv.summary.subtotal)}</span>
          </div>
          {inv.summary.discount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Desconto</span>
              <span>− {formatCurrency(inv.summary.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>ISS (5%)</span>
            <span>{formatCurrency(inv.summary.taxes)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-2">
            <span>Total</span>
            <span>{formatCurrency(inv.summary.total)}</span>
          </div>
          {inv.paymentMethod && (
            <p className="text-xs text-gray-400 text-right pt-1">
              Pagamento: {PAYMENT_LABELS[inv.paymentMethod] ?? inv.paymentMethod}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 pt-4 text-xs text-gray-400 text-center space-y-0.5">
        <p>Documento emitido pelo sistema Hotel PMS — valor sujeito à incidência de ISS conforme LC 116/2003</p>
        <p>Reserva {inv.reservation.id} · Emitido em {fmtDateTime(new Date().toISOString())}</p>
      </div>
    </div>
  );
}
