import { Header } from '@/components/layout/Header';
import { HousekeepingBoard } from '@/components/housekeeping/HousekeepingBoard';

export default function HousekeepingPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Governança"
        subtitle="Gerencie o status de limpeza dos quartos"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <HousekeepingBoard />
      </div>
    </div>
  );
}
