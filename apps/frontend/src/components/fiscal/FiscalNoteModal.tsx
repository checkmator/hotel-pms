'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText, Send, X, CheckCircle2, AlertCircle,
  Clock, Ban, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fiscalNoteService } from '@/services/fiscal-note.service';
import type { FiscalNote, FiscalNoteStatus } from '@/lib/types';

// ── Status display ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<FiscalNoteStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Pendente',  color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  emitted:   { label: 'Emitida',   color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700',       icon: Ban },
  error:     { label: 'Erro',      color: 'bg-red-100 text-red-700',       icon: AlertCircle },
};

function fmt(v: string | number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Create Form Schema ────────────────────────────────────────────────────────
const schema = z.object({
  prestadorCnpj:        z.string().min(11, 'CNPJ inválido.').max(20),
  prestadorRazaoSocial: z.string().min(2).max(150),
  prestadorIm:          z.string().max(20).optional(),
  prestadorMunicipio:   z.string().min(2).max(80),
  tomadorDocumento:     z.string().min(11, 'CPF/CNPJ inválido.').max(20),
  tomadorNome:          z.string().min(2).max(150),
  tomadorEmail:         z.string().email('E-mail inválido.').optional().or(z.literal('')),
  discriminacao:        z.string().min(10, 'Mínimo 10 caracteres.').max(2000),
  codigoServico:        z.string().max(10).default('0107'),
  aliquotaIss:          z.coerce.number().min(0).max(1).default(0.05),
  valorDeducoes:        z.coerce.number().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

// ── Note detail row ───────────────────────────────────────────────────────────
function NoteCard({ note, onEmit, onCancel, onDelete, loading }: {
  note: FiscalNote;
  onEmit: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[note.status];
  const Icon = cfg.icon;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-white cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
            <Icon className="h-3.5 w-3.5" /> {cfg.label}
          </span>
          {note.numero && <span className="text-sm font-semibold text-gray-900">Nº {note.numero}/{note.serie}</span>}
          <span className="text-xs text-gray-500">
            {new Date(note.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{fmt(note.valorLiquido)}</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
          {/* Tomador */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 font-medium">Tomador</p>
              <p className="text-gray-900 font-medium">{note.tomadorNome}</p>
              <p className="text-gray-500">{note.tomadorDocumento}</p>
              {note.tomadorEmail && <p className="text-gray-500">{note.tomadorEmail}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Prestador</p>
              <p className="text-gray-900 font-medium">{note.prestadorRazaoSocial}</p>
              <p className="text-gray-500">CNPJ: {note.prestadorCnpj}</p>
              <p className="text-gray-500">{note.prestadorMunicipio}</p>
            </div>
          </div>

          {/* Values */}
          <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Valor dos Serviços</span><span>{fmt(note.valorServicos)}</span></div>
            {Number(note.valorDeducoes) > 0 && <div className="flex justify-between"><span className="text-gray-500">Deduções</span><span>-{fmt(note.valorDeducoes)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Base de Cálculo</span><span>{fmt(note.baseCalculo)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ISS ({(Number(note.aliquotaIss) * 100).toFixed(2)}%)</span><span>{fmt(note.valorIss)}</span></div>
            <div className="flex justify-between font-semibold border-t border-gray-100 pt-1.5 mt-1.5"><span>Valor Líquido</span><span>{fmt(note.valorLiquido)}</span></div>
          </div>

          {/* Discriminação */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Discriminação</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.discriminacao}</p>
          </div>

          {/* Protocol */}
          {note.protocolo && (
            <div className="text-xs text-gray-500">
              Protocolo: <span className="font-mono">{note.protocolo}</span> · Verificação: <span className="font-mono">{note.codigoVerificacao}</span>
            </div>
          )}

          {/* Cancellation reason */}
          {note.motivoCancelamento && (
            <div className="text-xs text-red-600">Motivo cancelamento: {note.motivoCancelamento}</div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {note.status === 'pending' && (
              <>
                <Button
                  className="flex-1"
                  loading={loading}
                  onClick={() => onEmit(note.id)}
                >
                  <Send className="h-4 w-4" /> Transmitir NFS-e
                </Button>
                <Button
                  variant="secondary"
                  loading={loading}
                  onClick={() => onDelete(note.id)}
                  className="text-red-600 hover:bg-red-50 hover:border-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {note.status === 'emitted' && (
              <Button
                variant="secondary"
                loading={loading}
                onClick={() => onCancel(note.id)}
                className="text-red-600 hover:bg-red-50 hover:border-red-200"
              >
                <X className="h-4 w-4" /> Cancelar NFS-e
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface FiscalNoteModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  invoiceId: string;
  /** Pre-fill tomador from guest */
  guestName: string;
  guestDocument: string;
  guestEmail?: string;
  /** Pre-fill valor from invoice */
  invoiceTotal: string;
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function FiscalNoteModal({
  open, onClose,
  reservationId, invoiceId,
  guestName, guestDocument, guestEmail,
  invoiceTotal,
}: FiscalNoteModalProps) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['fiscal-notes', reservationId],
    queryFn: () => fiscalNoteService.listByReservation(reservationId),
    enabled: open,
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      prestadorCnpj:        '',
      prestadorRazaoSocial: '',
      prestadorIm:          '',
      prestadorMunicipio:   '',
      tomadorDocumento:     guestDocument,
      tomadorNome:          guestName,
      tomadorEmail:         guestEmail ?? '',
      discriminacao:        `Serviços de hospedagem conforme reserva. Valor da fatura: R$ ${Number(invoiceTotal).toFixed(2)}.`,
      codigoServico:        '0107',
      aliquotaIss:          0.05,
      valorDeducoes:        0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => fiscalNoteService.create(reservationId, { ...data, invoiceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-notes', reservationId] });
      setShowForm(false);
      reset();
    },
  });

  const emitMutation = useMutation({
    mutationFn: fiscalNoteService.emit,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-notes', reservationId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => fiscalNoteService.cancel(id, motivo),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fiscal-notes', reservationId] }); setCancelId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: fiscalNoteService.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-notes', reservationId] }),
  });

  const anyLoading = emitMutation.isPending || cancelMutation.isPending || deleteMutation.isPending;

  return (
    <Modal open={open} onClose={onClose} title="NFS-e — Nota Fiscal de Serviços">
      <div className="space-y-4 min-w-0">
        {/* Existing notes */}
        {isLoading && <p className="text-sm text-gray-400 text-center py-4">Carregando...</p>}

        {!isLoading && notes.length === 0 && !showForm && (
          <div className="text-center py-6">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhuma NFS-e gerada para esta fatura.</p>
          </div>
        )}

        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            loading={anyLoading}
            onEmit={(id) => emitMutation.mutate(id)}
            onCancel={(id) => setCancelId(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}

        {/* Cancel confirmation */}
        {cancelId && (
          <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
            <p className="text-sm font-medium text-red-800">Cancelar NFS-e</p>
            <textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              rows={2}
              placeholder="Motivo do cancelamento (obrigatório)"
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/30 resize-none"
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setCancelId(null)}>Voltar</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500/20"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate({ id: cancelId, motivo: cancelMotivo })}
                disabled={!cancelMotivo.trim()}
              >
                Confirmar Cancelamento
              </Button>
            </div>
          </div>
        )}

        {/* New NFS-e form */}
        {showForm ? (
          <form onSubmit={handleSubmit((d) => createMutation.mutateAsync(d))} className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Dados do Prestador (Hotel)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input {...register('prestadorCnpj')}        id="prestadorCnpj"        label="CNPJ *"              placeholder="00.000.000/0001-00" error={errors.prestadorCnpj?.message} />
              <Input {...register('prestadorIm')}          id="prestadorIm"          label="Inscrição Municipal"  placeholder="00000/0001-0" />
              <div className="col-span-2">
                <Input {...register('prestadorRazaoSocial')} id="prestadorRazaoSocial" label="Razão Social *"     placeholder="Hotel Exemplo Ltda" error={errors.prestadorRazaoSocial?.message} />
              </div>
              <div className="col-span-2">
                <Input {...register('prestadorMunicipio')} id="prestadorMunicipio"   label="Município *"          placeholder="São Paulo" error={errors.prestadorMunicipio?.message} />
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-900 pt-1">Dados do Tomador (Hóspede/Empresa)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input {...register('tomadorDocumento')} id="tomadorDocumento" label="CPF / CNPJ *"  placeholder="000.000.000-00" error={errors.tomadorDocumento?.message} />
              <Input {...register('tomadorEmail')}    id="tomadorEmail"    label="E-mail"          type="email" placeholder="email@exemplo.com" />
              <div className="col-span-2">
                <Input {...register('tomadorNome')}  id="tomadorNome"     label="Nome / Razão Social *" placeholder={guestName} error={errors.tomadorNome?.message} />
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-900 pt-1">Serviço</p>
            <div className="grid grid-cols-3 gap-3">
              <Input {...register('codigoServico')} id="codigoServico" label="Código (LC 116)" placeholder="0107" />
              <Input {...register('aliquotaIss')}   id="aliquotaIss"   label="Alíquota ISS"   type="number" step="0.0001" placeholder="0.05" />
              <Input {...register('valorDeducoes')} id="valorDeducoes" label="Deduções (R$)"  type="number" step="0.01" placeholder="0" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Discriminação dos Serviços *</label>
              <textarea
                {...register('discriminacao')}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
              {errors.discriminacao && <p className="text-xs text-red-500">{errors.discriminacao.message}</p>}
            </div>

            {createMutation.isError && (
              <p className="text-sm text-red-600">
                {(createMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao gerar NFS-e.'}
              </p>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" loading={createMutation.isPending}>
                <FileText className="h-4 w-4" /> Gerar NFS-e
              </Button>
            </div>
          </form>
        ) : (
          !cancelId && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowForm(true)}
              disabled={notes.some((n) => n.status === 'emitted')}
            >
              <FileText className="h-4 w-4" />
              {notes.some((n) => n.status === 'emitted') ? 'NFS-e já emitida' : 'Gerar Nova NFS-e'}
            </Button>
          )
        )}
      </div>
    </Modal>
  );
}
