'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Link2, RefreshCw, CheckCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { reconciliationService, bankAccountsService } from '@/services/financial.service';

interface OFXEntry {
  fitid: string;
  type: string;
  amount: number;
  date: string;
  memo: string;
}

interface PendingPayment {
  id: string;
  amount: string;
  paymentDate: string;
  method: string;
  transactionRef: string | null;
  isReconciled: boolean;
  payable?: { code: string; description: string } | null;
  receivable?: { code: string; description: string } | null;
  bankAccount?: { bankName: string; accountNumber: string } | null;
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function ReconciliationPage() {
  const qc = useQueryClient();

  const [bankAccountId, setBankAccountId] = useState('');
  const [ofxText, setOfxText]             = useState('');
  const [importResult, setImportResult]   = useState<{ unmatched: OFXEntry[]; total: number; alreadyReconciled: number } | null>(null);
  const [selectedOFX, setSelectedOFX]     = useState<OFXEntry | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [page, setPage]                   = useState(1);

  const { data: banks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.list,
  });

  const { data: pending, refetch: refetchPending } = useQuery({
    queryKey: ['reconciliation-pending', { bankAccountId, page }],
    queryFn: () => reconciliationService.pending({ bankAccountId: bankAccountId || undefined, page, limit: 20 }),
    enabled: true,
  });

  const importMut = useMutation({
    mutationFn: () => reconciliationService.import({ ofxContent: ofxText, bankAccountId }),
    onSuccess: (data) => {
      setImportResult(data.data);
      refetchPending();
    },
  });

  const matchMut = useMutation({
    mutationFn: () => reconciliationService.match({ paymentId: selectedPayment, fitid: selectedOFX!.fitid, bankAccountId }),
    onSuccess: () => {
      setSelectedOFX(null);
      setSelectedPayment('');
      setImportResult((prev) => prev ? { ...prev, unmatched: prev.unmatched.filter((t) => t.fitid !== selectedOFX?.fitid) } : null);
      qc.invalidateQueries({ queryKey: ['reconciliation-pending'] });
    },
  });

  const unmatchMut = useMutation({
    mutationFn: (paymentId: string) => reconciliationService.unmatch(paymentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reconciliation-pending'] }),
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setOfxText(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  const pendingPayments: PendingPayment[] = pending?.data ?? [];
  const pendingTotal = pending?.meta?.total ?? 0;
  const pendingPages = Math.ceil(pendingTotal / 20);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Conciliação Bancária"
        subtitle="Importar OFX e vincular lançamentos"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Bank Account selector */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Conta Bancária</label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={bankAccountId}
              onChange={(e) => { setBankAccountId(e.target.value); setImportResult(null); }}
            >
              <option value="">Selecione uma conta</option>
              {(banks ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.bankName} – {b.accountNumber}</option>
              ))}
            </select>
          </div>
        </div>

        {/* OFX Import */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-500" />
            Importar Extrato OFX
          </h3>

          <div className="flex items-center gap-4 flex-wrap">
            <label className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 px-6 py-4 text-center hover:border-blue-400 transition-colors">
              <input type="file" accept=".ofx,.qfx" className="hidden" onChange={handleFileUpload} />
              <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Clique para selecionar arquivo .OFX</p>
              <p className="text-xs text-gray-400 mt-1">{ofxText ? `${ofxText.length} caracteres carregados` : 'Nenhum arquivo selecionado'}</p>
            </label>

            <div className="flex-1 min-w-64">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ou cole o conteúdo OFX</label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="<OFX>...</OFX>"
                value={ofxText}
                onChange={(e) => setOfxText(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={() => importMut.mutate()}
            disabled={!ofxText || !bankAccountId || importMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${importMut.isPending ? 'animate-spin' : ''}`} />
            {importMut.isPending ? 'Processando...' : 'Importar e Analisar'}
          </button>

          {importResult && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
              <p className="font-medium text-blue-800">Extrato processado</p>
              <p className="text-blue-600 mt-1">
                {importResult.total} transações · {importResult.alreadyReconciled} já conciliadas · {importResult.unmatched.length} para conciliar
              </p>
            </div>
          )}
        </div>

        {/* Match UI */}
        {importResult && importResult.unmatched.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-orange-500" />
              Vincular Transações OFX
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* OFX entries */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Transações OFX ({importResult.unmatched.length})</p>
                <div className="border border-gray-200 rounded-lg divide-y max-h-80 overflow-y-auto">
                  {importResult.unmatched.map((t) => (
                    <button
                      key={t.fitid}
                      onClick={() => setSelectedOFX(t)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selectedOFX?.fitid === t.fitid ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'CREDIT' ? '+' : '-'} {fmt(t.amount)}
                        </span>
                        <span className="text-xs text-gray-400">{fmtDate(t.date)}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate mt-0.5">{t.memo || t.fitid}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment selection */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Pagamentos Não Conciliados</p>
                <div className="border border-gray-200 rounded-lg divide-y max-h-80 overflow-y-auto">
                  {pendingPayments.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-400">Nenhum pagamento pendente de conciliação.</p>
                  ) : pendingPayments.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPayment(p.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selectedPayment === p.id ? 'bg-green-50 border-l-2 border-green-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">{fmt(Number(p.amount))}</span>
                        <span className="text-xs text-gray-400">{fmtDate(p.paymentDate)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {p.payable?.code ?? p.receivable?.code} — {p.payable?.description ?? p.receivable?.description ?? ''}
                      </p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => matchMut.mutate()}
                  disabled={!selectedOFX || !selectedPayment || matchMut.isPending}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" />
                  {matchMut.isPending ? 'Vinculando...' : 'Vincular Selecionados'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending payments list */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Pagamentos Pendentes de Conciliação ({pendingTotal})</h3>
            <button onClick={() => refetchPending()} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Título</th>
                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Método</th>
                  <th className="px-4 py-2 text-center font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingPayments.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum pagamento pendente de conciliação.</td></tr>
                ) : pendingPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.payable?.code ?? p.receivable?.code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{p.payable?.description ?? p.receivable?.description ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-2.5 text-gray-500">{fmtDate(p.paymentDate)}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.method}</td>
                    <td className="px-4 py-2.5 text-center">
                      {p.isReconciled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" /> Conciliado
                        </span>
                      ) : (
                        <button
                          onClick={() => unmatchMut.mutate(p.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                          title="Desvincular"
                        >
                          Desvincular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pendingPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Página {page} de {pendingPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">Anterior</button>
                <button onClick={() => setPage((p) => Math.min(pendingPages, p + 1))} disabled={page === pendingPages}
                  className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">Próxima</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
