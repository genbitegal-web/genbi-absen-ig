import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudentTask, Notification } from '../../types';
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
  RefreshCw
} from 'lucide-react';

export function StudentDashboard() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<number | null>(null);

  // Modal preview photo state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; linkNumber?: number } | null>(null);

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
    const formData = new FormData();
    formData.append('proof', file);
    formData.append('linkIndex', linkIndex.toString());

    try {
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
        showToast(data.message || 'Tugas absensi berhasil dikirimkan!');
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-zinc-100">Daftar Tugas Absensi</h2>
          <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            {tasks.filter(t => t.submission?.status === 'SUBMITTED' || t.hasUploaded).length} dari {tasks.length} Selesai
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-8 text-center text-zinc-500 border border-zinc-800">
            Belum ada tugas absensi saat ini.
          </div>
        ) : (
          tasks.map(task => {
            const urls = task.igPostUrls && task.igPostUrls.length > 0 
              ? task.igPostUrls 
              : (task.igPostUrl ? [task.igPostUrl] : []);
            
            const totalLinks = urls.length > 0 ? urls.length : 1;
            const proofUrls = task.submission?.proofUrls || [];
            const uploadedCount = proofUrls.filter(url => Boolean(url && url.trim())).length;
            const isAllUploaded = uploadedCount >= totalLinks;
            const isSubmitted = task.submission?.status === 'SUBMITTED' || (task.hasUploaded && isAllUploaded);

            return (
              <div key={task.id} className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-sm transition-all hover:border-zinc-700/80">
                {/* Task Header */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-zinc-100">{task.title}</h3>
                    <p className="text-zinc-400 mt-1 text-sm leading-relaxed">{task.description}</p>
                  </div>
                  <div>
                    {isSubmitted ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Selesai Disubmit
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

                {/* Link & Upload Rows */}
                <div className="space-y-3 mt-5">
                  {urls.map((url, i) => {
                    const hasProof = Boolean(proofUrls[i] && proofUrls[i].trim());
                    const currentProofUrl = proofUrls[i] || '';
                    const isUploadingThis = uploadingId === `${task.id}-${i}`;
                    const isDeletingThis = deletingId === `${task.id}-${i}`;

                    return (
                      <div 
                        key={i} 
                        className={`p-3.5 rounded-xl border transition-all ${
                          hasProof 
                            ? 'bg-zinc-950/60 border-zinc-800/90' 
                            : 'bg-zinc-900/90 border-zinc-800/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* IG Post Link */}
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-sm font-medium text-zinc-300 hover:text-blue-400 transition-colors group"
                          >
                            <ExternalLink className="w-4 h-4 mr-2 text-zinc-500 group-hover:text-blue-400 shrink-0" />
                            <span className="underline-offset-4 group-hover:underline">
                              Buka Postingan IG {urls.length > 1 ? `#${i + 1}` : ''}
                            </span>
                          </a>

                          {/* Proof Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {hasProof ? (
                              <div className="flex items-center gap-2 bg-zinc-900 px-2 py-1.5 rounded-lg border border-zinc-800">
                                {/* Thumbnail Image */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto({ url: currentProofUrl, title: task.title, linkNumber: i + 1 })}
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
                                  onClick={() => setPreviewPhoto({ url: currentProofUrl, title: task.title, linkNumber: i + 1 })}
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  Cek Foto
                                </button>

                                {/* Replace / Re-upload Button */}
                                <label className={`inline-flex items-center px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors cursor-pointer ${isUploadingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                                  {isUploadingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-blue-400" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                                  )}
                                  Ganti
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) handleUpload(task.id, i, e.target.files[0]);
                                    }}
                                    disabled={isUploadingThis}
                                  />
                                </label>

                                {/* Delete Proof Button */}
                                {!isSubmitted && (
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
                            ) : (
                              /* Upload Button */
                              <label className={`inline-flex items-center px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 rounded-lg transition-colors cursor-pointer ${isUploadingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                                {isUploadingThis ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                {isUploadingThis ? 'Mengunggah...' : `Unggah Foto Bukti ${urls.length > 1 ? `#${i + 1}` : ''}`}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleUpload(task.id, i, e.target.files[0]);
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
                    <span className={`w-2 h-2 rounded-full ${isAllUploaded ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {isAllUploaded 
                      ? 'Semua foto bukti telah terisi. Pastikan foto sudah benar sebelum mengirim.'
                      : `Belum lengkap: baru ${uploadedCount} dari ${totalLinks} foto bukti yang diunggah.`
                    }
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View All Submitted Proofs button if already submitted */}
                    {isSubmitted ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmSubmitTask(task)}
                          className="inline-flex items-center px-3.5 py-2 text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                          Cek Semua Bukti
                        </button>
                        <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Terkirim
                        </span>
                      </div>
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
          })
        )}
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
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  Foto Bukti {previewPhoto.linkNumber ? `Postingan #${previewPhoto.linkNumber}` : ''}
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
                  <h4 className="text-base font-semibold text-zinc-100">Periksa & Konfirmasi Pengumpulan</h4>
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
                Silakan cek kembali foto bukti yang telah Anda unggah sebelum dikirim ke Admin:
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

              <div className="p-3.5 bg-blue-950/30 border border-blue-900/40 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
                <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Setelah menekan <strong>"Ya, Submit Sekarang"</strong>, tugas absensi Anda akan tercatat telah diselesaikan. Anda tetap dapat melihat bukti kapan pun.</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
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
                className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-blue-600/30 disabled:opacity-50"
              >
                {finalizingId === confirmSubmitTask.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {finalizingId === confirmSubmitTask.id ? 'Mengirim...' : 'Ya, Submit Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
