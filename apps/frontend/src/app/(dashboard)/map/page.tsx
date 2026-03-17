import { Header } from '@/components/layout/Header';
import { OccupancyGrid } from '@/components/rooms/OccupancyGrid';

export default function MapPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Mapa de Ocupação"
        subtitle="Clique em um quarto para realizar operações"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <OccupancyGrid />
      </div>
    </div>
  );
}
