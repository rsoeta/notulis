import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import Navbar from './components/layout/Navbar';
import FloatingBottomTabBar from './components/layout/FloatingBottomTabBar';
import MeetingFormModal from './components/meeting/MeetingFormModal';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RecordPage from './pages/RecordPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import SettingsKopPage from './pages/SettingsKopPage';
import {
  apiGetKopList,
  apiGetMeetings,
  apiGetProfile,
  apiLogout,
  clearSession,
  getSessionToken,
  getStoredUser,
  saveSession,
} from './services/api';
import { processAndCreateMeeting } from './services/meetingProcessor';
import {
  clearRecordingSession,
  getPendingSessions,
  getSessionSegments,
  saveMeetingAudioLocal,
} from './services/indexedDb';
import {
  destroyLenis,
  initLenis,
  pauseLenis,
  resumeLenis,
  scrollToTopSmooth,
} from './utils/lenis';
import {
  closeLoadingModal,
  confirmDialog,
  showErrorAlert,
  showLoadingModal,
  showToast,
  updateLoadingModal,
} from './utils/swal';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
};

function parseRouteHash(rawHash) {
  const hash = String(rawHash || '').trim();
  if (hash === '#/kop') {
    return { page: 'settings', subTab: 'kop', meetingId: null, hash };
  }
  if (hash === '#/akun') {
    return { page: 'settings', subTab: 'profile', meetingId: null, hash };
  }
  if (hash === '#/admin') {
    return { page: 'settings', subTab: 'admin', meetingId: null, hash };
  }
  if (hash.startsWith('#/detail/')) {
    const meetingId = decodeURIComponent(hash.slice('#/detail/'.length));
    if (meetingId) {
      return { page: 'detail', subTab: 'kop', meetingId, hash };
    }
  }
  return { page: 'dashboard', subTab: 'kop', meetingId: null, hash: '#/rapat' };
}

function toRouteHash(targetPage, subTab = 'kop', meetingId = null) {
  if (targetPage === 'settings') {
    if (subTab === 'profile') return '#/akun';
    if (subTab === 'admin') return '#/admin';
    return '#/kop';
  }
  if (targetPage === 'detail' && meetingId) {
    return `#/detail/${encodeURIComponent(meetingId)}`;
  }
  return '#/rapat';
}

