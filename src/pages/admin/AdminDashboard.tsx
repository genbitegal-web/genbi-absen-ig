import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Task, User, ReportItem } from '../../types';
import { Users, FileSpreadsheet, Plus, Download, UploadCloud, CheckCircle, XCircle, Trash2, Loader2, Search, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';

export function AdminDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'TASKS' | 'STUDENTS'>('TASKS');

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('TASKS')}
          className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'TASKS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Manajemen Tugas
        </button>
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'STUDENTS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Data Mahasiswa
        </button>
      </div>

      {activeTab === 'TASKS' ? <TasksTab token={token!} /> : <StudentsTab token={token!} />}
    </div>
  );
}

function TasksTab({ token }: { token: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [reportTask, setReportTask] = useState<number | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null);
  
  // New state for dynamic URLs
  const [taskUrls, setTaskUrls] = useState<string[]>(['']);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const res = await fetch('/api/admin/tasks', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const validUrls = taskUrls.filter(url => url.trim() !== '');
    const payload = {
      title: formData.get('title'),
      description: formData.get('description'),
      igPostUrls: validUrls,
    };
    try {
      await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
      setTaskUrls(['']);
      fetchTasks();
    } catch (err) {
      setErrorMsg('Gagal membuat tugas');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...taskUrls];
    newUrls[index] = value;
    setTaskUrls(newUrls);
  };

  const addUrlField = () => {
    setTaskUrls([...taskUrls, '']);
  };

  const removeUrlField = (index: number) => {
    if (taskUrls.length > 1) {
      const newUrls = [...taskUrls];
      newUrls.splice(index, 1);
      setTaskUrls(newUrls);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    setDeletingTaskId(taskId);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal');
      setConfirmDeleteTask(null);
      fetchTasks();
    } catch (err) {
      setErrorMsg('Gagal menghapus tugas');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      setDeletingTaskId(null);
    }
  };

  if (reportTask) return <TaskReport taskId={reportTask} token={token} onBack={() => setReportTask(null)} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-zinc-100">Daftar Tugas Absensi</h2>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Tugas
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-900/30 border border-red-900 text-red-300 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {showCreate && (
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Judul Tugas</label>
              <input name="title" required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Misal: Like & Komen Postingan Baru" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Deskripsi</label>
              <textarea name="description" required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={3} placeholder="Instruksi detail..."></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">URL / Link Tugas (Bisa Lebih Dari Satu)</label>
              <div className="space-y-2">
                {taskUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <input 
                      type="url" 
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      required={index === 0}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                      placeholder="https://instagram.com/..." 
                    />
                    {taskUrls.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeUrlField(index)}
                        className="px-3 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors border border-red-900/50"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={addUrlField}
                  className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah URL Lainnya
                </button>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium">Batal</button>
              <button type="submit" disabled={isCreating} className="inline-flex items-center px-4 py-2 text-white bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium disabled:opacity-50">
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isCreating ? 'Menyimpan...' : 'Simpan & Umumkan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map(task => (
          <div key={task.id} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm flex flex-col">
            <h3 className="font-semibold text-lg text-zinc-100 line-clamp-1">{task.title}</h3>
            <p className="text-zinc-400 text-sm mt-1 mb-4 flex-1 line-clamp-2">{task.description}</p>
            <div className="flex justify-between items-center text-sm mb-4">
              <span className="text-zinc-500">{new Date(task.createdAt).toLocaleDateString('id-ID')}</span>
              <span className="font-medium text-blue-400">{task._count?.submissions || 0} Pengumpulan</span>
            </div>
            {confirmDeleteTask === task.id ? (
              <div className="flex flex-col space-y-2">
                <p className="text-xs text-red-400 font-medium text-center">Yakin ingin menghapus?</p>
                <div className="flex space-x-2">
                  <button onClick={() => handleDeleteTask(task.id)} disabled={deletingTaskId === task.id} className="flex-1 flex justify-center items-center py-2 bg-red-600/90 text-white hover:bg-red-500 rounded-lg font-medium text-sm transition-colors disabled:opacity-50">
                    {deletingTaskId === task.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Hapus
                  </button>
                  <button onClick={() => setConfirmDeleteTask(null)} disabled={deletingTaskId === task.id} className="flex-1 py-2 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 border border-zinc-700 rounded-lg font-medium text-sm transition-colors disabled:opacity-50">Batal</button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-2">
                <button 
                  onClick={() => setReportTask(task.id)}
                  className="flex-1 py-2 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 border border-zinc-700 rounded-lg font-medium text-sm transition-colors"
                >
                  Lihat Laporan
                </button>
                <button
                  onClick={() => setConfirmDeleteTask(task.id)}
                  className="p-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50 rounded-lg transition-colors"
                  title="Hapus Tugas"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskReport({ taskId, token, onBack }: { taskId: number, token: string, onBack: () => void }) {
  const [report, setReport] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/tasks/${taskId}/report`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setReport(Array.isArray(data.report) ? data.report : []);
        setLoading(false);
      })
      .catch(() => {
        setReport([]);
        setLoading(false);
      });
  }, [taskId, token]);

  const campusStats = useMemo(() => {
    const stats: Record<string, { total: number, uploaded: number }> = {};
    let totalAll = 0;
    let uploadedAll = 0;

    report.forEach(item => {
      if (!stats[item.campus]) {
        stats[item.campus] = { total: 0, uploaded: 0 };
      }
      stats[item.campus].total++;
      totalAll++;
      if (item.hasUploaded) {
        stats[item.campus].uploaded++;
        uploadedAll++;
      }
    });
    return { 
      byCampus: Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0])), 
      totalAll, 
      uploadedAll 
    };
  }, [report]);

  const sortedReport = useMemo(() => {
    return [...report].sort((a, b) => {
      if (a.campus !== b.campus) {
        return a.campus.localeCompare(b.campus);
      }
      if (a.hasUploaded !== b.hasUploaded) {
        return a.hasUploaded ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [report]);

  const handleExport = () => {
    const wsData = [
      ["NPM", "Nama", "Kampus", "Status", "Waktu Pengumpulan"],
      ...sortedReport.map(r => [
        r.npm,
        r.name,
        r.campus,
        r.hasUploaded ? 'Sudah' : 'Belum',
        r.submittedAt ? new Date(r.submittedAt).toLocaleString('id-ID') : '-'
      ])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `laporan_tugas_${taskId}.xlsx`);
  };

  if (loading) return <div className="p-8 text-center">Memuat laporan...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 font-medium">← Kembali</button>
          <h2 className="text-xl font-semibold text-zinc-100">Laporan Absensi</h2>
        </div>
        <button 
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-medium"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1">Total Keseluruhan</p>
          <h3 className="text-2xl font-bold text-zinc-100">{campusStats.uploadedAll} / {campusStats.totalAll}</h3>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full" 
                style={{ width: `${campusStats.totalAll ? Math.round((campusStats.uploadedAll / campusStats.totalAll) * 100) : 0}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium text-blue-400">
              {campusStats.totalAll ? Math.round((campusStats.uploadedAll / campusStats.totalAll) * 100) : 0}%
            </span>
          </div>
        </div>
        {campusStats.byCampus.map(([campus, stats]) => (
          <div key={campus} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-1 line-clamp-1" title={campus}>{campus}</p>
            <h3 className="text-xl font-bold text-zinc-100">{stats.uploaded} / {stats.total}</h3>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full" 
                  style={{ width: `${stats.total ? Math.round((stats.uploaded / stats.total) * 100) : 0}%` }}
                ></div>
              </div>
              <span className="text-xs font-medium text-emerald-400">
                {stats.total ? Math.round((stats.uploaded / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/40 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium text-zinc-400">NPM</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Nama</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Kampus</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Status</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {sortedReport.map(item => (
                <tr key={item.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-zinc-100">{item.npm}</td>
                  <td className="px-6 py-4 text-zinc-400">{item.name}</td>
                  <td className="px-6 py-4 text-zinc-400">{item.campus}</td>
                  <td className="px-6 py-4">
                    {item.hasUploaded ? (
                      <span className="inline-flex items-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3 mr-1" /> Sudah
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3 mr-1" /> Belum
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.proofUrl ? (
                      <a href={item.proofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Lihat Bukti</a>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StudentsTab({ token }: { token: string }) {
  const [students, setStudents] = useState<User[]>([]);
  const [importing, setImporting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<number | null>(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCampus, setFilterCampus] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'az', 'za'

  const showMsg = (text: string, type: 'error'|'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 5000);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const res = await fetch('/api/admin/students', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setStudents(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    setSelectedStudents([]);
  }, [searchQuery, filterCampus, sortOrder]);

  const uniqueCampuses = useMemo(() => {
    const campuses = students.map(s => s.campus).filter(Boolean);
    return Array.from(new Set(campuses)).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(lowerQuery) || 
        s.npm.toLowerCase().includes(lowerQuery)
      );
    }

    if (filterCampus) {
      result = result.filter(s => s.campus === filterCampus);
    }

    if (sortOrder === 'az') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'za') {
      result.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      // newest (assuming newest has higher ID or relies on original order which is from DB)
      result.sort((a, b) => b.id - a.id);
    }

    return result;
  }, [students, searchQuery, filterCampus, sortOrder]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // skip header (assuming first row is header like NPM, Nama, Kampus)
        const parsedStudents = rows.slice(1).map(row => {
          const npm = row[0]?.toString()?.trim();
          const name = row[1]?.toString()?.trim();
          const campus = row[2]?.toString()?.trim();
          if (npm && name && campus) return { npm, name, campus };
          return null;
        }).filter(Boolean);

        if (parsedStudents.length === 0) {
          showMsg('Format Excel tidak valid. Pastikan kolom berurutan: NPM, Nama, Kampus', 'error');
          setImporting(false);
          return;
        }

        const res = await fetch('/api/admin/import-students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ students: parsedStudents })
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Terjadi kesalahan pada server');
        }
        
        showMsg(data.message || 'Import sukses', 'success');
        fetchStudents();
      } catch (err: any) {
        showMsg(err.message || 'Gagal mengimport data. Pastikan file berformat Excel.', 'error');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ["NPM", "Nama", "Kampus"],
      ["1234567", "Budi Santoso", "Universitas A"],
      ["8901234", "Siti Aminah", "Politeknik B"]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template_mahasiswa.xlsx`);
  };

  const handleManualAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAdding(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      npm: formData.get('npm'),
      name: formData.get('name'),
      campus: formData.get('campus'),
    };
    
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddForm(false);
      showMsg('Berhasil menambah mahasiswa', 'success');
      fetchStudents();
    } catch (err: any) {
      showMsg(err.message || 'Gagal menambahkan mahasiswa', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsEditing(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      npm: formData.get('npm'),
      name: formData.get('name'),
      campus: formData.get('campus'),
      password: formData.get('password') || undefined,
    };
    
    try {
      const res = await fetch(`/api/admin/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingStudent(null);
      showMsg('Berhasil memperbarui data mahasiswa', 'success');
      fetchStudents();
    } catch (err: any) {
      showMsg(err.message || 'Gagal memperbarui mahasiswa', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteStudent = async (studentId: number) => {
    setDeletingStudentId(studentId);
    try {
      const res = await fetch(`/api/admin/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal');
      setConfirmDeleteStudent(null);
      setSelectedStudents(prev => prev.filter(id => id !== studentId));
      showMsg('Mahasiswa berhasil dihapus', 'success');
      fetchStudents();
    } catch (err) {
      showMsg('Gagal menghapus mahasiswa', 'error');
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/students/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentIds: selectedStudents })
      });
      if (!res.ok) throw new Error('Gagal');
      setConfirmBulkDelete(false);
      setSelectedStudents([]);
      showMsg(`${selectedStudents.length} Mahasiswa berhasil dihapus`, 'success');
      fetchStudents();
    } catch (err) {
      showMsg('Gagal menghapus mahasiswa terpilih', 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelectStudent = (id: number) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-semibold text-zinc-100">Data Mahasiswa Penerima Beasiswa</h2>
        <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Cari NPM atau Nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
            />
          </div>
          <select 
            value={filterCampus}
            onChange={(e) => setFilterCampus(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm cursor-pointer"
          >
            <option value="">Semua Kampus</option>
            {uniqueCampuses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm cursor-pointer"
          >
            <option value="newest">Terbaru</option>
            <option value="az">Abjad (A-Z)</option>
            <option value="za">Abjad (Z-A)</option>
          </select>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex justify-center items-center px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg hover:bg-zinc-700 text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Manual
          </button>
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
            {importing ? 'Mengimport...' : 'Import Excel'}
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-lg text-sm border ${msg.type === 'error' ? 'bg-red-900/30 border-red-900 text-red-300' : 'bg-green-900/30 border-green-900 text-green-300'}`}>
          {msg.text}
        </div>
      )}
      
      {showAddForm && (
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm">
          <form onSubmit={handleManualAdd} className="space-y-4">
            <h3 className="font-medium text-zinc-100 mb-2">Tambah Mahasiswa Baru</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">NPM</label>
                <input name="npm" required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Masukkan NPM" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Nama Lengkap</label>
                <input name="name" required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Masukkan Nama" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Kampus</label>
                <input name="campus" required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Misal: UPS Tegal" />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium transition-colors">Batal</button>
              <button type="submit" disabled={isAdding} className="inline-flex items-center px-4 py-2 text-white bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isAdding ? 'Menyimpan...' : 'Simpan Mahasiswa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingStudent && (
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <h3 className="font-medium text-zinc-100 mb-2">Edit Mahasiswa</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">NPM</label>
                <input name="npm" defaultValue={editingStudent.npm} required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Nama Lengkap</label>
                <input name="name" defaultValue={editingStudent.name} required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Kampus</label>
                <input name="campus" defaultValue={editingStudent.campus} required className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Password Baru (Opsional)</label>
                <input name="password" type="password" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Kosongkan jika tidak diubah" />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setEditingStudent(null)} className="px-4 py-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium transition-colors">Batal</button>
              <button type="submit" disabled={isEditing} className="inline-flex items-center px-4 py-2 text-white bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {isEditing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-blue-900/20 p-4 rounded-lg text-sm text-blue-400 flex items-start border border-blue-900/30">
        <FileSpreadsheet className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium mb-1">Panduan Import Data</p>
          <p>Unggah file berformat Excel (.xlsx) dengan kolom pertama untuk NPM, kolom kedua untuk Nama, dan kolom ketiga untuk Kampus (Beri header pada baris pertama).</p>
          <p className="mt-1">Akun akan dibuat otomatis dengan password bawaan <code className="bg-blue-900/40 px-1 py-0.5 rounded text-blue-300">12345</code>.</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="ml-4 inline-flex items-center px-3 py-1.5 bg-blue-900/40 text-blue-300 hover:text-blue-200 hover:bg-blue-900/60 rounded border border-blue-900/50 text-xs font-medium transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Template Excel
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {selectedStudents.length > 0 && (
          <div className="bg-zinc-800/50 p-4 flex items-center justify-between border-b border-zinc-800">
            <span className="text-sm font-medium text-zinc-300">
              {selectedStudents.length} Mahasiswa Terpilih
            </span>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setSelectedStudents([])}
                className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                disabled={isBulkDeleting}
              >
                Batal
              </button>
              {confirmBulkDelete ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-red-400">Yakin hapus terpilih?</span>
                  <button 
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                    className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isBulkDeleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                    Ya, Hapus
                  </button>
                  <button 
                    onClick={() => setConfirmBulkDelete(false)}
                    disabled={isBulkDeleting}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmBulkDelete(true)}
                  className="inline-flex items-center px-3 py-1.5 bg-red-900/40 text-red-400 border border-red-900/50 hover:bg-red-900/60 rounded text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Hapus Terpilih
                </button>
              )}
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/40 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox"
                    className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
                    checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 font-medium text-zinc-400">NPM</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Nama</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Kampus</th>
                <th className="px-6 py-4 font-medium text-zinc-400 w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredStudents.map(student => (
                <tr key={student.id} className={`hover:bg-white/5 transition-colors ${selectedStudents.includes(student.id) ? 'bg-blue-900/10' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox"
                      className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleSelectStudent(student.id)}
                    />
                  </td>
                  <td className="px-6 py-4 text-zinc-100 font-medium">{student.npm}</td>
                  <td className="px-6 py-4 text-zinc-400">{student.name}</td>
                  <td className="px-6 py-4 text-zinc-400">{student.campus}</td>
                  <td className="px-6 py-4">
                    {confirmDeleteStudent === student.id ? (
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleDeleteStudent(student.id)} disabled={deletingStudentId === student.id} className="inline-flex items-center px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-50">
                          {deletingStudentId === student.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          Hapus
                        </button>
                        <button onClick={() => setConfirmDeleteStudent(null)} disabled={deletingStudentId === student.id} className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50">Batal</button>
                      </div>
                    ) : (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => { setEditingStudent(student); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-blue-900/20 transition-colors"
                          title="Edit Mahasiswa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteStudent(student.id)}
                          className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/20 transition-colors"
                          title="Hapus Mahasiswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    {students.length === 0 
                      ? 'Belum ada data mahasiswa. Silakan import dari Excel.'
                      : 'Data tidak ditemukan.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
