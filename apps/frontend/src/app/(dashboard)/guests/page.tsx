'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Search, Pencil, Trash2, Users, Phone, Mail, ClipboardList } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { GuestForm, type GuestFormData } from '@/components/guests/GuestForm';
import { guestsService, type GuestWithCount } from '@/services/guests.service';
import type { Guest } from '@/lib/types';

export default function GuestsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<GuestWithCount | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['guests', search, page],
    queryFn: () => guestsService.list({ search, page, limit: 15 }),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (d: GuestFormData) => guestsService.create(d as Omit<Guest, 'id'>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); setModal(null); },
  });

  const updateMutation = useMutation({
    mutationFn: (d: GuestFormData) => guestsService.update(selected!.id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); setModal(null); setSelected(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => guestsService.remove(selected!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guests'] }); setModal(null); setSelected(null); },
  });

  const totalPages = Math.ceil((data?.meta.total ?? 0) / 15);

  return (
    <div className="flex flex-col h-full">
      <Header title="Hóspedes" subtitle={`${data?.meta.total ?? 0} cadastrados`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Buscar por nome, CPF ou e-mail..."
            />
          </div>
          <Button onClick={() => setModal('create')}>
            <UserPlus className="h-4 w-4" />Novo Hóspede
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Carregando...</div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Users className="h-12 w-12 opacity-30" />
            <p className="font-medium text-gray-600">{search ? 'Nenhum resultado.' : 'Nenhum hóspede cadastrado.'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3 text-left">Hóspede</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Contato</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">CPF / Passaporte</th>
                  <th className="px-4 py-3 text-center hidden lg:table-cell">Estadias</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.data.map((guest) => (
                  <tr key={guest.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{guest.fullName}</p>
                      <p className="text-xs text-gray-400">{guest.nationality ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5 text-xs text-gray-500">
                        {guest.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{guest.email}</p>}
                        {guest.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{guest.phone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-xs text-gray-600">{guest.cpfPassport}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <ClipboardList className="h-3.5 w-3.5" />{guest._count.reservations}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelected(guest); setModal('edit'); }} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setSelected(guest); setModal('delete'); }} disabled={guest._count.reservations > 0} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
                <p>{data?.meta.total} hóspedes</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <span className="flex items-center px-2">{page} / {totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Novo Hóspede" size="lg">
        {createMutation.isError && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{(createMutation.error as {response?: {data?: {error?: string}}})?.response?.data?.error ?? 'Erro ao cadastrar.'}</p>}
        <GuestForm onSubmit={(d) => createMutation.mutateAsync(d)} onCancel={() => setModal(null)} loading={createMutation.isPending} />
      </Modal>

      <Modal open={modal === 'edit'} onClose={() => { setModal(null); setSelected(null); }} title="Editar Hóspede" size="lg">
        {updateMutation.isError && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{(updateMutation.error as {response?: {data?: {error?: string}}})?.response?.data?.error ?? 'Erro ao atualizar.'}</p>}
        {selected && <GuestForm defaultValues={selected} onSubmit={(d) => updateMutation.mutateAsync(d)} onCancel={() => { setModal(null); setSelected(null); }} loading={updateMutation.isPending} />}
      </Modal>

      <Modal open={modal === 'delete'} onClose={() => { setModal(null); setSelected(null); }} title="Excluir Hóspede" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Deseja excluir <strong>{selected?.fullName}</strong>? Esta ação não pode ser desfeita.</p>
          {deleteMutation.isError && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{(deleteMutation.error as {response?: {data?: {error?: string}}})?.response?.data?.error ?? 'Erro ao excluir.'}</p>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setModal(null); setSelected(null); }}>Cancelar</Button>
            <Button variant="danger" className="flex-1" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
