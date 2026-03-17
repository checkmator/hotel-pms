'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Filter } from 'lucide-react';
import { roomsService } from '@/services/rooms.service';
import { RoomCard } from './RoomCard';
import { CheckInModal } from './CheckInModal';
import { ConsumptionModal } from './ConsumptionModal';
import { CheckOutModal } from './CheckoutModal';
import { Button } from '@/components/ui/Button';
import type { Room, RoomStatus } from '@/lib/types';

const today = () => new Date().toISOString().split('T')[0];
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

type ActiveModal = 'checkin' | 'consumption' | 'checkout' | null;

const STATUS_FILTERS: { value: RoomStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'Todos' },
  { value: 'available',   label: 'Disponível' },
  { value: 'occupied',    label: 'Ocupado' },
  { value: 'dirty',       label: 'Sujo' },
  { value: 'maintenance', label: 'Manutenção' },
];

export function OccupancyGrid() {
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'all'>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const { data: rooms = [], isLoading, refetch } = useQuery({
    queryKey: ['rooms', 'availability'],
    queryFn: () => roomsService.getAvailability(today(), tomorrow()),
    refetchInterval: 60_000,
  });

  const filtered = filterStatus === 'all'
    ? rooms
    : rooms.filter((r) => r.status === filterStatus);

  // Group by floor
  const byFloor = filtered.reduce<Record<number, Room[]>>((acc, room) => {
    (acc[room.floor] ??= []).push(room);
    return acc;
  }, {});

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    if (room.status === 'available') setActiveModal('checkin');
    else if (room.status === 'occupied') setActiveModal('consumption');
    else setActiveModal(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedRoom(null);
    refetch();
  };

  const openCheckout = () => setActiveModal('checkout');

  // Stats
  const stats = {
    total:     rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied:  rooms.filter((r) => r.status === 'occupied').length,
    dirty:     rooms.filter((r) => r.status === 'dirty').length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total',      value: stats.total,     color: 'text-gray-900'   },
          { label: 'Disponível', value: stats.available,  color: 'text-emerald-600' },
          { label: 'Ocupado',    value: stats.occupied,   color: 'text-red-600'    },
          { label: 'Sujos',      value: stats.dirty,      color: 'text-amber-600'  },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value as RoomStatus | 'all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterStatus === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => refetch()}
          loading={isLoading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Grid by floor */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-gray-400">
          Carregando quartos...
        </div>
      ) : (
        Object.entries(byFloor)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([floor, floorRooms]) => (
            <div key={floor}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {floor}º Andar
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {floorRooms.map((room) => (
                  <RoomCard key={room.id} room={room} onClick={handleRoomClick} />
                ))}
              </div>
            </div>
          ))
      )}

      {/* Modals */}
      {selectedRoom && activeModal === 'checkin' && (
        <CheckInModal room={selectedRoom} onClose={closeModal} />
      )}
      {selectedRoom && activeModal === 'consumption' && (
        <ConsumptionModal
          room={selectedRoom}
          onClose={closeModal}
          onCheckout={openCheckout}
        />
      )}
      {selectedRoom && activeModal === 'checkout' && (
        <CheckOutModal room={selectedRoom} onClose={closeModal} />
      )}
    </div>
  );
}
