'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Search, XCircle, CalendarDays, ChevronDown, FileText, Printer } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ReservationStatusBadge } from '@/components/ui/Badge';
import { ReservationForm } from '@/components/reservations/ReservationForm';
import { FiscalNoteModal } from '@/components/fiscal/FiscalNoteModal';
import { InvoicePrintModal } from '@/components/fiscal/InvoicePrintModal';
import { reservationsService, type CreateReservationPayload } from '@/services/reservations.service';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Reservation, ReservationStatus } from '@/lib/types';

const STATUS_FILTERS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'Todas'       },
  { value: 'confirmed',   label: 'Confirmadas' },
  { value: 'checked_in',  label: 'Check-in'   },
  { value: 'pending',     label: 'Pendentes'   },
  { value: 'cancelled',   label: 'Canceladas'  },
  { value: 'checked_out', label: 'Finalizadas' },
];

export default function ReservationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'cancel' | 'fiscal' | 'print' | null>(null);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = { ...(statusFilter !== 'all' && { status: statusFilter }), page, limit: 15 };

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', params],
    queryFn: () => reservationsService.list(params),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateReservationPayload) => reservationsService.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); setModal(null); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => reservationsService.cancel(selected!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); setModal(null); setSelected(null); },
  });

  const totalPages = Math.ceil((data?.meta.total ?? 0) / 15);
  const filtered = search
    ? (data?.data ?? []).filter(r =>
        r.guest.fullName.toLowerCase().includes(search.toLowerCase()) || r.room.number.includes(search)
      )
    : (data?.data ?? []);

  return (
    <div className="flex flex-col h-full">
      <Header title="Reservas" subtitle={`${data?.meta.total ?? 0} reservas`} />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Hóspede ou quarto..."
            />
          </div>
          <Button onClick={() => setModal('create')}>
            <CalendarPlus className="h-4 w-4" />Nova Reserva
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setStatusFilter(f.value as ReservationStatus | 'all'); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <CalendarDays className="h-12 w-12 opacity-30" />
            <p className="font-medium text-gray-600">Nenhuma reserva encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((res) => (
              <div key={res.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{res.guest.fullName}</p>
                      <ReservationStatusBadge status={res.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Quarto {res.room.number} · {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(res.totalAmount)}</p>
                    <p className="text-xs text-gray-400 capitalize">{res.room.type}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {res.status === 'checked_out' && (
                      <>
                        <button onClick={() => { setSelected(res); setModal('print'); }} className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Imprimir fatura">
                          <Printer className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setSelected(res); setModal('fiscal'); }} className="rounded p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors" title="NFS-e">
                          <FileText className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {(res.status === 'confirmed' || res.status === 'pending') && (
                      <button onClick={() => { setSelected(res); setModal('cancel'); }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Cancelar reserva">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => setExpanded(expanded === res.id ? null : res.id)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded === res.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                {expanded === res.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
                    <div><p className="text-gray-400 font-medium">ID</p><p className="font-mono">{res.id.slice(0, 8)}…</p></div>
                    <div><p className="text-gray-400 font-medium">CPF/Passaporte</p><p>{res.guest.cpfPassport}</p></div>
                    <div><p className="text-gray-400 font-medium">Valor base</p><p>{formatCurrency(res.baseAmount)}</p></div>
                    <div><p className="text-gray-400 font-medium">Desconto</p><p>{formatCurrency(res.discount)}</p></div>
                    {res.notes && <div className="col-span-2 sm:col-span-4"><p className="text-gray-400 font-medium">Obs.</p><p>{res.notes}</p></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="flex items-center px-3 text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}
      </div>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Nova Reserva" size="lg">
        {createMutation.isError && (
          <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {(createMutation.error as {response?: {data?: {error?: string}}})?.response?.data?.error ?? 'Erro ao criar reserva.'}
          </p>
        )}
        <ReservationForm onSubmit={(p) => createMutation.mutateAsync(p)} onCancel={() => setModal(null)} loading={createMutation.isPending} />
      </Modal>

      <Modal open={modal === 'cancel'} onClose={() => { setModal(null); setSelected(null); }} title="Cancelar Reserva" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Cancelar reserva de <strong>{selected?.guest.fullName}</strong> no quarto <strong>{selected?.room.number}</strong>?</p>
          {cancelMutation.isError && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {(cancelMutation.error as {response?: {data?: {error?: string}}})?.response?.data?.error ?? 'Erro ao cancelar.'}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setModal(null); setSelected(null); }}>Voltar</Button>
            <Button variant="danger" className="flex-1" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>Cancelar Reserva</Button>
          </div>
        </div>
      </Modal>

      {modal === 'print' && selected && (
        <InvoicePrintModal
          reservationId={selected.id}
          onClose={() => { setModal(null); setSelected(null); }}
        />
      )}

      {modal === 'fiscal' && selected && (
        <FiscalNoteModal
          open
          onClose={() => { setModal(null); setSelected(null); }}
          reservationId={selected.id}
          invoiceId={selected.invoices?.[0]?.id ?? ''}
          guestName={selected.guest.fullName}
          guestDocument={selected.guest.cpfPassport}
          guestEmail={selected.guest.email}
          invoiceTotal={selected.totalAmount}
        />
      )}
    </div>
  );
}
