'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, DollarSign, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { arService, bankAccountsService } from '@/services/financial.service';

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

function fmt(n: string | number) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ARDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [recAmount, setRecAmount] = useState('');
  const [recDate, setRecDate]     = useState(new Date().toISOString().slice(0, 10));
  const [recMethod, setRecMethod] = useState('PIX');
  const [recBankId, setRecBankId] = useState('');
  const [recRef, setRecRef]       = useState('');
  const [recNote, setRecNote]     = useState('');

  const { data: ar, isLoading } = useQuery({
    queryKey: ['ar', id],
    queryFn: () => arService.get(id),
    enabled: !!id,
  });

  const { data: banks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.list,
  });

  const cancelMut = useMutation({
    mutationFn: () => arService.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ar-list'] }); router.push('/financial/receivable'); },
  });

  const receiveMut = useMutation({
    mutationFn: () => arService.receive(id, {
      amount: Number(recAmount),
      receiptDate: recDate,
      method: recMethod,
      bankAccountId: recBankId || undefined,
      transactionRef: recRef || undefined,
      notes: recNote || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ar', id] });
      setShowReceiveForm(false);
      setRecAmount('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Contas a Receber" />
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!ar) return null;

  const remaining = Number(ar.totalAmount) - Number(ar.receivedAmount);
  const canReceive = ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].includes(ar.status);
  const canCancel = !['PAID', 'CANCELLED'].includes(ar.status);
  const isOTA = ar.sourceType === 'OTA';

  return (
    <div className="flex flex-col h-full">
      <Header title="Contas a Receber" subtitle={ar.code} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Back + Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/financial/receivable" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex gap-2 flex-wrap">
            {canReceive && (
              <button
                onClick={() => setShowReceiveForm(true)}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                <DollarSign className="h-4 w-4" /> Registrar Recebimento
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => { if (confirm('Cancelar este título?')) cancelMut.mutate(); }}
                disabled={cancelMut.isPending}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Receive Form */}
        {showReceiveForm && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
            <h3 className="font-semibold text-green-800 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Registrar Recebimento</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor *</label>
                <input
                  type="number" step="0.01" max={remaining}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  placeholder={`Máx: ${fmt(remaining)}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
                <input type="date" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Método *</label>
                <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={recMethod} onChange={(e) => setRecMethod(e.target.value)}>
                  <option value="PIX">PIX</option>
                  <option value="BANK_TRANSFER">Transferência</option>
                  <option value="OTA_TRANSFER">Repasse OTA</option>
                  <option value="CREDIT_CARD">Cartão Crédito</option>
                  <option value="DEBIT_CARD">Cartão Débito</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CHECK">Cheque</option>
                  <option value="VOUCHER">Voucher</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Conta Bancária</label>
                <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={recBankId} onChange={(e) => setRecBankId(e.target.value)}>
                  <option value="">Sem conta específica</option>
                  {(banks ?? []).map((b) => <option key={b.id} value={b.id}>{b.bankName} – {b.accountNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Referência</label>
                <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={recRef} onChange={(e) => setRecRef(e.target.value)} placeholder="Nº transação" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={recNote} onChange={(e) => setRecNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => receiveMut.mutate()}
                disabled={!recAmount || receiveMut.isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {receiveMut.isPending ? 'Registrando...' : 'Confirmar Recebimento'}
              </button>
              <button onClick={() => setShowReceiveForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
            {receiveMut.isError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Erro ao registrar recebimento.</p>}
          </div>
        )}

        {/* Header Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Status</p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[ar.status]}`}>{STATUS_LABEL[ar.status]}</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Origem</p>
            <p className="text-sm text-gray-700">{SOURCE_LABEL[ar.sourceType]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total</p>
            <p className="text-sm font-semibold text-gray-800">{fmt(ar.totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Saldo</p>
            <p className={`text-sm font-semibold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>{fmt(remaining)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Vencimento</p>
            <p className="text-sm text-gray-700">{fmtDate(ar.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Emissão</p>
            <p className="text-sm text-gray-700">{fmtDate(ar.issueDate)}</p>
          </div>
          {ar.companyName && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Empresa</p>
              <p className="text-sm text-gray-700">{ar.companyName}</p>
            </div>
          )}
          {ar.isCityLedger && (
            <div>
              <p className="text-xs text-gray-400 mb-1">City Ledger</p>
              <p className="text-sm text-gray-700">{ar.cityLedgerRef ?? 'Sim'}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-1">Descrição</p>
            <p className="text-sm text-gray-700">{ar.description}</p>
          </div>
        </div>

        {/* OTA Info */}
        {isOTA && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-cyan-600 mb-1">OTA</p>
              <p className="text-sm font-medium text-cyan-800">{ar.otaName}</p>
            </div>
            <div>
              <p className="text-xs text-cyan-600 mb-1">Booking Ref</p>
              <p className="text-sm text-cyan-800">{ar.otaBookingRef ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-cyan-600 mb-1">Comissão ({ar.otaCommissionRate}%)</p>
              <p className="text-sm font-semibold text-red-600">{ar.otaCommissionAmt ? fmt(ar.otaCommissionAmt) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-cyan-600 mb-1">Valor Líquido</p>
              <p className="text-sm font-semibold text-green-700">{ar.otaNetAmount ? fmt(ar.otaNetAmount) : '—'}</p>
            </div>
          </div>
        )}

        {/* Installments */}
        {ar.installments && ar.installments.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Parcelas ({ar.installments.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nº</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Vencimento</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Valor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Recebido</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ar.installments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500">{inst.installmentNumber}</td>
                      <td className="px-4 py-2 text-gray-700">{fmtDate(inst.dueDate)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{fmt(inst.amount)}</td>
                      <td className="px-4 py-2 text-right text-green-600">{fmt(inst.paidAmount)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inst.status]}`}>{STATUS_LABEL[inst.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Receipt History */}
        {ar.payments && ar.payments.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Histórico de Recebimentos</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {ar.payments.map((pay) => (
                <div key={pay.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{fmt(pay.amount)} — {pay.method}</p>
                    <p className="text-xs text-gray-400">
                      {fmtDate(pay.paymentDate)}
                      {pay.bankAccount && ` · ${pay.bankAccount.bankName}`}
                      {pay.transactionRef && ` · ${pay.transactionRef}`}
                    </p>
                  </div>
                  {pay.isReconciled && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Conciliado</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit */}
        {ar.auditLogs && (ar.auditLogs as unknown[]).length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Histórico de Ações</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {(ar.auditLogs as Array<{ id: string; action: string; performedAt: string }>).map((log) => (
                <div key={log.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700 font-medium">{log.action}</p>
                    <p className="text-xs text-gray-400">{fmtDateTime(log.performedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
