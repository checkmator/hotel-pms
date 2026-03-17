'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { auditService } from '@/services/audit.service';
import type { AuditLog, AuditAction } from '@/lib/types';

// ── Config ────────────────────────────────────────────────────────────────────
const ENTITY_LABELS: Record<string, string> = {
  guest:       'Hóspede',
  reservation: 'Reserva',
  room:        'Quarto',
  user:        'Usuário',
  invoice:     'Fatura',
  transaction: 'Lançamento',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Criação',
  update: 'Edição',
  delete: 'Exclusão',
  login:  'Login',
  logout: 'Logout',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login:  'bg-gray-100 text-gray-600',
  logout: 'bg-gray-100 text-gray-600',
};

// ── JSON diff viewer ──────────────────────────────────────────────────────────
function JsonBlock({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-gray-400 text-xs italic">—</span>;
  return (
    <pre className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-x-auto max-w-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ── Expandable row ────────────────────────────────────────────────────────────
function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-900">{log.user.name}</span>
          </div>
          <p className="text-xs text-gray-400 ml-5">{log.user.email}</p>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action]}`}>
            {ACTION_LABELS[log.action]}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{ENTITY_LABELS[log.entityType] ?? log.entityType}</td>
        <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[100px]">{log.entityId}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{log.ipAddress ?? '—'}</td>
      </tr>
      {open && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Antes</p>
                <JsonBlock data={log.oldValues} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Depois</p>
                <JsonBlock data={log.newValues} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const today     = new Date().toISOString().slice(0, 10);
  const sevenAgo  = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [from,       setFrom]       = useState(sevenAgo);
  const [to,         setTo]         = useState(today);
  const [entityType, setEntityType] = useState('');
  const [action,     setAction]     = useState('');
  const [page,       setPage]       = useState(1);

  const LIMIT = 50;

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit-logs', from, to, entityType, action, page],
    queryFn:  () => auditService.list({
      from, to,
      ...(entityType ? { entityType } : {}),
      ...(action     ? { action }     : {}),
      page, limit: LIMIT,
    }),
  });

  const totalPages = data ? Math.ceil(data.meta.total / LIMIT) : 1;

  return (
    <div className="flex flex-col h-full">
      <Header title="Auditoria" subtitle="Registro de todas as ações no sistema" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">De</label>
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Até</label>
              <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Entidade</label>
              <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">Todas</option>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Ação</label>
              <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">Todas</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'ID', 'IP'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Carregando...</td></tr>
                )}
                {!isLoading && data?.data.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Nenhum registro encontrado.</td></tr>
                )}
                {data?.data.map((log) => <LogRow key={log.id} log={log} />)}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.meta.total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">{data.meta.total} registros · página {page} de {totalPages}</p>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded px-2 py-1 text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded px-2 py-1 text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
