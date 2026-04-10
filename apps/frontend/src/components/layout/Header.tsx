'use client';

import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:h-16 lg:px-6">
      <div>
        <h1 className="text-base font-semibold text-gray-900 lg:text-lg">{title}</h1>
        {subtitle && <p className="hidden text-xs text-gray-500 sm:block">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        {action}
        <button className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
