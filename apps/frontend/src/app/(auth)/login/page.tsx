'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Hotel, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'Mínimo 6 caracteres.'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await login(data.email, data.password);
      router.push('/map');
    } catch {
      setError('E-mail ou senha incorretos.');
    }
  };

  const bypassLogin = () => {
    const fakeUser = { id: 'bypass', name: 'Admin Geral', email: 'admin@hotel.com', role: 'admin' };
    document.cookie = 'hotel_token=bypass-token; path=/; max-age=86400';
    document.cookie = `hotel_user=${encodeURIComponent(JSON.stringify(fakeUser))}; path=/; max-age=86400`;
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
              <Hotel className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Hotel PMS</h1>
            <p className="text-sm text-gray-500 mt-1">Sistema de Gestão Hoteleira</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-8 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                {...register('email')}
                id="email"
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                className="pl-9"
                error={errors.email?.message}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-8 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                {...register('password')}
                id="password"
                label="Senha"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="pl-9"
                error={errors.password?.message}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Entrar
            </Button>
          </form>

          <button
            type="button"
            onClick={bypassLogin}
            className="mt-4 w-full rounded-lg border border-dashed border-orange-300 bg-orange-50 py-2 text-sm text-orange-700 hover:bg-orange-100 transition-colors"
          >
            ⚡ Acesso direto (temporário)
          </button>

          {/* Demo credentials */}
          <div className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600 mb-2">Credenciais de acesso:</p>
            <p>🔑 admin@hotel.com · Admin@123</p>
            <p>🔑 recepcao@hotel.com · Recep@123</p>
            <p>🔑 camareira@hotel.com · Casa@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
