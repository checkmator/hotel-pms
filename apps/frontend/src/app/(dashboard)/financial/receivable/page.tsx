'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { arService } from '@/services/financial.service';
import type { AccountReceivable } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  PENDING:        'bg-yellow-100 text-yellow-800',
  PARTIALLY_PAID: 'bg-purple-100 text-purple-800',
  PAID:           'bg-green-100 text-green-800',
  OVERDUE:        'bg-red-100 text-red-800',
  CANCELLED:      'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', PARTIALLY_PAID: 'Parcial',
  PAID: 'Recebido', OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
};

const SOURCE_LABEL: Record<string, string> = {
  RESERVATION: 'Reserva', EVENT: 'Evento', RESTAURANT: 'Restaurante',
  OTA: 'OTA', AGENCY: 'Agência', CORPORATE: 'Corporativo',
  WALK_IN: 'Walk-in', OTHER: 'Outros',
};

const SOURCE_BADGE: Record<string, string> = {
  RESERVATION: 'bg-blue-50 text-blue-700',
  EVENT:       'bg-purple-50 text-purple-700',
  RESTAURANT:  'bg-orange-50 text-orange-700',
  OTA:         'bg-cyan-50 text-cyan-700',
  AGENCY:      'bg-indigo-50 text-indigo-700',
  CORPORATE:   'bg-gray-100 text-gray-700',
  WALK_IN:     'bg-green-50 text-green-700',
  OTHER:       'bg-gray-50 text-gray-500',
};

function fmt(n: string | number) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

type TabKey = 'all' | 'city_ledger' | 'ota';

export default function ARListPage() {
  const qc = useQueryClient();
  const [tab, setTab]           = useState<TabKey>('all');
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [sourceType, setSource] = useState('');
  const [page, setPage]         = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['ar-list', { search, status, sourceType, page, tab }],
    queryFn: () => {
      if (tab === 'city_ledger') return arService.cityLedger({ page, limit: 20 });
      if (tab === 'ota') return arService.otaReconciliation({ page, limit: 20 });
      return arService.list({ search, status, sourceType, page, limit: 20 });
    },
  });

  const rows: AccountReceivable[] = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'city_ledger', label: 'City Ledger' },
    { key: 'ota', label: 'OTAs' },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contas a Receber"
        subtitle={`${total} título${total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/financial/receivable/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Novo Título
          </Link>
        }
      />

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-4 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (only in 'all' tab) */}
      {tab === 'all' && (
        <div className="border-b border-gray-200 bg-white px-4 py-3 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar código, descrição, empresa..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">Todos os status</option>
            <option value="PENDING">Pendente</option>
            <option value="OVERDUE">Vencido</option>
            <option value="PARTIALLY_PAID">Parcial</option>
            <option value="PAID">Recebido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>

          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={sourceType}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
          >
            <option value="">Todas as origens</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Origem</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vencimento</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Nenhum título encontrado.</td></tr>
              ) : rows.map((ar) => {
                const remaining = Number(ar.totalAmount) - Number(ar.receivedAmount);
                const isOverdue = ar.status === 'OVERDUE';
                const label = ar.companyName ?? ar.otaName ?? '';
                return (
                  <tr key={ar.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{ar.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-48">{ar.description}</p>
                      {label && <p className="text-xs text-gray-400 truncate">{label}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_BADGE[ar.sourceType]}`}>
                        {SOURCE_LABEL[ar.sourceType]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {fmtDate(ar.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(remaining)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ar.status]}`}>
                        {STATUS_LABEL[ar.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(ar.status) && (
                          <Link href={`/financial/receivable/${ar.id}`} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Registrar recebimento">
                            <DollarSign className="h-4 w-4" />
                          </Link>
                        )}
                        <Link href={`/financial/receivable/${ar.id}`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} títulos · página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Anterior
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
