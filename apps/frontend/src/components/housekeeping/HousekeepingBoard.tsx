'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Wrench, RefreshCw, BedDouble } from 'lucide-react';
import { roomsService } from '@/services/rooms.service';
import { Button } from '@/components/ui/Button';
import { RoomStatusBadge } from '@/components/ui/Badge';
import type { Room } from '@/lib/types';

function RoomActionCard({ room }: { room: Room }) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (status: 'available' | 'maintenance') =>
      roomsService.updateStatus(room.id, status, `Atualizado via painel de governança`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['housekeeping'] }),
  });

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{room.number}</p>
          <p className="text-xs text-gray-500 mt-0.5">{room.floor}º andar</p>
        </div>
        <RoomStatusBadge status={room.status} />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => mutation.mutate('available')}
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Limpo
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          onClick={() => mutation.mutate('maintenance')}
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          <Wrench className="h-3.5 w-3.5" />
          Manutenção
        </Button>
      </div>
    </div>
  );
}

export function HousekeepingBoard() {
  const { data: rooms = [], isLoading, refetch } = useQuery<Room[]>({
    queryKey: ['housekeeping'],
    queryFn: () => roomsService.getHousekeeping(),
    refetchInterval: 30_000,
  });

  const dirty = rooms.filter((r) => r.status === 'dirty');
  const maintenance = rooms.filter((r) => r.status === 'maintenance');

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-2xl font-bold text-amber-700">{dirty.length}</p>
          <p className="text-xs text-amber-600">Quartos sujos</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-2xl font-bold text-gray-700">{maintenance.length}</p>
          <p className="text-xs text-gray-500">Em manutenção</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Toque em um quarto para atualizar o status.</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isLoading}>
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Carregando...</div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
          <BedDouble className="h-12 w-12 opacity-30" />
          <p className="font-medium">Tudo limpo!</p>
          <p className="text-sm">Nenhum quarto aguardando limpeza.</p>
        </div>
      ) : (
        <>
          {dirty.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-500">
                Aguardando Limpeza ({dirty.length})
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {dirty.map((room) => <RoomActionCard key={room.id} room={room} />)}
              </div>
            </div>
          )}

          {maintenance.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Em Manutenção ({maintenance.length})
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {maintenance.map((room) => <RoomActionCard key={room.id} room={room} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
