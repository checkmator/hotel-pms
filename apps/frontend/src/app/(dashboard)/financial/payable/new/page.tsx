'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { apService, suppliersService, costCentersService, categoriesService } from '@/services/financial.service';

export default function APNewPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    supplierId: '', categoryId: '', costCenterId: '',
    description: '', totalAmount: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '', documentNumber: '', documentType: '', notes: '',
  });

  const [useInstallments, setUseInstallments] = useState(false);
  const [instCount, setInstCount]             = useState('2');
  const [instInterval, setInstInterval]       = useState('30');

  const [useTax, setUseTax] = useState(false);
  const [iss, setIss]       = useState('');
  const [irrf, setIrrf]     = useState('');

  const { data: suppliers }   = useQuery({ queryKey: ['suppliers'], queryFn: () => suppliersService.list({ isActive: 'true' }) });
  const { data: costCenters } = useQuery({ queryKey: ['cost-centers'], queryFn: costCentersService.list });
  const { data: categories }  = useQuery({ queryKey: ['expense-categories'], queryFn: categoriesService.listExpense });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => apService.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['ap-list'] });
      router.push(`/financial/payable/${(created as { id: string }).id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      supplierId: form.supplierId,
      categoryId: form.categoryId,
      costCenterId: form.costCenterId,
      description: form.description,
      totalAmount: Number(form.totalAmount),
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      documentNumber: form.documentNumber || undefined,
      documentType: form.documentType || undefined,
      notes: form.notes || undefined,
    };

    if (useInstallments && Number(instCount) >= 2) {
      payload.installments = { count: Number(instCount), intervalDays: Number(instInterval) };
    }

    if (useTax) {
      payload.taxRetentions = {
        iss: iss ? Number(iss) : undefined,
        irrf: irrf ? Number(irrf) : undefined,
      };
    }

    createMut.mutate(payload);
  }

  // Preview installments
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

  return (
    <div className="flex flex-col h-full">
      <Header title="Contas a Pagar" subtitle="Novo Título" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Link href="/financial/payable" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Main fields */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Dados do Título</h3>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fornecedor *</label>
                <select required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.supplierId} onChange={set('supplierId')}>
                  <option value="">Selecione o fornecedor</option>
                  {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
                  <select required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.categoryId} onChange={set('categoryId')}>
                    <option value="">Selecione</option>
                    {(categories ?? []).map((c) => (
                      <optgroup key={c.id} label={c.name}>
                        <option value={c.id}>{c.name}</option>
                        {(c.children ?? []).map((ch) => <option key={ch.id} value={ch.id}>↳ {ch.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Centro de Custo *</label>
                  <select required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.costCenterId} onChange={set('costCenterId')}>
                    <option value="">Selecione</option>
                    {(costCenters ?? []).map((cc) => <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
                <input required minLength={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.description} onChange={set('description')} placeholder="Descreva o título..." />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total *</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nº Documento</label>
                  <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.documentNumber} onChange={set('documentNumber')} placeholder="NF, boleto..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo Documento</label>
                  <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.documentType} onChange={set('documentType')}>
                    <option value="">Selecione</option>
                    <option value="NF">Nota Fiscal</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="FATURA">Fatura</option>
                    <option value="RECIBO">Recibo</option>
                    <option value="CONTRATO">Contrato</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.notes} onChange={set('notes')} />
              </div>
            </div>

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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Número de parcelas</label>
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

            {/* Tax Retentions */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={useTax} onChange={(e) => setUseTax(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Retenções Fiscais</span>
              </label>

              {useTax && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[['ISS', iss, setIss], ['IRRF', irrf, setIrrf]].map(([label, val, setter]) => (
                    <div key={label as string}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label as string} (R$)</label>
                      <input
                        type="number" min="0" step="0.01"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        value={val as string}
                        onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {createMut.isError && (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Erro ao criar título. Verifique os campos e tente novamente.
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {createMut.isPending ? 'Criando...' : 'Criar Título'}
              </button>
              <Link href="/financial/payable" className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
