'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { apService } from '@/services/financial.service';
import { financialDashboardService } from '@/services/financial.service';
import type { AgingBucket, CashFlowDay } from '@/lib/types';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Bar chart (CSS only) ─────────────────────────────────────

function CashFlowChart({ data, days }: { data: CashFlowDay[]; days: number }) {
  const visible = data.slice(0, days);
  if (!visible.length) return <p className="text-center text-sm text-gray-400 py-12">Sem dados.</p>;

  const maxVal = Math.max(...visible.map((d) => Math.max(d.inflow, d.outflow)), 1);
  const BAR_MAX = 140;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-px min-w-max px-1" style={{ height: BAR_MAX + 32 }}>
        {visible.map((d) => (
          <div key={d.date} className="flex flex-col items-center gap-0.5" style={{ width: Math.max(12, 600 / days) }}>
            <div className="flex items-end gap-px">
              <div
                className="bg-green-400 rounded-t w-2"
                style={{ height: Math.round((d.inflow / maxVal) * BAR_MAX) }}
                title={`Entrada: ${fmt(d.inflow)}`}
              />
              <div
                className="bg-red-400 rounded-t w-2"
                style={{ height: Math.round((d.outflow / maxVal) * BAR_MAX) }}
                title={`Saída: ${fmt(d.outflow)}`}
              />
            </div>
            <span className="text-[9px] text-gray-400 rotate-45 origin-left mt-1 whitespace-nowrap">{fmtDate(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinancialReportsPage() {
  const [cashflowDays, setCashflowDays] = useState(30);

  const { data: dashboard, isLoading, refetch } = useQuery({
    queryKey: ['financial-dashboard'],
    queryFn: financialDashboardService.get,
  });

  const aging: AgingBucket[] = dashboard?.aging ?? [];
  const cashFlow: CashFlowDay[] = dashboard?.cashFlow ?? [];

  const totalAP = aging.reduce((s, b) => s + b.apAmount, 0);
  const totalAR = aging.reduce((s, b) => s + b.arAmount, 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Relatórios Financeiros"
        subtitle="Aging e Fluxo de Caixa"
        action={
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Aging Report */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Relatório de Aging</h3>

          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-200">
                      <th className="pb-2 text-left font-medium">Faixa de Vencimento</th>
                      <th className="pb-2 text-right font-medium">AP Qtd</th>
                      <th className="pb-2 text-right font-medium">AP Valor</th>
                      <th className="pb-2 text-right font-medium">AR Qtd</th>
                      <th className="pb-2 text-right font-medium">AR Valor</th>
                      <th className="pb-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((b) => {
                      const balance = b.arAmount - b.apAmount;
                      return (
                        <tr key={b.label} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-3 font-medium text-gray-700">{b.label}</td>
                          <td className="py-3 text-right text-gray-500">{b.apCount}</td>
                          <td className="py-3 text-right text-red-600">{b.apAmount > 0 ? fmt(b.apAmount) : '—'}</td>
                          <td className="py-3 text-right text-gray-500">{b.arCount}</td>
                          <td className="py-3 text-right text-green-600">{b.arAmount > 0 ? fmt(b.arAmount) : '—'}</td>
                          <td className={`py-3 text-right font-semibold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {fmt(balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-semibold">
                      <td className="py-3 text-gray-700">Total</td>
                      <td className="py-3 text-right text-gray-500">{aging.reduce((s, b) => s + b.apCount, 0)}</td>
                      <td className="py-3 text-right text-red-700">{fmt(totalAP)}</td>
                      <td className="py-3 text-right text-gray-500">{aging.reduce((s, b) => s + b.arCount, 0)}</td>
                      <td className="py-3 text-right text-green-700">{fmt(totalAR)}</td>
                      <td className={`py-3 text-right ${totalAR - totalAP >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {fmt(totalAR - totalAP)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* AP bar */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-500">Distribuição AP por faixa</p>
                {aging.map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-gray-500 shrink-0">{b.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-400 h-2 rounded-full"
                        style={{ width: totalAP > 0 ? `${(b.apAmount / totalAP) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs text-red-600 w-24 text-right shrink-0">{fmt(b.apAmount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Cash Flow Projection */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Projeção de Fluxo de Caixa</h3>
            <div className="flex gap-2">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setCashflowDays(d)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    cashflowDays === d
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2.5 w-2.5 rounded bg-green-400 inline-block" /> Entradas AR</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="h-2.5 w-2.5 rounded bg-red-400 inline-block" /> Saídas AP</span>
          </div>

          {isLoading ? (
            <div className="h-48 bg-gray-100 rounded animate-pulse" />
          ) : (
            <CashFlowChart data={cashFlow} days={cashflowDays} />
          )}

          {/* Running balance highlight */}
          {cashFlow.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
              {[
                { label: 'Total Entradas', val: cashFlow.slice(0, cashflowDays).reduce((s, d) => s + d.inflow, 0), color: 'text-green-600' },
                { label: 'Total Saídas',   val: cashFlow.slice(0, cashflowDays).reduce((s, d) => s + d.outflow, 0), color: 'text-red-600' },
                { label: 'Saldo Final',    val: cashFlow[Math.min(cashflowDays - 1, cashFlow.length - 1)]?.balance ?? 0, color: 'text-blue-600' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                  <p className={`text-base font-semibold ${item.color}`}>{fmt(item.val)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
