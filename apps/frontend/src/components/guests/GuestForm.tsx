'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Guest } from '@/lib/types';

const schema = z.object({
  fullName:    z.string().min(2, 'Mínimo 2 caracteres.').max(120),
  cpfPassport: z.string().min(5, 'Mínimo 5 caracteres.').max(20),
  email:       z.string().email('E-mail inválido.').optional().or(z.literal('')),
  phone:       z.string().max(20).optional(),
  nationality: z.string().max(60).optional(),
  birthDate:   z.string().optional(),
  address:     z.string().max(300).optional(),
  notes:       z.string().max(500).optional(),
});

export type GuestFormData = z.infer<typeof schema>;

interface GuestFormProps {
  defaultValues?: Partial<Guest>;
  onSubmit: (data: GuestFormData) => Promise<unknown>;
  onCancel: () => void;
  loading?: boolean;
}

export function GuestForm({ defaultValues, onSubmit, onCancel, loading }: GuestFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<GuestFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName:    defaultValues?.fullName    ?? '',
      cpfPassport: defaultValues?.cpfPassport ?? '',
      email:       defaultValues?.email       ?? '',
      phone:       defaultValues?.phone       ?? '',
      nationality: defaultValues?.nationality ?? '',
      address:     defaultValues?.address     ?? '',
      notes:       defaultValues?.notes       ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input {...register('fullName')} id="fullName" label="Nome Completo *" placeholder="João da Silva" error={errors.fullName?.message} />
        </div>
        <Input {...register('cpfPassport')} id="cpfPassport" label="CPF / Passaporte *" placeholder="000.000.000-00" error={errors.cpfPassport?.message} />
        <Input {...register('birthDate')} id="birthDate" label="Data de Nascimento" type="date" error={errors.birthDate?.message} />
        <Input {...register('email')} id="email" label="E-mail" type="email" placeholder="joao@email.com" error={errors.email?.message} />
        <Input {...register('phone')} id="phone" label="Telefone" placeholder="(11) 9 0000-0000" error={errors.phone?.message} />
        <Input {...register('nationality')} id="nationality" label="Nacionalidade" placeholder="Brasileira" error={errors.nationality?.message} />
        <div className="sm:col-span-2">
          <Input {...register('address')} id="address" label="Endereço" placeholder="Rua, número, cidade" error={errors.address?.message} />
        </div>
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Observações</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            placeholder="Alergias, preferências, etc."
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" loading={loading}>Salvar</Button>
      </div>
    </form>
  );
}
