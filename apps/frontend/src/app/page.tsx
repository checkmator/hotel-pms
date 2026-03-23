'use client';

import { Providers } from './providers';
import { ShellLayout } from '@/components/layout/ShellLayout';
import DashboardContent from './(dashboard)/DashboardContent';

export default function HomePage() {
  return (
    <Providers>
      <ShellLayout>
        <DashboardContent />
      </ShellLayout>
    </Providers>
  );
}
