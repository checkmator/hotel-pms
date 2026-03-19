'use client';

import { Providers } from './providers';
import { Sidebar } from '@/components/layout/Sidebar';
import DashboardContent from './(dashboard)/DashboardContent';

export default function HomePage() {
  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <DashboardContent />
        </main>
      </div>
    </Providers>
  );
}
