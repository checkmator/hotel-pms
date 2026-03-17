'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Pencil, UserX, UserCheck, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { usersService } from '@/services/users.service';
import type { StaffUser, UserRole } from '@/lib/types';

// ── Schemas ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  name:     z.string().min(2, 'Mínimo 2 caracteres.').max(120),
  email:    z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres.'),
  role:     z.enum(['admin', 'reception', 'housekeeping'] as const),
});

const editSchema = z.object({
  name:     z.string().min(2).max(120).optional(),
  email:    z.string().email('E-mail inválido.').optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres.').optional().or(z.literal('')),
  role:     z.enum(['admin', 'reception', 'housekeeping'] as const).optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

const ROLE_LABELS: Record<UserRole, string> = {
  admin:        'Administrador',
  reception:    'Recepção',
  housekeeping: 'Governança',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin:        'bg-purple-100 text-purple-700',
  reception:    'bg-blue-100 text-blue-700',
  housekeeping: 'bg-green-100 text-green-700',
};

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'reception' },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => usersService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); reset(); onClose(); },
  });

  return (
    <Modal open={open} onClose={onClose} title="Novo Funcionário">
      <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="space-y-4">
        <Input {...register('name')}     id="name"     label="Nome Completo *"  placeholder="João da Silva"   error={errors.name?.message} />
        <Input {...register('email')}    id="email"    label="E-mail *"         type="email" placeholder="joao@hotel.com" error={errors.email?.message} />
        <Input {...register('password')} id="password" label="Senha *"          type="password" placeholder="Min. 8 caracteres" error={errors.password?.message} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Função *</label>
          <select
            {...register('role')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="reception">Recepção</option>
            <option value="housekeeping">Governança</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar usuário.'}</p>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending}>Criar</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditUserModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema) as never,
    defaultValues: { name: user.name, email: user.email, role: user.role, password: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: EditForm) => {
      const payload: EditForm = { ...data };
      if (!payload.password) delete payload.password;
      return usersService.update(user.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
  });

  return (
    <Modal open onClose={onClose} title={`Editar — ${user.name}`}>
      <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="space-y-4">
        <Input {...register('name')}     id="name"     label="Nome Completo"  placeholder={user.name}   error={errors.name?.message} />
        <Input {...register('email')}    id="email"    label="E-mail"         type="email" placeholder={user.email} error={errors.email?.message} />
        <Input {...register('password')} id="password" label="Nova Senha"     type="password" placeholder="Deixe em branco para manter" error={errors.password?.message} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Função</label>
          <select
            {...register('role')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="reception">Recepção</option>
            <option value="housekeeping">Governança</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao salvar.'}</p>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = useState('');
  const [page]                      = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing]       = useState<StaffUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, page],
    queryFn:  () => usersService.list({ search, page, limit: 20 }),
  });

  const toggleActive = useMutation<void, Error, { id: string; active: boolean }>({
    mutationFn: async ({ id, active }) => {
      if (active) {
        await usersService.deactivate(id);
      } else {
        await usersService.update(id, { active: true });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Funcionários" subtitle="Gerencie os usuários do sistema" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Funcionário
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Nome', 'E-mail', 'Função', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Carregando...</td></tr>
              )}
              {!isLoading && data?.data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Nenhum funcionário encontrado.</td></tr>
              )}
              {data?.data.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                      <ShieldCheck className="h-3 w-3" />
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditing(u)}
                        title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, active: u.active })}
                        title={u.active ? 'Desativar' : 'Reativar'}
                        className={`p-1.5 rounded-lg transition-colors ${u.active ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                      >
                        {u.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.meta.total > 20 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              {data.meta.total} funcionários no total
            </div>
          )}
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
