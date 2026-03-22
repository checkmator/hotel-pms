'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, BedDouble, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { roomsService } from '@/services/rooms.service';
import type { RoomWithCount, RoomType, RoomStatus } from '@/lib/types';

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<RoomType, string> = {
  standard:    'Standard',
  deluxe:      'Deluxe',
  suite:       'Suíte',
  master_suite: 'Suíte Master',
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  available:   'Disponível',
  occupied:    'Ocupado',
  dirty:       'Limpeza',
  maintenance: 'Manutenção',
  blocked:     'Bloqueado',
};

const STATUS_COLORS: Record<RoomStatus, string> = {
  available:   'bg-green-100 text-green-700',
  occupied:    'bg-blue-100 text-blue-700',
  dirty:       'bg-yellow-100 text-yellow-700',
  maintenance: 'bg-orange-100 text-orange-700',
  blocked:     'bg-gray-100 text-gray-600',
};

// ── Schema ────────────────────────────────────────────────────────────────────
const roomSchema = z.object({
  number:      z.string().min(1, 'Obrigatório.').max(10),
  type:        z.enum(['standard', 'deluxe', 'suite', 'master_suite'] as const),
  floor:       z.coerce.number().int().min(0, 'Mínimo 0.'),
  capacity:    z.coerce.number().int().min(1).max(20).default(2),
  basePrice:   z.coerce.number().positive('Deve ser positivo.'),
  description: z.string().max(500).optional(),
});

type RoomForm = z.infer<typeof roomSchema>;

// ── Room Form Modal ───────────────────────────────────────────────────────────
function RoomModal({ room, onClose }: { room?: RoomWithCount; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!room;

  const { register, handleSubmit, formState: { errors } } = useForm<RoomForm>({
    resolver: zodResolver(roomSchema) as never,
    defaultValues: {
      number:      room?.number      ?? '',
      type:        room?.type        ?? 'standard',
      floor:       room?.floor       ?? 1,
      capacity:    room?.capacity    ?? 2,
      basePrice:   room ? Number(room.basePrice) : undefined,
      description: room?.description ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: RoomForm) =>
      isEdit
        ? roomsService.update(room!.id, data)
        : roomsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); onClose(); },
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? `Editar Quarto ${room!.number}` : 'Novo Quarto'}>
      <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input {...register('number')}   id="number"   label="Número *"       placeholder="101"  error={errors.number?.message} />
          <Input {...register('floor')}    id="floor"    label="Andar *"         type="number" placeholder="1" error={errors.floor?.message} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipo *</label>
            <select {...register('type')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Input {...register('capacity')} id="capacity" label="Capacidade *"   type="number" placeholder="2" error={errors.capacity?.message} />
          <div className="col-span-2">
            <Input {...register('basePrice')} id="basePrice" label="Diária (R$) *" type="number" step="0.01" placeholder="250.00" error={errors.basePrice?.message} />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Descrição</label>
            <textarea {...register('description')} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              placeholder="Varanda, vista para o mar, etc." />
          </div>
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao salvar.'}</p>
        )}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending}>{isEdit ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RoomsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<RoomWithCount | null>(null);
  const [deleting,     setDeleting]     = useState<RoomWithCount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', filterStatus, filterType],
    queryFn: () => roomsService.list({
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterType   ? { type:   filterType   } : {}),
      limit: 100,
    }),
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (id) => { await roomsService.remove(id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); setDeleting(null); },
  });

  const rooms = data?.data ?? [];
  const total = data?.meta.total ?? 0;

  // Stats bar
  const statusCounts = rooms.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full">
      <Header title="Quartos" subtitle={`${total} quartos cadastrados`} />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {/* Stats chips */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_LABELS).map(([s, label]) => (
            <div key={s} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[s as RoomStatus]}`}>
              {label}: {statusCounts[s] ?? 0}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Todos os tipos</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="ml-auto">
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Novo Quarto
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Quarto', 'Tipo', 'Andar', 'Capacidade', 'Diária', 'Status', 'Reservas', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Carregando...</td></tr>
              )}
              {!isLoading && rooms.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Nenhum quarto encontrado.</td></tr>
              )}
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <BedDouble className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-gray-900">{room.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{TYPE_LABELS[room.type]}</td>
                  <td className="px-4 py-3 text-gray-500">{room.floor}º</td>
                  <td className="px-4 py-3 text-gray-500">{room.capacity} pax</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {Number(room.basePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[room.status]}`}>
                      {STATUS_LABELS[room.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{room._count.reservations}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(room)} title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleting(room)} title="Excluir"
                        disabled={room._count.reservations > 0}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {modalOpen && <RoomModal onClose={() => setModalOpen(false)} />}

      {/* Edit modal */}
      {editing && <RoomModal room={editing} onClose={() => setEditing(null)} />}

      {/* Delete confirmation */}
      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Confirmar Exclusão">
          <p className="text-sm text-gray-600 mb-4">
            Tem certeza que deseja excluir o Quarto <strong>{deleting.number}</strong>? Esta ação é irreversível.
          </p>
          {deleteMutation.isError && (
            <p className="text-sm text-red-600 mb-3">
              {(deleteMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao excluir.'}
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500/20"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleting.id)}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
