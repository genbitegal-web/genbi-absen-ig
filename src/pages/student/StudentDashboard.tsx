import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudentTask, Notification } from '../../types';
import { optimizeImageForUpload } from '../../utils/imageOptimizer';
import { 
  Bell, 
  Upload, 
  CheckCircle, 
  ExternalLink, 
  Clock, 
  Loader2, 
  Eye, 
  Trash2, 
  Send, 
  X, 
  AlertCircle, 
  ImageIcon, 
  Check,
  RefreshCw,
  Lock,
  RotateCcw,
  Youtube,
  Instagram,
  Play,
  Video
} from 'lucide-react';
import { 
  isYouTubeUrl, 
  isInstagramUrl, 
  getYouTubeThumbnail, 
  detectPlatform, 
  getLinkActionLabel 
} from '../../utils/platformHelper';

export function StudentDashboard() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<number | null>(null);
  const [unsubmittingId, setUnsubmittingId] = useState<number | null>(null);

  // Platform filter
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'YOUTUBE' | 'INSTAGRAM'>('ALL');

  // Modal preview photo state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; linkNumber?: number; isYouTube?: boolean } | null>(null);

  // Modal confirmation before submit
  const [confirmSubmitTask, setConfirmSubmitTask] = useState<StudentTask | null>(null);

  // Status / toast message
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [tasksRes, notifRes] = await Promise.all([
        fetch('/api/student/tasks', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/student/notifications', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const tasksData = await tasksRes.json();
      const notifData = await notifRes.json();
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setNotifications(Array.isArray(notifData) ? notifData : []);
    } catch (error) {
      console.error('Error fetching data', error);
      setTasks([]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (taskId: number, linkIndex: number, file: File) => {
    setUploadingId(`${taskId}-${linkIndex}`);

    try {
      // Automatically optimize / compress image (including iPhone HEIC / high-res photos)
      const processedFile = await optimizeImageForUpload(file);

      const formData = new FormData();
      formData.append('proof', processedFile);
      formData.append('linkIndex', linkIndex.toString());

      const res = await fetch(`/api/student/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        showToast('Foto bukti berhasil diunggah! Silakan cek kembali atau tekan Submit bila sudah benar.');
        await fetchData();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Gagal mengunggah bukti', 'error');
      }
    } catch (error) {
      console.error('Error uploading', error);
      showToast('Terjadi kesalahan saat mengunggah', 'error');
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveProof = async (taskId: number, linkIndex: number) => {
    if (!window.confirm('Yakin ingin menghapus foto bukti ini?')) return;
    setDeletingId(`${taskId}-${linkIndex}`);
    try {
      const res = await fetch(`/api/student/tasks/${taskId}/remove-proof`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ linkIndex })
      });
      if (res.ok) {
        showToast('Foto bukti berhasil dihapus');
        await fetchData();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Gagal menghapus bukti', 'error');
      }
    } catch (error) {
      console.error('Error removing proof', error);
      showToast('Terjadi kesalahan saat menghapus bukti', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFinalizeSubmit = async (taskId: number) => {
    setFinalizingId(taskId);
    try {
      const res = await fetch(`/api/student/tasks/${taskId}/finalize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Tugas presensi berhasil dikirimkan!');
        setConfirmSubmitTask(null);
        await fetchData();
      } else {
        showToast(data.error || 'Gagal mengirim tugas', 'error');
      }
    } catch (error) {
      console.error('Error finalizing task', error);
      showToast('Terjadi kesalahan saat mengirim tugas', 'error');
    } finally {
      setFinalizingId(null);
    }
  };

  const handleUnsubmit = async (taskId: number) => {
    if (!window.confirm('Batalkan submit tugas ini? Anda dapat mengganti foto bukti dan mengirimkannya kembali sebelum batas waktu berakhir.')) {
      return;
    }
    setUnsubmittingId(taskId);
    try {
      const res = await fetch(`/api/student/tasks/${taskId}/unsubmit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Submit tugas berhasil dibatalkan. Anda dapat mengganti foto bukti.');
        setConfirmSubmitTask(null);
        await fetchData();
      } else {
        showToast(data.error || 'Gagal membatalkan submit', 'error');
      }
    } catch (error) {
      console.error('Error unsubmitting task', error);
      showToast('Terjadi kesalahan saat membatalkan submit', 'error');
    } finally {
      setUnsubmittingId(null);
    }
  };

  if (loading) return <div className="text-center p-8 text-zinc-400">Memuat data tugas...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-950/95 text-emerald-200 border-emerald-800 shadow-emerald-950/50' 
            : 'bg-red-950/95 text-red-200 border-red-800 shadow-red-950/50'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Main Task List */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">Daftar Tugas Presensi</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Selesaikan tugas YouTube & Instagram, lalu unggah bukti screenshot untuk verifikasi presensi</p>
          </div>
          <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg shrink-0">
            {tasks.filter(t => t.submission?.status === 'SUBMITTED').length} dari {tasks.length} Selesai
          </span>
        </div>

        {/* Platform Category Filter */}
        <div className="flex items-center gap-2 pb-1 overflow-x-auto">
          <span className="text-xs text-zinc-400 font-medium mr-1">Filter Kategori:</span>
          <button
            type="button"
            onClick={() => setPlatformFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              platformFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Semua ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter('YOUTUBE')}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              platformFilter === 'YOUTUBE'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 mr-1.5 text-red-500" />
            YouTube ({tasks.filter(t => (t.platform || detectPlatform(t.igPostUrls && t.igPostUrls.length > 0 ? t.igPostUrls : (t.igPostUrl ? [t.igPostUrl] : []))) === 'YOUTUBE').length})
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter('INSTAGRAM')}
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              platformFilter === 'INSTAGRAM'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Instagram className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
            Instagram ({tasks.filter(t => (t.platform || detectPlatform(t.igPostUrls && t.igPostUrls.length > 0 ? t.igPostUrls : (t.igPostUrl ? [t.igPostUrl] : []))) === 'INSTAGRAM').length})
          </button>
        </div>

        {(() => {
          const filteredTasks = tasks.filter(task => {
            const p = task.platform || detectPlatform(task.igPostUrls && task.igPostUrls.length > 0 ? task.igPostUrls : (task.igPostUrl ? [task.igPostUrl] : []));
            if (platformFilter === 'ALL') return true;
            return p === platformFilter;
          });

          if (filteredTasks.length === 0) {
            return (
              <div className="bg-zinc-900 rounded-xl p-8 text-center text-zinc-500 border border-zinc-800">
                {tasks.length === 0 
                  ? 'Belum ada tugas presensi saat ini.' 
                  : 'Tidak ada tugas pada kategori yang dipilih.'}
              </div>
            );
          }

          return filteredTasks.map(task => {
            const urls = task.igPostUrls && task.igPostUrls.length > 0 
              ? task.igPostUrls 
              : (task.igPostUrl ? [task.igPostUrl] : []);
            
            const totalLinks = urls.length > 0 ? urls.length : 1;
            const proofUrls = task.submission?.proofUrls || [];
            const uploadedCount = proofUrls.filter(url => Boolean(url && url.trim())).length;
            const isAllUploaded = uploadedCount >= totalLinks;
            const isSubmitted = task.submission?.status === 'SUBMITTED';

            const now = new Date();
            const isPassedDeadline = task.deadline ? now > new Date(task.deadline) : false;
            const isTaskClosed = task.isClosed || !task.isOpen || isPassedDeadline;
            const taskPlatform = task.platform || detectPlatform(urls);

            const firstYtUrl = urls.find(isYouTubeUrl);
            const firstYtThumb = firstYtUrl ? getYouTubeThumbnail(firstYtUrl) : null;

            return (
              <div key={task.id} className={`bg-zinc-900 p-6 rounded-xl border transition-all ${
                isTaskClosed && !isSubmitted ? 'border-red-900/40 bg-zinc-900/90' : 'border-zinc-800 hover:border-zinc-700/80'
              } shadow-sm`}>
                {/* Task Header */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {taskPlatform === 'YOUTUBE' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          <Youtube className="w-3.5 h-3.5 mr-1 text-red-500" />
                          YouTube
                        </span>
                      ) : taskPlatform === 'INSTAGRAM' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          <Instagram className="w-3.5 h-3.5 mr-1 text-pink-400" />
                          Instagram
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Video className="w-3.5 h-3.5 mr-1 text-purple-400" />
                          Campuran
                        </span>
                      )}
                      <h3 className="text-xl font-semibold text-zinc-100">{task.title}</h3>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">{task.description}</p>
                  </div>
                  <div className="shrink-0">
                    {isSubmitted ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Selesai Disubmit
                      </span>
                    ) : isTaskClosed ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">
                        <Lock className="w-3.5 h-3.5 mr-1.5" />
                        Ditutup
                      </span>
                    ) : isAllUploaded ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        Siap Disubmit
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        {uploadedCount}/{totalLinks} Bukti
                      </span>
                    )}
                  </div>
                </div>

                {/* YouTube Video Featured Banner if available */}
                {firstYtThumb && (
                  <a
                    href={firstYtUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative my-4 rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-video max-h-48 group cursor-pointer shadow-lg"
                    title="Buka dan tonton video YouTube"
                  >
                    <img 
                      src={firstYtThumb} 
                      alt="Thumbnail Video YouTube" 
                      className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 px-2.5 py-1 bg-red-600/90 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-md">
                      <Youtube className="w-3.5 h-3.5" />
                      Video YouTube
                    </div>
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/80 rounded-md text-xs text-zinc-200 flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5 text-red-400" />
                      Tonton di YouTube
                    </div>
                  </a>
                )}

                {/* Deadline Info Bar */}
                {task.deadline && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 border ${
                    isPassedDeadline 
                      ? 'bg-red-950/30 border-red-900/50 text-red-300' 
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                  }`}>
                    <Clock className={`w-3.5 h-3.5 ${isPassedDeadline ? 'text-red-400' : 'text-blue-400'} shrink-0`} />
                    <span>
                      Batas Waktu Pengumpulan: <strong>{new Date(task.deadline).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })} WIB</strong>
                    </span>
                    {isPassedDeadline && <span className="font-semibold text-red-400 ml-auto">(Waktu Telah Habis)</span>}
                  </div>
                )}

                {/* Notice if task is closed and not submitted */}
                {isTaskClosed && !isSubmitted && (
                  <div className="p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300 flex items-start gap-2.5 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-200">Pengumpulan Tugas Telah Ditutup</p>
                      <p className="text-red-300/90 mt-0.5">
                        Tugas ini telah ditutup oleh Admin atau telah melewati batas waktu yang ditentukan. Anda tidak dapat mengunggah atau mengubah bukti pengumpulan lagi.
                      </p>
                    </div>
                  </div>
                )}

                {/* Link & Upload Rows */}
                <div className="space-y-3 mt-4">
                  {urls.map((url, i) => {
                    const hasProof = Boolean(proofUrls[i] && proofUrls[i].trim());
                    const currentProofUrl = proofUrls[i] || '';
                    const isUploadingThis = uploadingId === `${task.id}-${i}`;
                    const isDeletingThis = deletingId === `${task.id}-${i}`;
                    const isYT = isYouTubeUrl(url);
                    const isIG = isInstagramUrl(url);
                    const ytThumb = isYT ? getYouTubeThumbnail(url) : null;

                    return (
                      <div 
                        key={i} 
                        className={`p-3.5 rounded-xl border transition-all ${
                          hasProof 
                            ? 'bg-zinc-950/60 border-zinc-800/90' 
                            : isYT
                            ? 'bg-red-950/10 border-red-900/30'
                            : 'bg-zinc-900/90 border-zinc-800/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Post / Video Link Button */}
                          <div>
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors group ${
                                isYT 
                                  ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/30' 
                                  : 'bg-pink-600/10 text-pink-400 hover:bg-pink-600/20 border border-pink-600/30'
                              }`}
                            >
                              {isYT ? (
                                <Youtube className="w-4 h-4 mr-2 text-red-500 shrink-0" />
                              ) : (
                                <Instagram className="w-4 h-4 mr-2 text-pink-400 shrink-0" />
                              )}
                              <span>
                                {isYT ? `Buka Video YouTube ${urls.length > 1 ? `#${i + 1}` : ''}` : `Buka Postingan IG ${urls.length > 1 ? `#${i + 1}` : ''}`}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-70 group-hover:opacity-100" />
                            </a>
                            <p className="text-[11px] text-zinc-400 mt-1.5">
                              {isYT 
                                ? 'Tonton video, beri Like, tinggalkan Komentar (Nama & NPM), lalu unggah screenshot bukti.' 
                                : 'Buka postingan, berikan Like & tinggalkan Komentar, lalu unggah screenshot bukti.'}
                            </p>
                          </div>

                          {/* Proof Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {hasProof ? (
                              <div className="flex items-center gap-2 bg-zinc-900 px-2 py-1.5 rounded-lg border border-zinc-800">
                                {/* Thumbnail Image */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ url: currentProofUrl, title: task.title, linkNumber: i + 1, isYouTube: isYT })}
                                  className="relative group w-9 h-9 rounded-md overflow-hidden bg-black/50 border border-zinc-700 shrink-0 cursor-pointer"
                                  title="Klik untuk memperbesar foto bukti"
                                >
                                  <img 
                                    src={currentProofUrl} 
                                    alt={`Bukti #${i + 1}`} 
                                    className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                    <Eye className="w-3.5 h-3.5 text-white" />
                                  </div>
                                </button>

                                {/* Check / Preview Button */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ url: currentProofUrl, title: task.title, linkNumber: i + 1, isYouTube: isYT })}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Cek Foto
                                </button>

                                {/* Replace / Re-upload Button (Allowed as long as task is not closed) */}
                                {!isTaskClosed && (
                                  <label className={`inline-flex items-center px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors cursor-pointer ${isUploadingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {isUploadingThis ? (
                                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-blue-400" />
                                    ) : (
                                      <RefreshCw className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                                    )}
                                    Ganti
                                    <input 
                                      type="file" 
                                      accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleUpload(task.id, i, file);
                                        }
                                        e.target.value = '';
                                      }}
                                      disabled={isUploadingThis}
                                    />
                                  </label>
                                )}

                                {/* Delete Proof Button (Allowed as long as task is not closed) */}
                                {!isTaskClosed && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProof(task.id, i)}
                                    disabled={isDeletingThis}
                                    title="Hapus foto bukti ini"
                                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    {isDeletingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>
                            ) : isTaskClosed ? (
                              /* Closed badge for missing proof */
                              <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-zinc-500 bg-zinc-800/80 border border-zinc-700/50 rounded-lg">
                                <Lock className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
                                Pengumpulan Ditutup
                              </span>
                            ) : (
                              /* Upload Button */
                              <label className={`inline-flex items-center px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-colors cursor-pointer ${isUploadingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                                {isUploadingThis ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                {isUploadingThis 
                                  ? 'Memproses & Mengunggah...' 
                                  : isYT
                                  ? `Unggah Bukti Video ${urls.length > 1 ? `#${i + 1}` : ''}`
                                  : `Unggah Bukti IG ${urls.length > 1 ? `#${i + 1}` : ''}`}
                                <input 
                                  type="file" 
                                  accept="image/*,.heic,.heif,.jpg,.jpeg,.png,.webp" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUpload(task.id, i, file);
                                    }
                                    e.target.value = '';
                                  }}
                                  disabled={isUploadingThis}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Task Footer & Final Submit Button */}
                <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      isSubmitted 
                        ? 'bg-emerald-400' 
                        : isTaskClosed 
                        ? 'bg-red-400' 
                        : isAllUploaded 
                        ? 'bg-blue-400' 
                        : 'bg-amber-400'
                    }`} />
                    {isSubmitted 
                      ? (!isTaskClosed
                          ? 'Tugas telah disubmit. Anda dapat mengganti foto bukti atau membatalkan submit jika perlu.'
                          : 'Tugas ini telah Anda selesaikan dan pengumpulan telah ditutup.')
                      : isTaskClosed 
                      ? 'Batas waktu pengumpulan telah berakhir.' 
                      : isAllUploaded 
                      ? 'Semua foto bukti telah terisi. Pastikan foto sudah benar sebelum mengirim.'
                      : `Belum lengkap: baru ${uploadedCount} dari ${totalLinks} foto bukti yang diunggah.`
                    }
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View All Submitted Proofs button if already submitted */}
                    {isSubmitted ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setConfirmSubmitTask(task)}
                          className="inline-flex items-center px-3.5 py-2 text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                          Cek Semua Bukti
                        </button>

                        {!isTaskClosed && (
                          <button
                            type="button"
                            onClick={() => handleUnsubmit(task.id)}
                            disabled={unsubmittingId === task.id}
                            className="inline-flex items-center px-3.5 py-2 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                            title="Batalkan submit tugas ini untuk mengganti foto bukti"
                          >
                            {unsubmittingId === task.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-amber-400" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                            )}
                            {unsubmittingId === task.id ? 'Membatalkan...' : 'Batalkan Submit'}
                          </button>
                        )}

                        <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Terkirim
                        </span>
                      </div>
                    ) : isTaskClosed ? (
                      <span className="inline-flex items-center px-3.5 py-2 text-xs font-medium bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 rounded-lg">
                        <Lock className="w-3.5 h-3.5 mr-1.5" />
                        Tidak Dapat Disubmit
                      </span>
                    ) : (
                      /* Final Submit Button */
                      <button
                        type="button"
                        onClick={() => setConfirmSubmitTask(task)}
                        disabled={!isAllUploaded || finalizingId === task.id}
                        className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-md ${
                          isAllUploaded 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/20 cursor-pointer' 
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                        }`}
                      >
                        {finalizingId === task.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {finalizingId === task.id ? 'Mengirim...' : 'Submit & Konfirmasi Tugas'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Notifications Sidebar */}
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

      {/* MODAL 1: Full Photo Lightbox / Preview Dialog */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80">
              <div>
                <h4 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  {previewPhoto.isYouTube ? (
                    <Youtube className="w-4 h-4 text-red-500" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                  )}
                  Foto Bukti {previewPhoto.isYouTube ? 'Video YouTube' : 'Postingan IG'} {previewPhoto.linkNumber ? `#${previewPhoto.linkNumber}` : ''}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{previewPhoto.title}</p>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Image Viewer */}
            <div className="p-4 bg-black/90 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
              <img 
                src={previewPhoto.url} 
                alt="Foto Bukti" 
                className="max-h-[60vh] max-w-full object-contain rounded-lg border border-zinc-800"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/80 flex justify-between items-center">
              <a 
                href={previewPhoto.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center text-xs text-blue-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Buka Resolusi Penuh di Tab Baru
              </a>
              <button 
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors border border-zinc-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Final Review & Submit Confirmation Dialog */}
      {confirmSubmitTask && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setConfirmSubmitTask(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-100">
                    {confirmSubmitTask.submission?.status === 'SUBMITTED' 
                      ? 'Detail Bukti Pengumpulan Tugas' 
                      : 'Periksa & Konfirmasi Pengumpulan'}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{confirmSubmitTask.title}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setConfirmSubmitTask(null)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content: Gallery of all proof photos */}
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm text-zinc-300">
                {confirmSubmitTask.submission?.status === 'SUBMITTED'
                  ? 'Foto bukti yang telah Anda kirimkan untuk tugas ini:'
                  : 'Silakan cek kembali foto bukti yang telah Anda unggah sebelum dikirim ke Admin:'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {((confirmSubmitTask.igPostUrls && confirmSubmitTask.igPostUrls.length > 0 
                  ? confirmSubmitTask.igPostUrls 
                  : (confirmSubmitTask.igPostUrl ? [confirmSubmitTask.igPostUrl] : [])
                )).map((_, idx) => {
                  const proofUrl = confirmSubmitTask.submission?.proofUrls?.[idx];
                  return (
                    <div 
                      key={idx} 
                      className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl flex flex-col items-center gap-2 text-center"
                    >
                      <span className="text-xs font-medium text-zinc-400">
                        Bukti Postingan #{idx + 1}
                      </span>
                      {proofUrl ? (
                        <div className="relative group w-full h-36 rounded-lg overflow-hidden bg-black/60 border border-zinc-800">
                          <img 
                            src={proofUrl} 
                            alt={`Bukti #${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto({ url: proofUrl, title: confirmSubmitTask.title, linkNumber: idx + 1 })}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium gap-1.5"
                          >
                            <Eye className="w-4 h-4" />
                            Perbesar
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-36 rounded-lg border border-dashed border-red-800/50 bg-red-950/20 flex flex-col items-center justify-center text-red-400 text-xs">
                          <AlertCircle className="w-5 h-5 mb-1" />
                          Belum Diunggah
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {confirmSubmitTask.submission?.status === 'SUBMITTED' ? (
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Tugas ini sudah berstatus <strong>Selesai Disubmit</strong>. Jika Anda ingin mengganti foto bukti, Anda dapat menekan tombol <strong>"Batalkan Submit"</strong> di bawah.</span>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-950/30 border border-blue-900/40 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
                  <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Setelah menekan <strong>"Ya, Submit Sekarang"</strong>, tugas presensi Anda akan tercatat telah diselesaikan. Anda tetap dapat membatalkan submit atau mengganti foto bukti sebelum batas waktu berakhir.</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              {confirmSubmitTask.submission?.status === 'SUBMITTED' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => setConfirmSubmitTask(null)}
                    className="px-4 py-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                  {!(confirmSubmitTask.isClosed || !confirmSubmitTask.isOpen || (confirmSubmitTask.deadline && new Date() > new Date(confirmSubmitTask.deadline))) && (
                    <button 
                      type="button"
                      onClick={() => handleUnsubmit(confirmSubmitTask.id)}
                      disabled={unsubmittingId === confirmSubmitTask.id}
                      className="inline-flex items-center justify-center px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                    >
                      {unsubmittingId === confirmSubmitTask.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-amber-400" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2 text-amber-400" />
                      )}
                      {unsubmittingId === confirmSubmitTask.id ? 'Membatalkan...' : 'Batalkan Submit & Ganti Foto'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => setConfirmSubmitTask(null)}
                    className="px-4 py-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cek Ulang / Batal
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleFinalizeSubmit(confirmSubmitTask.id)}
                    disabled={finalizingId === confirmSubmitTask.id}
                    className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
                  >
                    {finalizingId === confirmSubmitTask.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {finalizingId === confirmSubmitTask.id ? 'Mengirim...' : 'Ya, Submit Sekarang'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
