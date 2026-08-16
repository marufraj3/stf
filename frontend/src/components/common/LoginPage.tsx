import React, { useState } from 'react';
import { Building2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { login } from '../../services/auth';

type LoginFields = {
  email: string;
  password: string;
};

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async values => {
    setError('');
    try {
      await login(values.email, values.password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to login');
    }
  });

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="bg-[#12243d] px-8 py-7 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500 p-3"><Building2 size={28} /></div>
            <div>
              <h1 className="text-xl font-bold">STF Group ERP</h1>
              <p className="text-sm text-slate-300">Document Expiry Management</p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5 p-8">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="text-orange-500" size={18} />
            Secure administrator sign in
          </div>
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</span>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                type="email"
                autoComplete="username"
                {...register('email', {
                  required: 'Email is required.',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' },
                })}
              />
            </div>
            {errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email.message}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Password</span>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                type="password"
                autoComplete="current-password"
                {...register('password', { required: 'Password is required.' })}
              />
            </div>
            {errors.password && <span className="mt-1 block text-xs text-red-600">{errors.password.message}</span>}
          </label>
          <button disabled={isSubmitting} className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 disabled:opacity-60">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
