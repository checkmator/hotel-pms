'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Check, X, CreditCard, Eye } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { apService, suppliersService, costCentersService } from '@/services/financial.service';
import type { AccountPayable } from '@/lib/types';

const STATUS_BADGE: Record<string, string> = {
  PENDING:        'bg-yellow-100 text-yellow-800',
  APPROVED:       'bg-blue-100 text-blue-800',
  PARTIALLY_PAID: 'bg-purple-100 text-purple-800',
  PAID:           'bg-green-100 text-green-800',
  OVERDUE:        'bg-red-100 text-red-800',
  CANCELLED:      'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', APPROVED: 'Aprovado', PARTIALLY_PAID: 'Parcial',
  PAID: 'Pago', OVERDUE: 'Vencido', CANCELLED: 'Cancelado',
};

function fmt(n: string | number) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function APListPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [page, setPage]             = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['ap-list', { search, status, supplierId, page }],
    queryFn: () => apService.list({ search, status, supplierId, page, limit: 20 }),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.list({ isActive: 'true' }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apService.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-list'] }),
  });

  const rows: AccountPayable[] = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contas a Pagar"
        subtitle={`${total} título${total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/financial/payable/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Novo Título
          </Link>
        }
      />

      {/* Filters */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar código, descrição..."
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
          <option value="APPROVED">Aprovado</option>
          <option value="OVERDUE">Vencido</option>
          <option value="PARTIALLY_PAID">Parcial</option>
          <option value="PAID">Pago</option>
          <option value="CANCELLED">Cancelado</option>
        </select>

        <select
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-48"
          value={supplierId}
          onChange={(e) => { setSupplierId(e.target.value); setPage(1); }}
        >
          <option value="">Todos os fornecedores</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Fornecedor</th>
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
              ) : rows.map((ap) => {
                const remaining = Number(ap.totalAmount) - Number(ap.paidAmount);
                const isOverdue = ap.status === 'OVERDUE';
                return (
                  <tr key={ap.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{ap.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-48">{ap.description}</p>
                      {ap._count && ap._count.installments > 0 && (
                        <p className="text-xs text-gray-400">{ap._count.installments} parcelas</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell truncate max-w-32">{ap.supplier?.name}</td>
                    <td className={`px-4 py-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {fmtDate(ap.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(remaining)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[ap.status]}`}>
                        {STATUS_LABEL[ap.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {ap.approvalStatus === 'PENDING' && ap.status !== 'CANCELLED' && (
                          <button
                            onClick={() => approveMut.mutate(ap.id)}
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                            title="Aprovar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {['APPROVED', 'OVERDUE'].includes(ap.status) && (
                          <Link href={`/financial/payable/${ap.id}`} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Registrar pagamento">
                            <CreditCard className="h-4 w-4" />
                          </Link>
                        )}
                        <Link href={`/financial/payable/${ap.id}`} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="Ver detalhes">
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
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
