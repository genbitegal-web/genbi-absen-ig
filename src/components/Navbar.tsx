import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-[#0d0d0d] border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-xs mr-3 text-white">BI</div>
            <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
              PRESENSI GENBI TEGAL
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center text-sm text-zinc-300">
              <UserIcon className="w-4 h-4 mr-2" />
              <span className="font-medium">{user.name}</span>
              <span className="mx-2 text-zinc-700">|</span>
              <span className="text-zinc-500">{user.campus}</span>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center px-4 py-2 border border-red-900/50 text-sm font-medium rounded-md text-red-400 bg-red-900/20 hover:bg-red-900/40 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-[#0d0d0d]"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
