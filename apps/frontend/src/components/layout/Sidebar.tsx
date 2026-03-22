'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  CalendarDays,
  Users,
  Sparkles,
  LogOut,
  Hotel,
  BarChart3,
  UserCog,
  ClipboardList,
  BedDouble,
  LayoutDashboard,
  BookOpen,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',             label: 'Dashboard',          icon: LayoutDashboard, roles: ['admin', 'reception'] },
  { href: '/map',          label: 'Mapa de Ocupação',   icon: LayoutGrid,      roles: ['admin', 'reception', 'housekeeping'] },
  { href: '/reservations', label: 'Reservas',            icon: CalendarDays,    roles: ['admin', 'reception'] },
  { href: '/guests',       label: 'Hóspedes',            icon: Users,           roles: ['admin', 'reception'] },
  { href: '/housekeeping', label: 'Governança',           icon: Sparkles,        roles: ['admin', 'reception', 'housekeeping'] },
  { href: '/rooms',        label: 'Quartos',              icon: BedDouble,       roles: ['admin'] },
  { href: '/reports',      label: 'Relatórios',           icon: BarChart3,       roles: ['admin', 'reception'] },
  { href: '/users',        label: 'Funcionários',          icon: UserCog,         roles: ['admin'] },
  { href: '/audit',        label: 'Auditoria',             icon: ClipboardList,   roles: ['admin'] },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visible = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Hotel className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-none">Hotel PMS</p>
          <p className="text-xs text-gray-400 mt-0.5">Sistema de Gestão</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-blue-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Manual link */}
      <div className="px-3 pb-2">
        <a
          href="/manual.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <BookOpen className="h-4 w-4 text-gray-400" />
          Manual do Usuário
        </a>
      </div>

      {/* User + Logout */}
      <div className="border-t border-gray-100 p-4">
        <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role === 'reception' ? 'Recepção' : user?.role === 'housekeeping' ? 'Governança' : 'Administrador'}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
