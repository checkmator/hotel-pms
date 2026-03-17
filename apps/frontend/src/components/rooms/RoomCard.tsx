import { Users, DollarSign, BedDouble } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { RoomStatusBadge } from '@/components/ui/Badge';
import type { Room, RoomStatus } from '@/lib/types';

const STATUS_COLORS: Record<RoomStatus, string> = {
  available:   'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100',
  occupied:    'border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100',
  dirty:       'border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100',
  maintenance: 'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
  blocked:     'border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100',
};

const TYPE_LABELS: Record<string, string> = {
  standard:     'Standard',
  deluxe:       'Deluxe',
  suite:        'Suíte',
  master_suite: 'Master Suíte',
};

interface RoomCardProps {
  room: Room;
  onClick: (room: Room) => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  const activeReservation = room.reservations?.[0];

  return (
    <button
      onClick={() => onClick(room)}
      className={cn(
        'w-full rounded-xl border-2 p-4 text-left transition-all duration-150 cursor-pointer',
        STATUS_COLORS[room.status],
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xl font-bold text-gray-900 leading-none">{room.number}</p>
          <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[room.type]}</p>
        </div>
        <RoomStatusBadge status={room.status} />
      </div>

      {/* Guest info if occupied */}
      {activeReservation && (
        <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-xs">
          <p className="font-semibold text-gray-800 truncate">{activeReservation.guestName}</p>
          <p className="text-gray-500 mt-0.5">
            Saída: {formatDate(activeReservation.checkOut)}
          </p>
        </div>
      )}

      {/* Bottom info */}
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {room.capacity}
        </span>
        <span className="flex items-center gap-1">
          <BedDouble className="h-3 w-3" />
          {`${room.floor}º andar`}
        </span>
        <span className="ml-auto flex items-center gap-1 font-medium text-gray-700">
          <DollarSign className="h-3 w-3" />
          {formatCurrency(room.basePrice)}
        </span>
      </div>
    </button>
  );
}
