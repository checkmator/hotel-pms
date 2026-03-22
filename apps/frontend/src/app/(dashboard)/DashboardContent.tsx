'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BedDouble, CalendarCheck, CalendarX, TrendingUp,
  ArrowRight, Clock, CheckCircle2, BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { dashboardService } from '@/services/dashboard.service';
import { reportsService } from '@/services/reports.service';
import type { ReservationStatus, RoomStatus, MonthlyRevenue } from '@/lib/types';

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending:     'Pendente',
  confirmed:   'Confirmada',
  checked_in:  'Hospedado',
  checked_out: 'Check-out',
  cancelled:   'Cancelada',
  no_show:     'No-show',
};

const STATUS_PILL: Record<ReservationStatus, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  confirmed:   'bg-blue-100 text-blue-700',
  checked_in:  'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-700',
  no_show:     'bg-orange-100 text-orange-700',
};

const ROOM_STATUS_COLORS: Record<string, string> = {
  available:   'bg-green-500',
  occupied:    'bg-blue-500',
  dirty:       'bg-yellow-400',
  maintenance: 'bg-orange-400',
  blocked:     'bg-gray-400',
};

const ROOM_STATUS_LABELS: Record<string, string> = {
  available:   'Disponível',
  occupied:    'Ocupado',
  dirty:       'Limpeza',
  maintenance: 'Manutenção',
  blocked:     'Bloqueado',
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow h-full">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium leading-tight">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5 break-all sm:text-2xl">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{sub}</p>}
      </div>
      {href && <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ── Monthly Revenue Bar Chart ─────────────────────────────────────────────────
const BAR_MAX_PX = 80;

function MonthlyChart({ months }: { months: MonthlyRevenue[] }) {
  if (!months.length) return null;
  const maxVal = Math.max(...months.map((m) => m.total), 1);
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-500" /> Receita Mensal (12 meses)
        </h3>
        <Link href="/reports" className="text-xs text-blue-600 hover:underline">Ver relatórios</Link>
      </div>
      <div className="flex items-end gap-1" style={{ height: `${BAR_MAX_PX + 28}px` }}>
        {months.map((m) => {
          const barH = Math.max(Math.round((m.total / maxVal) * BAR_MAX_PX), m.total > 0 ? 4 : 2);
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10 pointer-events-none">
                {fmtCurr(m.total)}
              </div>
              <div
                className="w-full rounded-t bg-purple-500 opacity-80 group-hover:opacity-100 transition-opacity cursor-default"
                style={{ height: `${barH}px` }}
              />
              <span className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const EMPTY_DASHBOARD = {
  today: { date: new Date().toISOString().split('T')[0], checkInsCompleted: 0, checkOutsCompleted: 0, pendingCheckIns: 0 },
  rooms: { total: 0, occupancyRate: 0, byStatus: {} as Record<string, number> },
  revenue: { monthTotal: 0, monthLabel: '—', invoiceCount: 0 },
  upcomingCheckIns: [] as any[],
  recentReservations: [] as any[],
};

export default function DashboardContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.get,
    refetchInterval: 60_000,
    retry: 1,
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['revenue-monthly'],
    queryFn: () => reportsService.revenueMonthly(12),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Dashboard" subtitle="Visão geral do hotel" />
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Carregando...
        </div>
      </div>
    );
  }

  const { today, rooms, revenue, upcomingCheckIns, recentReservations } = data ?? EMPTY_DASHBOARD;

  const roomStatuses: RoomStatus[] = ['available', 'occupied', 'dirty', 'maintenance', 'blocked'];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`Hoje, ${new Date(today.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`}
      />

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Check-ins Hoje"
            value={today.checkInsCompleted}
            sub={today.pendingCheckIns > 0 ? `${today.pendingCheckIns} aguardando` : 'Todos realizados'}
            icon={CalendarCheck}
            color="bg-green-500"
            href="/map"
          />
          <KpiCard
            label="Check-outs Hoje"
            value={today.checkOutsCompleted}
            icon={CalendarX}
            color="bg-blue-500"
            href="/map"
          />
          <KpiCard
            label="Ocupação Atual"
            value={`${rooms.occupancyRate}%`}
            sub={`${rooms.byStatus['occupied'] ?? 0} de ${rooms.total} quartos`}
            icon={BedDouble}
            color="bg-indigo-500"
            href="/map"
          />
          <KpiCard
            label={`Receita — ${revenue.monthLabel}`}
            value={fmt(revenue.monthTotal)}
            sub={`${revenue.invoiceCount} fatura(s) fechada(s)`}
            icon={TrendingUp}
            color="bg-purple-500"
            href="/reports"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Room status breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Status dos Quartos</h3>
            <div className="flex h-3 rounded-full overflow-hidden mb-4">
              {roomStatuses.map((s) => {
                const count = rooms.byStatus[s] ?? 0;
                const pct = rooms.total > 0 ? (count / rooms.total) * 100 : 0;
                return pct > 0 ? (
                  <div
                    key={s}
                    className={ROOM_STATUS_COLORS[s]}
                    style={{ width: `${pct}%` }}
                    title={`${ROOM_STATUS_LABELS[s]}: ${count}`}
                  />
                ) : null;
              })}
            </div>
            <div className="space-y-2">
              {roomStatuses.map((s) => {
                const count = rooms.byStatus[s] ?? 0;
                return (
                  <div key={s} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${ROOM_STATUS_COLORS[s]}`} />
                      <span className="text-gray-600">{ROOM_STATUS_LABELS[s]}</span>
                    </div>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming check-ins */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Próximos Check-ins</h3>
              <Link href="/reservations" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
            </div>
            {upcomingCheckIns.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum check-in nos próximos 7 dias.</p>
            ) : (
              <div className="space-y-3">
                {upcomingCheckIns.map((r) => (
                  <div key={r.id} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-bold">
                      {r.room.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.guest.fullName}</p>
                      <p className="text-xs text-gray-400">{fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtDate(r.checkInDate)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent reservations */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Atividade Recente</h3>
              <Link href="/reservations" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
            </div>
            {recentReservations.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhuma reserva ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentReservations.map((r) => (
                  <div key={r.id} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-gray-300" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.guest.fullName}</p>
                      <p className="text-xs text-gray-400">Quarto {r.room.number} · {fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)}</p>
                    </div>
                    <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[r.status as ReservationStatus]}`}>
                      {STATUS_LABELS[r.status as ReservationStatus]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Monthly revenue chart */}
        {monthlyData && <MonthlyChart months={monthlyData} />}

        {/* Pending check-ins alert */}
        {today.pendingCheckIns > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              <strong>{today.pendingCheckIns}</strong> reserva(s) com check-in previsto para hoje ainda não realizadas.
            </p>
            <Link href="/map" className="ml-auto text-sm font-medium text-yellow-700 hover:text-yellow-900 whitespace-nowrap">
              Ver mapa →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
