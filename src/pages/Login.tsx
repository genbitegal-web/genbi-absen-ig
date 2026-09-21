import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

export function Login() {
  const [npm, setNpm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npm, password }),
      });

      let data: any = null;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(
            res.status === 500
              ? 'Gagal terhubung ke database atau server Vercel. Pastikan Environment Variables DATABASE_URL telah disimpan dan dideploy di Vercel.'
              : text || `Terjadi kesalahan pada server (${res.status})`
          );
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Login gagal');
      }

      login(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/student');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-zinc-900 rounded-xl shadow-lg border border-zinc-800 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/20 mb-4">
            <LogIn className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100">Selamat Datang</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Silakan login untuk mengakses portal presensi GenBI Tegal.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              NPM / Username
            </label>
            <input
              type="text"
              required
              value={npm}
              onChange={(e) => setNpm(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="Masukkan NPM Anda"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Kata Sandi
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800/50 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-zinc-900 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Memproses...' : 'Masuk ke Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
