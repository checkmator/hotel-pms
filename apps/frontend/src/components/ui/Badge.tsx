import { cn } from '@/lib/utils';
import type { RoomStatus } from '@/lib/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple';
  className?: string;
}

export function Badge({ children, variant = 'gray', className }: BadgeProps) {
  const variants = {
    green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    yellow: 'bg-amber-100 text-amber-700 ring-amber-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    gray: 'bg-gray-100 text-gray-600 ring-gray-200',
    purple: 'bg-purple-100 text-purple-700 ring-purple-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_MAP: Record<RoomStatus, { label: string; variant: BadgeProps['variant'] }> = {
  available:   { label: 'Disponível',  variant: 'green'  },
  occupied:    { label: 'Ocupado',     variant: 'red'    },
  dirty:       { label: 'Sujo',        variant: 'yellow' },
  maintenance: { label: 'Manutenção',  variant: 'gray'   },
  blocked:     { label: 'Bloqueado',   variant: 'purple' },
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ReservationStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    pending:     { label: 'Pendente',    variant: 'yellow' },
    confirmed:   { label: 'Confirmada',  variant: 'blue'   },
    checked_in:  { label: 'Check-in',    variant: 'green'  },
    checked_out: { label: 'Check-out',   variant: 'gray'   },
    cancelled:   { label: 'Cancelada',   variant: 'red'    },
    no_show:     { label: 'No-Show',     variant: 'purple' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}