export default function App() {
  const initialRoute = parseRouteHash(typeof window !== 'undefined' ? window.location.hash : '');

  const [user, setUser] = useState(() => (getSessionToken() ? getStoredUser() : null));
  const [page, setPage] = useState(initialRoute.page); // dashboard | record | detail | settings
  const [settingsSubTab, setSettingsSubTab] = useState(initialRoute.subTab);
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialRoute.meetingId);
  const [currentHash, setCurrentHash] = useState(initialRoute.hash);

  const [meetings, setMeetings] = useState([]);
  const [kopList, setKopList] = useState([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState([]);

  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [activeMeetingMeta, setActiveMeetingMeta] = useState(null);

  const syncHash = useCallback((nextPage, nextSubTab = 'kop', nextMeetingId = null) => {
    const nextHash = toRouteHash(nextPage, nextSubTab, nextMeetingId);
    setCurrentHash(nextHash);
    if (typeof window !== 'undefined' && window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  // Sinkronisasi tombol Back/Forward browser dengan hash URL
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseRouteHash(window.location.hash);
      setCurrentHash(parsed.hash);
      setPage(parsed.page);
      setSettingsSubTab(parsed.subTab);
      setSelectedMeetingId(parsed.meetingId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleAuthExpired = useCallback(() => {
    clearSession();
    setUser(null);
    setMeetings([]);
    setKopList([]);
    setPage('dashboard');
    setSelectedMeetingId(null);
    syncHash('dashboard');
  }, [syncHash]);

  const loadWorkspaceData = useCallback(async () => {
    const token = getSessionToken();
    if (!token) return;
    setIsLoadingMeetings(true);
    try {
      const [meetingsRes, kopRes, profileRes, recoveryList] = await Promise.all([
        apiGetMeetings(),
        apiGetKopList(),
        apiGetProfile().catch(() => null),
        getPendingSessions().catch(() => []),
      ]);
      setMeetings(meetingsRes.data || []);
      setKopList(kopRes.data || []);
      if (profileRes?.data) {
        saveSession(token, profileRes.data);
        setUser(profileRes.data);
      }
      setPendingRecovery(recoveryList || []);
    } catch (err) {
      if (err.code === 401) {
        handleAuthExpired();
        showToast('warning', 'Sesi berakhir. Silakan login kembali.');
      } else {
        showErrorAlert('Gagal Memuat Data', err.message);
      }
    } finally {
      setIsLoadingMeetings(false);
    }
  }, [handleAuthExpired]);

  useEffect(() => {
    if (user?.userId) {
      loadWorkspaceData();
    }
  }, [user?.userId, loadWorkspaceData]);

  // Lenis Smooth Scroll lifecycle (non-record pages)
  useEffect(() => {
    if (page === 'record') {
      destroyLenis();
      return undefined;
    }
    initLenis();
    return () => {
      destroyLenis();
    };
  }, [page]);

  // Pause Lenis background scroll while modal is open
  useEffect(() => {
    if (showNewMeetingModal) pauseLenis();
    else resumeLenis();
  }, [showNewMeetingModal]);

  // Smooth scroll to top on page/meeting switch
  useEffect(() => {
    scrollToTopSmooth();
  }, [page, selectedMeetingId]);

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      icon: 'question',
      title: 'Keluar dari Notulis?',
      text: 'Sesi Anda di perangkat ini akan diakhiri.',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
    });
    if (!confirmed) return;

    try {
      await apiLogout();
    } catch {
      // Tetap bersihkan sesi lokal
    }
    handleAuthExpired();
    showToast('info', 'Anda telah keluar.');
  };

  const handleNavigate = (targetPage, subTab = 'kop') => {
    setPage(targetPage);
    if (targetPage === 'settings') {
      setSettingsSubTab(subTab);
      syncHash('settings', subTab);
    } else if (targetPage === 'dashboard') {
      setSelectedMeetingId(null);
      syncHash('dashboard');
    }
  };

  const handleSelectMeeting = (id) => {
    setSelectedMeetingId(id);
    setPage('detail');
    syncHash('detail', 'kop', id);
  };

  const handleSettingsSubTabChange = (nextSubTab) => {
    setSettingsSubTab(nextSubTab);
    syncHash('settings', nextSubTab);
  };

  const handleStartRecord = (meta) => {
    setShowNewMeetingModal(false);
    setActiveMeetingMeta(meta);
    setPage('record');
  };

  const handleDirectAudioUpload = async (meta, file) => {
    setShowNewMeetingModal(false);
    showLoadingModal('Memproses Audio...', 'Menyiapkan file audio untuk disusun AI...');
    try {
      const mimeType = (file.type || 'audio/mpeg').split(';')[0];
      const { meetingId, playbackBlob } = await processAndCreateMeeting({
        blob: file,
        mimeType,
        durationSec: 60,
        meetingMeta: meta,
        onProgress: ({ title, html }) => updateLoadingModal(title, html),
      });
      await saveMeetingAudioLocal(meetingId, playbackBlob).catch(() => {});
      closeLoadingModal();
      await showToast('success', 'Notulen AI berhasil disusun!');
      await loadWorkspaceData();
      handleSelectMeeting(meetingId);
    } catch (err) {
      closeLoadingModal();
      showErrorAlert('Gagal Memproses Audio', err.message);
    }
  };

  const handleRecoverPendingSession = async (sess) => {
    showLoadingModal('Memulihkan Rekaman...', 'Mengambil potongan audio dari penyimpanan perangkat...');
    try {
      const segments = await getSessionSegments(sess.sessionId);
      if (!segments || segments.length === 0) {
        await clearRecordingSession(sess.sessionId);
        setPendingRecovery((prev) => prev.filter((x) => x.sessionId !== sess.sessionId));
        closeLoadingModal();
        showToast('warning', 'Potongan audio kosong.');
        return;
      }
      const combinedBlob = new Blob(
        segments.map((s) => s.blob),
        { type: segments[0]?.mimeType || 'audio/webm' }
      );
      const { meetingId, playbackBlob } = await processAndCreateMeeting({
        sessionId: sess.sessionId,
        blob: combinedBlob,
        segments,
        mimeType: segments[0]?.mimeType || 'audio/webm',
        durationSec: sess.elapsedSec || 60,
        meetingMeta: sess.meta || { title: 'Rapat Terpulihkan', location: '-' },
        onProgress: ({ title, html }) => updateLoadingModal(title, html),
      });
      await saveMeetingAudioLocal(meetingId, playbackBlob).catch(() => {});
      await clearRecordingSession(sess.sessionId);
      closeLoadingModal();
      await showToast('success', 'Rekaman terpulihkan & disusun AI!');
      await loadWorkspaceData();
      handleSelectMeeting(meetingId);
    } catch (err) {
      closeLoadingModal();
      showErrorAlert('Gagal Memulihkan Rekaman', err.message);
    }
  };

  const handleDiscardRecovery = async (sessionId) => {
    const ok = await confirmDialog({
      icon: 'warning',
      title: 'Hapus Rekaman Lokal?',
      text: 'Potongan audio yang belum diproses ini akan dihapus permanen.',
      confirmText: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    await clearRecordingSession(sessionId);
    setPendingRecovery((prev) => prev.filter((x) => x.sessionId !== sessionId));
    showToast('info', 'Rekaman lokal dihapus.');
  };

  if (!user) {
    return (
      <MotionConfig reducedMotion="user">
        <LoginPage
          onLoginSuccess={(loggedUser) => {
            setUser(loggedUser);
            syncHash('dashboard');
          }}
        />
      </MotionConfig>
    );
  }

  // Layar Perekaman Dark Mode full-screen
  if (page === 'record' && activeMeetingMeta) {
    return (
      <MotionConfig reducedMotion="user">
        <RecordPage
          meetingMeta={activeMeetingMeta}
          onBack={() => handleNavigate('dashboard')}
          onComplete={async (newMeetingId) => {
            await loadWorkspaceData();
            handleSelectMeeting(newMeetingId);
          }}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar
          user={user}
          activePage={page}
          showBack={page === 'detail'}
          title="Detail Notulen"
          onBack={() => handleNavigate('dashboard')}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onStartNewMeeting={() => setShowNewMeetingModal(true)}
        />

        <main>
          <AnimatePresence mode="wait">
            {page === 'dashboard' && (
              <motion.div key="page-dashboard" {...PAGE_TRANSITION}>
                <DashboardPage
                  user={user}
                  meetings={meetings}
                  isLoading={isLoadingMeetings}
                  pendingRecoverySessions={pendingRecovery}
                  onRefresh={loadWorkspaceData}
                  onOpenNewMeeting={() => setShowNewMeetingModal(true)}
                  onSelectMeeting={handleSelectMeeting}
                  onRecoverSession={handleRecoverPendingSession}
                  onDiscardRecovery={handleDiscardRecovery}
                />
              </motion.div>
            )}

            {page === 'detail' && selectedMeetingId && (
              <motion.div key={`page-detail-${selectedMeetingId}`} {...PAGE_TRANSITION}>
                <MeetingDetailPage
                  meetingId={selectedMeetingId}
                  kopList={kopList}
                  onMeetingUpdated={loadWorkspaceData}
                  onDeleted={async () => {
                    await loadWorkspaceData();
                    handleNavigate('dashboard');
                  }}
                />
              </motion.div>
            )}

            {page === 'settings' && (
              <motion.div key="page-settings" {...PAGE_TRANSITION}>
                <SettingsKopPage
                  user={user}
                  initialSubTab={settingsSubTab}
                  kopList={kopList}
                  onKopListChange={setKopList}
                  onUserUpdate={(nextUser) => {
                    saveSession(getSessionToken(), nextUser);
                    setUser(nextUser);
                  }}
                  onSubTabChange={handleSettingsSubTabChange}
                  onLogout={handleLogout}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {!showNewMeetingModal && (
          <FloatingBottomTabBar
            activePage={page}
            activeSettingsSubTab={settingsSubTab}
            currentHash={currentHash}
            onNavigate={handleNavigate}
            onStartNewMeeting={() => setShowNewMeetingModal(true)}
          />
        )}

        <AnimatePresence>
          {showNewMeetingModal && (
            <MeetingFormModal
              kopList={kopList}
              existingCount={meetings.length}
              onClose={() => setShowNewMeetingModal(false)}
              onStartRecord={handleStartRecord}
              onUploadAudio={handleDirectAudioUpload}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
