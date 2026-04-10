'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { arService, costCentersService, categoriesService } from '@/services/financial.service';

const SOURCE_LABEL: Record<string, string> = {
  RESERVATION: 'Reserva', EVENT: 'Evento', RESTAURANT: 'Restaurante',
  OTA: 'OTA', AGENCY: 'Agência', CORPORATE: 'Corporativo',
  WALK_IN: 'Walk-in', OTHER: 'Outros',
};

export default function ARNewPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    sourceType: 'RESERVATION',
    categoryId: '', costCenterId: '',
    description: '', totalAmount: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '', documentNumber: '', notes: '',
    companyName: '', otaName: '', otaBookingRef: '',
    otaCommissionRate: '',
    isCityLedger: false, cityLedgerRef: '',
  });

  const [useInstallments, setUseInstallments] = useState(false);
  const [instCount, setInstCount]             = useState('2');
  const [instInterval, setInstInterval]       = useState('30');

  const { data: costCenters } = useQuery({ queryKey: ['cost-centers'], queryFn: costCentersService.list });
  const { data: categories }  = useQuery({ queryKey: ['revenue-categories'], queryFn: categoriesService.listRevenue });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => arService.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['ar-list'] });
      router.push(`/financial/receivable/${(created as { id: string }).id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      sourceType: form.sourceType,
      categoryId: form.categoryId,
      costCenterId: form.costCenterId || undefined,
      description: form.description,
      totalAmount: Number(form.totalAmount),
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      documentNumber: form.documentNumber || undefined,
      notes: form.notes || undefined,
    };

    if (['OTA', 'AGENCY'].includes(form.sourceType)) {
      payload.otaName = form.otaName || undefined;
      payload.otaBookingRef = form.otaBookingRef || undefined;
      if (form.otaCommissionRate) payload.otaCommissionRate = Number(form.otaCommissionRate);
    }

    if (['CORPORATE', 'AGENCY'].includes(form.sourceType)) {
      payload.companyName = form.companyName || undefined;
      payload.isCityLedger = form.isCityLedger;
      if (form.isCityLedger) payload.cityLedgerRef = form.cityLedgerRef || undefined;
    }

    if (useInstallments && Number(instCount) >= 2) {
      payload.installments = { count: Number(instCount), intervalDays: Number(instInterval) };
    }

    createMut.mutate(payload);
  }

  const previewInstallments = useInstallments && Number(instCount) >= 2 && Number(form.totalAmount) > 0
    ? (() => {
        const total = Number(form.totalAmount);
        const count = Number(instCount);
        const interval = Number(instInterval);
        const amt = Math.floor((total / count) * 100) / 100;
        const lastAmt = Math.round((total - amt * (count - 1)) * 100) / 100;
        const base = new Date(form.dueDate || new Date());
        return Array.from({ length: count }, (_, i) => {
          const due = new Date(base);
          due.setDate(due.getDate() + i * interval);
          return { n: i + 1, amount: i === count - 1 ? lastAmt : amt, due: due.toISOString().slice(0, 10) };
        });
      })()
    : [];

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const isOTA = ['OTA', 'AGENCY'].includes(form.sourceType);
  const isCorp = ['CORPORATE', 'AGENCY'].includes(form.sourceType);

  // Auto-calc OTA net
  const otaNet = isOTA && form.totalAmount && form.otaCommissionRate
    ? Number(form.totalAmount) - (Number(form.totalAmount) * Number(form.otaCommissionRate) / 100)
    : null;

  return (
    <div className="flex flex-col h-full">
      <Header title="Contas a Receber" subtitle="Novo Título" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Link href="/financial/receivable" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Main fields */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Dados do Título</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Origem *</label>
                  <select required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.sourceType} onChange={set('sourceType')}>
                    {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
                  <select required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.categoryId} onChange={set('categoryId')}>
                    <option value="">Selecione</option>
                    {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Centro de Custo</label>
                <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.costCenterId} onChange={set('costCenterId')}>
                  <option value="">Nenhum</option>
                  {(costCenters ?? []).map((cc) => <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
                <input required minLength={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.description} onChange={set('description')} placeholder="Descreva o título..." />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor *</label>
                  <input required type="number" min="0.01" step="0.01" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.totalAmount} onChange={set('totalAmount')} placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Emissão *</label>
                  <input required type="date" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.issueDate} onChange={set('issueDate')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vencimento *</label>
                  <input required type="date" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dueDate} onChange={set('dueDate')} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nº Documento</label>
                <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.documentNumber} onChange={set('documentNumber')} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.notes} onChange={set('notes')} />
              </div>
            </div>

            {/* OTA Fields */}
            {isOTA && (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-cyan-800">Dados OTA / Agência</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome OTA / Agência</label>
                    <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.otaName} onChange={set('otaName')} placeholder="Booking.com, Expedia..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Referência OTA</label>
                    <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.otaBookingRef} onChange={set('otaBookingRef')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">% Comissão</label>
                    <input type="number" min="0" max="100" step="0.01" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.otaCommissionRate} onChange={set('otaCommissionRate')} placeholder="0" />
                  </div>
                  {otaNet !== null && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valor Líquido</label>
                      <p className="text-sm font-semibold text-green-700 py-2">{otaNet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Corporate Fields */}
            {isCorp && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Dados Corporativos</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Empresa</label>
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.companyName} onChange={set('companyName')} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.isCityLedger} onChange={(e) => setForm((f) => ({ ...f, isCityLedger: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <span className="text-sm text-gray-700">City Ledger</span>
                </label>
                {form.isCityLedger && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Referência City Ledger</label>
                    <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.cityLedgerRef} onChange={set('cityLedgerRef')} />
                  </div>
                )}
              </div>
            )}

            {/* Installments */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={useInstallments} onChange={(e) => setUseInstallments(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Parcelar</span>
              </label>

              {useInstallments && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nº de parcelas</label>
                      <input type="number" min="2" max="60" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={instCount} onChange={(e) => setInstCount(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Intervalo (dias)</label>
                      <input type="number" min="1" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={instInterval} onChange={(e) => setInstInterval(e.target.value)} />
                    </div>
                  </div>

                  {previewInstallments.length > 0 && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Pré-visualização</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {previewInstallments.map((inst) => (
                          <div key={inst.n} className="flex items-center justify-between text-xs text-gray-700">
                            <span>Parcela {inst.n}</span>
                            <span>{inst.due}</span>
                            <span className="font-semibold">{inst.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {createMut.isError && (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Erro ao criar título. Verifique os campos.
              </p>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={createMut.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                <Plus className="h-4 w-4" />
                {createMut.isPending ? 'Criando...' : 'Criar Título'}
              </button>
              <Link href="/financial/receivable" className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
