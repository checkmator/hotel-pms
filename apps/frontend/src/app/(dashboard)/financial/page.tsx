'use client';

import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { financialDashboardService } from '@/services/financial.service';
import type { FinancialDashboard, AgingBucket, CashFlowDay } from '@/lib/types';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:       'bg-yellow-100 text-yellow-800',
  APPROVED:      'bg-blue-100 text-blue-800',
  PARTIALLY_PAID:'bg-purple-100 text-purple-800',
  PAID:          'bg-green-100 text-green-800',
  OVERDUE:       'bg-red-100 text-red-800',
  CANCELLED:     'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', APPROVED: 'Aprovado', PARTIALLY_PAID: 'Parcial',
  PAID: 'Pago', OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
};

// ── Mini cashflow bar chart ──────────────────────────────────

function MiniCashflowChart({ data }: { data: CashFlowDay[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map((d) => Math.max(d.inflow, d.outflow)), 1);
  const visible = data.slice(0, 30);

  return (
    <div className="flex items-end gap-px h-20 w-full overflow-hidden">
      {visible.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-px min-w-0" title={`${d.date}\nEntradas: ${fmt(d.inflow)}\nSaídas: ${fmt(d.outflow)}`}>
          <div
            className="w-full bg-green-400 rounded-t"
            style={{ height: `${Math.round((d.inflow / maxVal) * 100) * 0.7}%` }}
          />
          <div
            className="w-full bg-red-400 rounded-t"
            style={{ height: `${Math.round((d.outflow / maxVal) * 100) * 0.7}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Aging table ──────────────────────────────────────────────

function AgingTable({ data }: { data: AgingBucket[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className="py-2 text-left font-medium">Faixa</th>
            <th className="py-2 text-right font-medium">AP (R$)</th>
            <th className="py-2 text-right font-medium">AR (R$)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.label} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-2 text-gray-700">{b.label}</td>
              <td className="py-2 text-right text-red-600">{b.apAmount > 0 ? fmt(b.apAmount) : '—'}</td>
              <td className="py-2 text-right text-green-600">{b.arAmount > 0 ? fmt(b.arAmount) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function FinancialDashboardPage() {
  const { data, isLoading, refetch } = useQuery<FinancialDashboard>({
    queryKey: ['financial-dashboard'],
    queryFn: financialDashboardService.get,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Financeiro"
        subtitle="Visão geral de contas a pagar e receber"
        action={
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              A Pagar
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">
              {isLoading ? '...' : fmt(data?.kpis.totalAPPending ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{data?.kpis.totalAPCount ?? 0} títulos em aberto</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              A Receber
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">
              {isLoading ? '...' : fmt(data?.kpis.totalARPending ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{data?.kpis.totalARCount ?? 0} títulos em aberto</p>
          </div>

          <div className="rounded-xl border border-red-100 bg-red-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
              <AlertTriangle className="h-4 w-4" />
              Inadimplência AP
            </div>
            <p className="text-xl font-bold text-red-700 leading-tight">
              {isLoading ? '...' : fmt(data?.kpis.overdueAP ?? 0)}
            </p>
            <p className="text-xs text-red-400 mt-1">{data?.kpis.overdueAPCount ?? 0} vencidos</p>
          </div>

          <div className={`rounded-xl border p-4 shadow-sm ${(data?.kpis.projectedBalance ?? 0) >= 0 ? 'border-green-100 bg-green-50' : 'border-orange-100 bg-orange-50'}`}>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Saldo Projetado
            </div>
            <p className={`text-xl font-bold leading-tight ${(data?.kpis.projectedBalance ?? 0) >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
              {isLoading ? '...' : fmt(data?.kpis.projectedBalance ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">AR – AP em aberto</p>
          </div>
        </div>

        {/* Cashflow + Aging */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Fluxo de Caixa – 30 dias</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-green-400" />Entrada</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-red-400" />Saída</span>
              </div>
            </div>
            {data?.cashFlow ? <MiniCashflowChart data={data.cashFlow} /> : <div className="h-20 bg-gray-50 rounded animate-pulse" />}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Aging de Títulos</h3>
              <Link href="/financial/reports" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Detalhes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {data?.aging ? <AgingTable data={data.aging} /> : <div className="h-32 bg-gray-50 rounded animate-pulse" />}
          </div>
        </div>

        {/* Upcoming AP + AR */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Upcoming AP */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-gray-700">Próximos Vencimentos — AP</h3>
              <Link href="/financial/payable" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : (data?.upcomingAP ?? []).length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Nenhum vencimento nos próximos 30 dias.</p>
              ) : (data?.upcomingAP ?? []).map((ap) => (
                <Link key={ap.id} href={`/financial/payable/${ap.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{ap.description}</p>
                    <p className="text-xs text-gray-400">{ap.supplier?.name} · {fmtDate(ap.dueDate)}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ap.status]}`}>{STATUS_LABEL[ap.status]}</span>
                    <span className="text-sm font-semibold text-gray-700">{fmt(Number(ap.totalAmount) - Number(ap.paidAmount))}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming AR */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-gray-700">Próximos Recebimentos — AR</h3>
              <Link href="/financial/receivable" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
              ) : (data?.upcomingAR ?? []).length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Nenhum recebimento nos próximos 30 dias.</p>
              ) : (data?.upcomingAR ?? []).map((ar) => (
                <Link key={ar.id} href={`/financial/receivable/${ar.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{ar.description}</p>
                    <p className="text-xs text-gray-400">{ar.companyName ?? ar.otaName ?? 'Direto'} · {fmtDate(ar.dueDate)}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ar.status]}`}>{STATUS_LABEL[ar.status]}</span>
                    <span className="text-sm font-semibold text-gray-700">{fmt(Number(ar.totalAmount) - Number(ar.receivedAmount))}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
