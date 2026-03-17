'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, BedDouble, DollarSign, CalendarCheck, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { reportsService } from '@/services/reports.service';

const CATEGORY_LABELS: Record<string, string> = {
  daily_rate:   'Diária',
  minibar:      'Frigobar',
  laundry:      'Lavanderia',
  restaurant:   'Restaurante',
  room_service: 'Room Service',
  parking:      'Estacionamento',
  extra:        'Extra',
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Pure-CSS bar chart ────────────────────────────────────────────────────────
const BAR_MAX_PX = 120;

function BarChart({ data, valueKey, color, formatValue }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  valueKey: string;
  color: string;
  formatValue: (v: number) => string;
}) {
  if (!data.length) return <p className="text-center text-sm text-gray-400 py-8">Sem dados no período.</p>;
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-px" style={{ height: `${BAR_MAX_PX + 8}px`, minWidth: `${data.length * 8}px` }}>
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const barH = Math.max(Math.round((val / maxVal) * BAR_MAX_PX), 2);
          return (
            <div key={i} className="relative flex-1 flex items-end justify-center group">
              <div
                className={`w-full rounded-t ${color} opacity-80 group-hover:opacity-100 transition-opacity cursor-default`}
                style={{ height: `${barH}px` }}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10 pointer-events-none">
                {formatValue(val)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyAgo);
  const [to,   setTo]   = useState(today);
  const [tab,  setTab]  = useState<'revenue' | 'occupancy'>('revenue');

  const revenueQ = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn:  () => reportsService.revenue({ from, to }),
  });

  const occupancyQ = useQuery({
    queryKey: ['reports', 'occupancy', from, to],
    queryFn:  () => reportsService.occupancy({ from, to }),
  });

  const rev = revenueQ.data;
  const occ = occupancyQ.data;

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatórios" subtitle="Ocupação, receita e análises" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">De</label>
            <input
              type="date" value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Até</label>
            <input
              type="date" value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          {(revenueQ.isFetching || occupancyQ.isFetching) && (
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['revenue', 'occupancy'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'revenue' ? 'Receita' : 'Ocupação'}
            </button>
          ))}
        </div>

        {/* ── Revenue Tab ── */}
        {tab === 'revenue' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard
                label="Receita Total" icon={DollarSign} color="bg-green-500"
                value={rev ? fmt(rev.summary.total) : '—'}
                sub={rev ? `${rev.summary.invoicesCount} faturas` : undefined}
              />
              <KpiCard
                label="Subtotal (sem imposto)" icon={TrendingUp} color="bg-blue-500"
                value={rev ? fmt(rev.summary.subtotal) : '—'}
                sub={rev ? `Impostos: ${fmt(rev.summary.taxes)}` : undefined}
              />
              <KpiCard
                label="Descontos Aplicados" icon={DollarSign} color="bg-orange-400"
                value={rev ? fmt(rev.summary.discounts) : '—'}
              />
              <KpiCard
                label="Check-outs no Período" icon={CalendarCheck} color="bg-purple-500"
                value={rev ? String(rev.summary.checkedOutReservations) : '—'}
                sub={rev ? `Cancelamentos: ${rev.summary.cancelledReservations}` : undefined}
              />
            </div>

            {/* Revenue chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Receita por Dia (R$)</h3>
              {revenueQ.isLoading ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">Carregando...</div>
              ) : (
                <>
                  <BarChart
                    data={rev?.dailySeries ?? []}
                    valueKey="revenue"
                    color="bg-blue-500"
                    formatValue={fmt}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                    {rev?.dailySeries.length ? (
                      <>
                        <span>{fmtDate(rev.dailySeries[0].date)}</span>
                        <span>{fmtDate(rev.dailySeries[rev.dailySeries.length - 1].date)}</span>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {/* By category */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Receita por Categoria</h3>
              {revenueQ.isLoading ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : rev?.byCategory.length === 0 ? (
                <p className="text-sm text-gray-400">Sem lançamentos no período.</p>
              ) : (
                <div className="space-y-3">
                  {rev?.byCategory.map((cat) => {
                    const total = rev.byCategory.reduce((s, c) => s + c.total, 0);
                    const pct = total > 0 ? (cat.total / total) * 100 : 0;
                    return (
                      <div key={cat.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                          <span className="text-gray-900 font-semibold">{fmt(cat.total)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{cat.count} lançamento(s) · {pct.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Occupancy Tab ── */}
        {tab === 'occupancy' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard
                label="Taxa Média de Ocupação" icon={BedDouble} color="bg-blue-500"
                value={occ ? `${occ.avgOccupancyRate}%` : '—'}
                sub={occ ? `${occ.totalRooms} quartos no total` : undefined}
              />
              <KpiCard
                label="Quartos no Período" icon={BedDouble} color="bg-indigo-500"
                value={occ ? String(occ.totalRooms) : '—'}
              />
              <KpiCard
                label="Dias Analisados" icon={CalendarCheck} color="bg-teal-500"
                value={occ ? String(occ.dailySeries.length) : '—'}
              />
            </div>

            {/* Occupancy chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Taxa de Ocupação por Dia (%)</h3>
              {occupancyQ.isLoading ? (
                <div className="h-40 flex items-center justify-center text-sm text-gray-400">Carregando...</div>
              ) : (
                <>
                  <BarChart
                    data={occ?.dailySeries ?? []}
                    valueKey="rate"
                    color="bg-indigo-500"
                    formatValue={(v) => `${v}%`}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                    {occ?.dailySeries.length ? (
                      <>
                        <span>{fmtDate(occ.dailySeries[0].date)}</span>
                        <span>{fmtDate(occ.dailySeries[occ.dailySeries.length - 1].date)}</span>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            {/* Daily table (last 10 days) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Detalhe Diário</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Data', 'Ocupados', 'Total', 'Taxa'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(occ?.dailySeries ?? []).slice(-14).reverse().map((d) => (
                      <tr key={d.date} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700">{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-2.5 text-gray-900 font-medium">{d.occupied}</td>
                        <td className="px-4 py-2.5 text-gray-500">{d.total}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-semibold ${d.rate >= 75 ? 'text-green-600' : d.rate >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {d.rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
