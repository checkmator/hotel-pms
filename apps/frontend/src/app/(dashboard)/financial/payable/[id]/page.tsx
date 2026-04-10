'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X, CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { apService, bankAccountsService } from '@/services/financial.service';

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

const APPROVAL_LABEL: Record<string, string> = {
  PENDING: 'Aguardando aprovação', APPROVED: 'Aprovado', REJECTED: 'Rejeitado',
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

export default function APDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount]     = useState('');
  const [payDate, setPayDate]         = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod]     = useState('PIX');
  const [payBankId, setPayBankId]     = useState('');
  const [payRef, setPayRef]           = useState('');
  const [payNote, setPayNote]         = useState('');

  const { data: ap, isLoading } = useQuery({
    queryKey: ['ap', id],
    queryFn: () => apService.get(id),
    enabled: !!id,
  });

  const { data: banks } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsService.list,
  });

  const approveMut = useMutation({
    mutationFn: () => apService.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap', id] }),
  });

  const rejectMut = useMutation({
    mutationFn: () => apService.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap', id] }),
  });

  const cancelMut = useMutation({
    mutationFn: () => apService.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ap-list'] }); router.push('/financial/payable'); },
  });

  const payMut = useMutation({
    mutationFn: () => apService.pay(id, {
      amount: Number(payAmount),
      paymentDate: payDate,
      method: payMethod,
      bankAccountId: payBankId || undefined,
      transactionRef: payRef || undefined,
      notes: payNote || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap', id] });
      setShowPayForm(false);
      setPayAmount('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Contas a Pagar" />
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!ap) return null;

  const remaining = Number(ap.totalAmount) - Number(ap.paidAmount);
  const canApprove = ap.approvalStatus === 'PENDING' && ap.status !== 'CANCELLED';
  const canPay = ['APPROVED', 'OVERDUE', 'PARTIALLY_PAID'].includes(ap.status);
  const canCancel = !['PAID', 'CANCELLED'].includes(ap.status);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contas a Pagar"
        subtitle={ap.code}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Back + Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/financial/payable" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex gap-2 flex-wrap">
            {canApprove && (
              <>
                <button
                  onClick={() => approveMut.mutate()}
                  disabled={approveMut.isPending}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Aprovar
                </button>
                <button
                  onClick={() => rejectMut.mutate()}
                  disabled={rejectMut.isPending}
                  className="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Rejeitar
                </button>
              </>
            )}
            {canPay && (
              <button
                onClick={() => setShowPayForm(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <CreditCard className="h-4 w-4" /> Registrar Pagamento
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

        {/* Pay Form */}
        {showPayForm && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Registrar Pagamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor *</label>
                <input
                  type="number"
                  step="0.01"
                  max={remaining}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Máx: ${fmt(remaining)}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
                <input type="date" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Método *</label>
                <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="PIX">PIX</option>
                  <option value="BANK_TRANSFER">Transferência</option>
                  <option value="BANK_SLIP">Boleto</option>
                  <option value="CHECK">Cheque</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CREDIT_CARD">Cartão Crédito</option>
                  <option value="DEBIT_CARD">Cartão Débito</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Conta Bancária</label>
                <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={payBankId} onChange={(e) => setPayBankId(e.target.value)}>
                  <option value="">Sem conta específica</option>
                  {(banks ?? []).map((b) => <option key={b.id} value={b.id}>{b.bankName} – {b.accountNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Referência / FITID</label>
                <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Nº transação" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <input type="text" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => payMut.mutate()}
                disabled={!payAmount || payMut.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {payMut.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
              </button>
              <button onClick={() => setShowPayForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
            {payMut.isError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Erro ao registrar pagamento.</p>}
          </div>
        )}

        {/* Header Info */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Status</p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[ap.status]}`}>{STATUS_LABEL[ap.status]}</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Aprovação</p>
            <p className="text-sm text-gray-700">{APPROVAL_LABEL[ap.approvalStatus]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total</p>
            <p className="text-sm font-semibold text-gray-800">{fmt(ap.totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Saldo</p>
            <p className={`text-sm font-semibold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(remaining)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Fornecedor</p>
            <p className="text-sm text-gray-700">{ap.supplier?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Centro de Custo</p>
            <p className="text-sm text-gray-700">{ap.costCenter?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Vencimento</p>
            <p className="text-sm text-gray-700">{fmtDate(ap.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Emissão</p>
            <p className="text-sm text-gray-700">{fmtDate(ap.issueDate)}</p>
          </div>
          {ap.documentNumber && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Documento</p>
              <p className="text-sm text-gray-700">{ap.documentType} {ap.documentNumber}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-1">Descrição</p>
            <p className="text-sm text-gray-700">{ap.description}</p>
          </div>
          {ap.notes && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-xs text-gray-400 mb-1">Observações</p>
              <p className="text-sm text-gray-600">{ap.notes}</p>
            </div>
          )}
        </div>

        {/* Installments */}
        {ap.installments && ap.installments.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Parcelas ({ap.installments.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nº</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Vencimento</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Valor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Pago</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ap.installments.map((inst) => (
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

        {/* Payment History */}
        {ap.payments && ap.payments.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Histórico de Pagamentos</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {ap.payments.map((pay) => (
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

        {/* Audit Timeline */}
        {ap.auditLogs && ap.auditLogs.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Histórico de Ações</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {(ap.auditLogs as Array<{ id: string; action: string; performedAt: string; performedById: string }>).map((log) => (
                <div key={log.id} className="px-4 py-2.5 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
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
