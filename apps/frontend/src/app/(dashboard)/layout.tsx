import { Providers } from '@/app/providers';
import { ShellLayout } from '@/components/layout/ShellLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <ShellLayout>{children}</ShellLayout>
    </Providers>
  );
}
