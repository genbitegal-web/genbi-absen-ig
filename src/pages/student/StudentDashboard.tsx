import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudentTask, Notification } from '../../types';
import { Bell, Upload, CheckCircle, ExternalLink, Clock } from 'lucide-react';

export function StudentDashboard() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, notifRes] = await Promise.all([
        fetch('/api/student/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/student/notifications', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const tasksData = await tasksRes.json();
      const notifData = await notifRes.json();
      setTasks(tasksData);
      setNotifications(notifData);
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (taskId: number, file: File) => {
    setUploadingId(taskId);
    const formData = new FormData();
    formData.append('proof', file);

    try {
      const res = await fetch(`/api/student/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Gagal mengunggah bukti');
      }
    } catch (error) {
      console.error('Error uploading', error);
      alert('Terjadi kesalahan saat mengunggah');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) return <div className="text-center p-8">Memuat data...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-2xl font-bold text-zinc-100 mb-6">Daftar Tugas</h2>
        {tasks.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-8 text-center text-zinc-500 border border-zinc-800">
            Belum ada tugas saat ini.
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-100">{task.title}</h3>
                  <p className="text-zinc-400 mt-1 text-sm">{task.description}</p>
                </div>
                {task.hasUploaded ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Selesai
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="w-4 h-4 mr-1.5" />
                    Pending
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <a 
                  href={task.igPostUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 flex justify-center items-center px-4 py-2 bg-zinc-800/50 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Buka Postingan IG
                </a>
                
                {!task.hasUploaded && (
                  <label className="flex-1 flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingId === task.id ? 'Mengunggah...' : 'Unggah Bukti'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUpload(task.id, e.target.files[0]);
                      }}
                      disabled={uploadingId === task.id}
                    />
                  </label>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="lg:col-span-1">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden sticky top-24">
          <div className="p-4 bg-[#0d0d0d] border-b border-zinc-800 flex items-center">
            <Bell className="w-5 h-5 text-zinc-500 mr-2" />
            <h3 className="font-semibold text-zinc-100">Pemberitahuan</h3>
          </div>
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">Belum ada pemberitahuan</p>
            ) : (
              <div className="space-y-4">
                {notifications.map(notif => (
                  <div key={notif.id} className="p-3 bg-gradient-to-br from-blue-900/20 to-zinc-900 border border-blue-900/30 rounded-lg">
                    <p className="text-sm text-zinc-100">{notif.message}</p>
                    <p className="text-xs text-zinc-400 mt-2">
                      {new Date(notif.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
