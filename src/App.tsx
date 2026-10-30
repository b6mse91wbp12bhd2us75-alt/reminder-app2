import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReminderItem, TriggeredAlarm } from './types/reminder';
import { Header } from './components/Header';
import { ReminderCard } from './components/ReminderCard';
import { CompletedCard } from './components/CompletedCard';
import { ReminderModal } from './components/ReminderModal';
import { AlarmModal } from './components/AlarmModal';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { PhoneShareModal } from './components/PhoneShareModal';
import { AndroidApkModal } from './components/AndroidApkModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { initAuth, googleSignIn, logout, getAccessToken } from './services/firebase';
import {
  saveToGoogleCalendar,
  deleteFromGoogleCalendar,
  pushReminderToGoogleCalendar,
} from './services/calendar';
import { playAlarmSound, stopAlarmSound } from './services/audio';
import { requestNotificationPermission, sendSystemNotification } from './services/notifications';
import {
  formatDateTime,
  parseDateTime,
  getScheduleCategory,
  parseNoticesString,
  calculateNextOccurrence,
} from './utils/dateUtils';
import { User } from 'firebase/auth';
import { Plus, CheckCircle2, AlertTriangle, Trash2, LogOut, Send, CheckSquare } from 'lucide-react';
import {
  initNativeAlarmSystem,
  syncAllNativeReminders,
  stopNativeAlarm,
} from './services/nativeAlarm';
import {
  getAllCustomSounds,
  saveCustomSound,
  deleteCustomSound,
} from './services/soundStorage';

const STORAGE_REMINDERS_KEY = 'reminder_app_reminders_v2';
const STORAGE_COMPLETED_KEY = 'reminder_app_completed_v2';
const STORAGE_SOUNDS_KEY = 'reminder_app_custom_sounds_v2';

export default function App() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [completed, setCompleted] = useState<ReminderItem[]>([]);
  const [currentTab, setCurrentTab] = useState<'schedule' | 'completed'>('schedule');

  // Custom sounds (MP3 uploads)
  const [customSounds, setCustomSounds] = useState<{ name: string; url: string }[]>([]);

  // Modals state
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReminderItem | null>(null);
  const [isEditingFromCompleted, setIsEditingFromCompleted] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<TriggeredAlarm | null>(null);

  // Selection & Export state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedReminderIds, setSelectedReminderIds] = useState<Set<string>>(new Set());
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [pushingReminderId, setPushingReminderId] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);

  // Notification toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  // Smartphone frame mockup toggle for desktop
  const [isFramed, setIsFramed] = useState(true);

  // Set of keys that already fired alarms to avoid repeats in current minute
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Ref to always access latest reminders in stable interval without loop
  const remindersRef = useRef<ReminderItem[]>(reminders);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  // 1. Load initial data from localStorage or seed
  useEffect(() => {
    try {
      const savedReminders = localStorage.getItem(STORAGE_REMINDERS_KEY);
      const savedCompleted = localStorage.getItem(STORAGE_COMPLETED_KEY);
      getAllCustomSounds().then((sounds) => {
        if (sounds && sounds.length > 0) {
          setCustomSounds(sounds);
        } else {
          const savedSounds = localStorage.getItem(STORAGE_SOUNDS_KEY);
          if (savedSounds) {
            try {
              const parsed = JSON.parse(savedSounds);
              setCustomSounds(parsed);
              parsed.forEach((p: any) => {
                saveCustomSound({
                  id: `legacy-${Date.now()}-${Math.random()}`,
                  name: p.name,
                  url: p.url,
                  mimeType: 'audio/mpeg',
                  size: p.url?.length || 0,
                  createdAt: Date.now(),
                });
              });
            } catch {}
          }
        }
      });

      if (savedReminders) {
        setReminders(JSON.parse(savedReminders));
      } else {
        const now = new Date();
        const test5MinLater = new Date(now.getTime() + 5 * 60 * 1000);
        const tomorrowSample = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const initialList: ReminderItem[] = [
          {
            id: 'sample-1',
            title: '【お試し】5分後のアラームテスト',
            memo: 'アプリを閉じたり画面をOFFにして、5分後に音と通知が届くか確認できます（編集・削除可能）',
            target_time: formatDateTime(test5MinLater),
            repeat: 'なし',
            notices: 'なし',
            sound: '⏰ 強力ベル（連続音・農作業推奨）',
            snooze_min: 5,
            duration: 5,
          },
          {
            id: 'sample-2',
            title: '【サンプル予定】明日の確認作業',
            memo: '予定登録のサンプルです。タップして自由に日時やタイトルを変更できます。',
            target_time: formatDateTime(tomorrowSample),
            repeat: 'なし',
            notices: '1時間前, 1日前',
            sound: '🔔 チャイム（標準）',
            snooze_min: 10,
            duration: 5,
          },
        ];
        setReminders(initialList);
        localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(initialList));
      }

      if (savedCompleted) {
        setCompleted(JSON.parse(savedCompleted));
      }

      const startupTime = Date.now();
      const loaded = savedReminders ? JSON.parse(savedReminders) : [];
      loaded.forEach((r: ReminderItem) => {
        const d = parseDateTime(r.target_time);
        if (d && d.getTime() <= startupTime) {
          notifiedKeysRef.current.add(`${r.id}_${r.target_time}_main`);
        }
      });
    } catch (e) {
      console.warn('Failed to load stored reminders:', e);
    }

    requestNotificationPermission();

    initNativeAlarmSystem().then(() => {
      const saved = localStorage.getItem(STORAGE_REMINDERS_KEY);
      if (saved) {
        try {
          syncAllNativeReminders(JSON.parse(saved));
        } catch {}
      }
    });
  }, []);

  const saveRemindersToStorage = (updated: ReminderItem[]) => {
    setReminders(updated);
    remindersRef.current = updated;
    try {
      localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(updated));
    } catch {}
    syncAllNativeReminders(updated);
  };

  const saveCompletedToStorage = (updated: ReminderItem[]) => {
    setCompleted(updated);
    try {
      localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleAddCustomSounds = async (newSounds: { name: string; url: string; size?: number; mimeType?: string }[]) => {
    const merged = [...customSounds];
    for (const ns of newSounds) {
      if (!merged.some((m) => m.name === ns.name)) {
        merged.push({ name: ns.name, url: ns.url });
      }
      await saveCustomSound({
        id: `sound-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: ns.name,
        url: ns.url,
        mimeType: ns.mimeType || 'audio/mpeg',
        size: ns.size || ns.url.length,
        createdAt: Date.now(),
      }).catch((e) => console.warn('Failed to save to IndexedDB:', e));
    }
    setCustomSounds(merged);
    showToast(`${newSounds.length}件の音源を追加・保存しました！`);
  };

  const handleDeleteCustomSound = async (soundName: string) => {
    const updated = customSounds.filter((s) => s.name !== soundName);
    setCustomSounds(updated);
    await deleteCustomSound(soundName);
    showToast(`音源「${soundName}」を削除しました。`);
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setHasToken(!!token);
      },
      () => {
        setHasToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentList = remindersRef.current;
      if (!currentList || currentList.length === 0) return;

      const now = new Date();
      const nowTime = now.getTime();

      currentList.forEach((item) => {
        if (item.snoozed_until) {
          const snoozedDate = parseDateTime(item.snoozed_until);
          if (snoozedDate && nowTime >= snoozedDate.getTime()) {
            const snoozeKey = `${item.id}_snooze_${item.snoozed_until}`;
            if (!notifiedKeysRef.current.has(snoozeKey)) {
              notifiedKeysRef.current.add(snoozeKey);
              const updated = remindersRef.current.map((r) =>
                r.id === item.id ? { ...r, snoozed_until: null } : r
              );
              saveRemindersToStorage(updated);
              triggerAlarm(item, false, 'スヌーズ');
            }
          }
        }

        const mainKey = `${item.id}_${item.target_time}_main`;
        const targetDate = parseDateTime(item.target_time);
        if (targetDate) {
          const isArrived = nowTime >= targetDate.getTime();
          const isRecent = (nowTime - targetDate.getTime()) <= 15 * 60 * 1000;
          if (isArrived && isRecent && !notifiedKeysRef.current.has(mainKey)) {
            notifiedKeysRef.current.add(mainKey);
            triggerAlarm(item, false);
            return;
          }
        }

        if (targetDate) {
          const diffSec = Math.floor((targetDate.getTime() - nowTime) / 1000);
          if (diffSec > 0 && item.notices && item.notices !== 'なし') {
            const parsedList = parseNoticesString(item.notices);
            for (const notice of parsedList) {
              if (Math.abs(diffSec - notice.sec) <= 1) {
                const preKey = `${item.id}_${item.target_time}_${notice.label}`;
                if (!notifiedKeysRef.current.has(preKey)) {
                  notifiedKeysRef.current.add(preKey);
                  triggerAlarm(item, true, notice.label);
                }
              }
            }
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const triggerAlarm = (
    reminder: ReminderItem,
    isPreNotice = false,
    preLabel = ''
  ) => {
    playAlarmSound(reminder.sound, reminder.custom_sound_url, reminder.duration);

    const notifTitle = isPreNotice
      ? `📢 【事前通知】(${preLabel}) ${reminder.title}`
      : `⏰ 時間になりました！ ${reminder.title}`;
    sendSystemNotification(notifTitle, {
      body: `${reminder.memo ? reminder.memo + '\n' : ''}予定時刻: ${reminder.target_time}`,
    });

    setActiveAlarm({
      reminder,
      isPreNotice,
      preLabel,
      alarmKey: `${reminder.id}_${Date.now()}`,
    });
  };

  const handleStopAlarm = () => {
    stopAlarmSound();
    stopNativeAlarm();
    setActiveAlarm(null);
  };

  const handleSnoozeAlarm = (alarmData: TriggeredAlarm) => {
    stopAlarmSound();
    const item = alarmData.reminder;
    const snoozeMinutes = item.snooze_min || 5;
    const nextTime = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const snoozedUntilStr = formatDateTime(nextTime);

    const updated = reminders.map((r) =>
      r.id === item.id ? { ...r, snoozed_until: snoozedUntilStr } : r
    );
    saveRemindersToStorage(updated);
    setActiveAlarm(null);
  };

  const handleCompleteFromAlarm = (alarmData: TriggeredAlarm) => {
    stopAlarmSound();
    setActiveAlarm(null);
    handleCompleteReminder(alarmData.reminder);
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasToken(true);
        showToast('Googleアカウントに接続しました！');
      }
    } catch (err: any) {
      showToast(`Googleログインに失敗しました: ${err.message}`);
    }
  };

  const handleGoogleSignOut = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
    showToast('Google連携を解除しました。');
  };

  const handleEmergencyDisconnect = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
    showToast('Googleアカウント連携を解除（切断）しました。');
  };

  const importedCalendarItemsCount = useMemo(() => {
    return reminders.filter((r) => r.id.startsWith('gcal-') || r.id.startsWith('google-')).length;
  }, [reminders]);

  const handlePurgeImportedEvents = () => {
    const count = importedCalendarItemsCount;
    if (count === 0) {
      showToast('取込予定はありません。');
      return;
    }
    const cleaned = reminders.filter((r) => !r.id.startsWith('gcal-') && !r.id.startsWith('google-'));
    saveRemindersToStorage(cleaned);
    setSelectedReminderIds(new Set());
    showToast(`自動取込された${count}件の予定を一括削除し、元のリマインダーに戻しました。`);
  };

  const handleSaveReminder = async (item: ReminderItem) => {
    let googleEventId = item.google_event_id;

    if (item.sync_with_google) {
      try {
        let token = await getAccessToken();
        if (!token && !user) {
          const res = await googleSignIn();
          if (res) {
            setUser(res.user);
            setHasToken(true);
            token = res.accessToken;
          }
        }

        if (token) {
          const parsed = parseNoticesString(item.notices);
          const eventId = await saveToGoogleCalendar({
            title: item.title,
            memo: item.memo,
            targetTime: item.target_time,
            parsedNoticesSec: parsed,
            eventId: item.google_event_id || undefined,
          });
          if (eventId) {
            googleEventId = eventId;
          }
        }
      } catch (err: any) {
        console.warn('Google Calendar export error:', err);
        showToast(`Googleカレンダー送信エラー: ${err.message || '通信エラー'}`);
      }
    } else if (item.google_event_id) {
      try {
        await deleteFromGoogleCalendar(item.google_event_id);
        googleEventId = null;
      } catch (err) {
        console.warn('Google Calendar delete error:', err);
      }
    }

    const finalItem: ReminderItem = {
      ...item,
      google_event_id: googleEventId,
      sync_with_google: item.sync_with_google ?? !!googleEventId,
    };

    if (isEditingFromCompleted) {
      const newCompleted = completed.filter((c) => c.id !== item.id);
      saveCompletedToStorage(newCompleted);
      const newReminders = [finalItem, ...reminders];
      saveRemindersToStorage(newReminders);
    } else {
      const existsIndex = reminders.findIndex((r) => r.id === item.id);
      if (existsIndex >= 0) {
        const updated = [...reminders];
        updated[existsIndex] = finalItem;
        saveRemindersToStorage(updated);
      } else {
        saveRemindersToStorage([finalItem, ...reminders]);
      }
    }
    showToast(`「${finalItem.title}」を保存しました。`);
  };

  const handlePushSingleToCalendar = async (item: ReminderItem) => {
    let token = await getAccessToken();
    if (!token || !user) {
      try {
        const res = await googleSignIn();
        if (!res) return;
        setUser(res.user);
        setHasToken(true);
        token = res.accessToken;
      } catch (e: any) {
        showToast(`Googleログインが必要です: ${e.message}`);
        return;
      }
    }

    setPushingReminderId(item.id);
    try {
      const eventId = await pushReminderToGoogleCalendar(item);
      const updated = reminders.map((r) =>
        r.id === item.id ? { ...r, google_event_id: eventId, sync_with_google: true } : r
      );
      saveRemindersToStorage(updated);
      showToast(`「${item.title}」をGoogleカレンダーに送信しました！`);
    } catch (err: any) {
      console.error('Push to calendar failed:', err);
      showToast(`カレンダー送信エラー: ${err.message || '送信に失敗しました'}`);
    } finally {
      setPushingReminderId(null);
    }
  };

  const handleUnlinkCalendar = (item: ReminderItem) => {
    const updated = reminders.map((r) =>
      r.id === item.id ? { ...r, google_event_id: null, sync_with_google: false } : r
    );
    saveRemindersToStorage(updated);
    showToast('カレンダー連携印を解除しました。');
  };

  const handleToggleSelectReminder = (item: ReminderItem) => {
    setSelectedReminderIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const handleBatchPushToCalendar = async () => {
    if (selectedReminderIds.size === 0) {
      showToast('カレンダーに送信する予定を1件以上選択してください。');
      return;
    }

    let token = await getAccessToken();
    if (!token || !user) {
      try {
        const res = await googleSignIn();
        if (!res) return;
        setUser(res.user);
        setHasToken(true);
        token = res.accessToken;
      } catch (e: any) {
        showToast(`Googleログインが必要です: ${e.message}`);
        return;
      }
    }

    setIsBatchExporting(true);
    let successCount = 0;
    const updatedReminders = [...reminders];

    for (let i = 0; i < updatedReminders.length; i++) {
      const item = updatedReminders[i];
      if (selectedReminderIds.has(item.id)) {
        try {
          const eventId = await pushReminderToGoogleCalendar(item);
          updatedReminders[i] = {
            ...item,
            google_event_id: eventId,
            sync_with_google: true,
          };
          successCount++;
        } catch (e) {
          console.warn(`Failed to export "${item.title}" to calendar`, e);
        }
      }
    }

    saveRemindersToStorage(updatedReminders);
    setIsBatchExporting(false);
    setIsSelectionMode(false);
    setSelectedReminderIds(new Set());
    showToast(`選択した${successCount}件の予定をGoogleカレンダーに送信しました！`);
  };

  const handleCompleteReminder = (item: ReminderItem) => {
    const newReminders = reminders.filter((r) => r.id !== item.id);
    const completedItem: ReminderItem = {
      ...item,
      completed_time: formatDateTime(new Date()),
      snoozed_until: null,
    };
    saveCompletedToStorage([completedItem, ...completed]);

    if (item.repeat && item.repeat !== 'なし') {
      const nextTime = calculateNextOccurrence(item.target_time, item.repeat);
      if (nextTime) {
        const nextRecurringItem: ReminderItem = {
          ...item,
          id: `rem-rep-${Date.now()}`,
          target_time: nextTime,
          snoozed_until: null,
          google_event_id: null,
        };
        saveRemindersToStorage([nextRecurringItem, ...newReminders]);
        return;
      }
    }

    saveRemindersToStorage(newReminders);
  };

  const handleDeleteCompleted = (item: ReminderItem) => {
    const hasGoogle = !!item.google_event_id;
    const confirmMessage = hasGoogle
      ? `「${item.title}」を完了履歴から削除しますか？\n登録されていたGoogleカレンダーの予定も削除されます。`
      : `「${item.title}」を完了履歴から完全に削除しますか？`;

    setConfirmDialog({
      isOpen: true,
      title: '予定の削除確認',
      message: confirmMessage,
      onConfirm: async () => {
        if (item.google_event_id) {
          try {
            await deleteFromGoogleCalendar(item.google_event_id);
          } catch (e) {
            console.warn('Failed to delete Google event:', e);
          }
        }
        const updated = completed.filter((c) => c.id !== item.id);
        saveCompletedToStorage(updated);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleOpenEdit = (item: ReminderItem, fromCompleted = false) => {
    setEditingItem(item);
    setIsEditingFromCompleted(fromCompleted);
    setIsReminderModalOpen(true);
  };

  const { pastItems, todayItems, futureItems } = useMemo(() => {
    const past: ReminderItem[] = [];
    const today: ReminderItem[] = [];
    const future: ReminderItem[] = [];

    const sorted = [...reminders].sort((a, b) => a.target_time.localeCompare(b.target_time));

    sorted.forEach((item) => {
      const cat = getScheduleCategory(item.target_time);
      if (cat === 'past') past.push(item);
      else if (cat === 'today') today.push(item);
      else future.push(item);
    });

    return { pastItems: past, todayItems: today, futureItems: future };
  }, [reminders]);

  return (
    <div className="min-h-screen bg-[#1e2530] flex items-center justify-center p-0 md:p-6 font-sans text-white select-none">
      <div
        className={`w-full bg-[#2d3748] flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
          isFramed
            ? 'max-w-[420px] md:h-[900px] md:rounded-[40px] md:border-4 md:border-gray-700/80'
            : 'max-w-2xl min-h-screen md:rounded-2xl'
        }`}
      >
        <Header
          currentTab={currentTab}
          onSwitchTab={setCurrentTab}
          onOpenAddModal={() => {
            setEditingItem(null);
            setIsEditingFromCompleted(false);
            setIsReminderModalOpen(true);
          }}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
          onOpenApkModal={() => setIsApkModalOpen(true)}
          user={user}
          hasToken={hasToken}
          scheduleCount={reminders.length}
          completedCount={completed.length}
          isFramed={isFramed}
          onToggleFrame={() => setIsFramed(!isFramed)}
          isSelectionMode={isSelectionMode}
          onToggleSelectionMode={() => {
            setIsSelectionMode(!isSelectionMode);
            setSelectedReminderIds(new Set());
          }}
          selectedCount={selectedReminderIds.size}
        />

        {toastMessage && (
          <div className="bg-emerald-950/95 border-b border-emerald-600/80 text-emerald-100 text-xs sm:text-sm px-4 py-2.5 flex items-center justify-between shadow-lg animate-in fade-in duration-150">
            <span className="font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              {toastMessage}
            </span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-300 hover:text-white ml-2 text-xs font-bold px-2 py-0.5 rounded hover:bg-emerald-800/50 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {currentTab === 'schedule' ? (
            <div className="space-y-4">
              {importedCalendarItemsCount > 0 && (
                <div className="bg-gradient-to-r from-amber-950/95 to-rose-950/90 border-2 border-amber-500 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-600/30 border border-amber-500/60 flex items-center justify-center text-amber-300 text-lg shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-amber-200">
                        カレンダーからの取込予定が【{importedCalendarItemsCount}件】あります
                      </h3>
                      <p className="text-xs text-amber-100 mt-1 leading-relaxed">
                        以前の自動同期で取り込まれたカレンダー予定です。下の赤いボタンを押すと、自動取込された予定だけを一括削除し、元の農園リマインダーに戻せます。
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handlePurgeImportedEvents}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 font-bold text-xs text-white shadow-md flex items-center justify-center gap-2 cursor-pointer transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>取込予定（{importedCalendarItemsCount}件）を一括削除して元に戻す</span>
                    </button>

                    {user && (
                      <button
                        type="button"
                        onClick={handleEmergencyDisconnect}
                        className="px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 font-medium text-xs text-gray-200 border border-gray-600 flex items-center gap-1.5 cursor-pointer"
                        title="Googleカレンダーとの接続を解除"
                      >
                        <LogOut className="w-4 h-4 text-gray-400" />
                        <span>Google連携を切断</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isSelectionMode && (
                <div className="bg-[#243346] border-2 border-blue-400/80 rounded-2xl p-3 shadow-xl space-y-2.5 sticky top-0 z-20 animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                      <span>カレンダー選択送信モード: {selectedReminderIds.size}件 選択中</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedReminderIds.size === reminders.length) {
                          setSelectedReminderIds(new Set());
                        } else {
                          setSelectedReminderIds(new Set(reminders.map((r) => r.id)));
                        }
                      }}
                      className="text-blue-300 hover:text-white underline cursor-pointer text-xs"
                    >
                      {selectedReminderIds.size === reminders.length ? '全解除' : 'すべて選択'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBatchPushToCalendar}
                      disabled={selectedReminderIds.size === 0 || isBatchExporting}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Send className={`w-3.5 h-3.5 ${isBatchExporting ? 'animate-spin' : ''}`} />
                      <span>{isBatchExporting ? '送信中...' : `選択した${selectedReminderIds.size}件をカレンダーに送信`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedReminderIds(new Set());
                      }}
                      className="py-2.5 px-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold text-xs transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {pastItems.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fc8181]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#fc8181]">
                      ■ 過去の予定 ({pastItems.length})
                    </h2>
                  </div>
                  <div className="space-y-2.5">
                    {pastItems.map((item) => (
                      <ReminderCard
                        key={item.id}
                        reminder={item}
                        category="past"
                        onEdit={(r) => handleOpenEdit(r, false)}
                        onComplete={handleCompleteReminder}
                        onPushToCalendar={handlePushSingleToCalendar}
                        onUnlinkCalendar={handleUnlinkCalendar}
                        isPushingCalendar={pushingReminderId === item.id}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedReminderIds.has(item.id)}
                        onToggleSelect={handleToggleSelectReminder}
                      />
                    ))}
                  </div>
                </section>
              )}

              {todayItems.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f6ad55]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#f6ad55]">
                      ■ 今日の予定 ({todayItems.length})
                    </h2>
                  </div>
                  <div className="space-y-2.5">
                    {todayItems.map((item) => (
                      <ReminderCard
                        key={item.id}
                        reminder={item}
                        category="today"
                        onEdit={(r) => handleOpenEdit(r, false)}
                        onComplete={handleCompleteReminder}
                        onPushToCalendar={handlePushSingleToCalendar}
                        onUnlinkCalendar={handleUnlinkCalendar}
                        isPushingCalendar={pushingReminderId === item.id}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedReminderIds.has(item.id)}
                        onToggleSelect={handleToggleSelectReminder}
                      />
                    ))}
                  </div>
                </section>
              )}

              {futureItems.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#63b3ed]" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#63b3ed]">
                      ■ 今後の予定 ({futureItems.length})
                    </h2>
                  </div>
                  <div className="space-y-2.5">
                    {futureItems.map((item) => (
                      <ReminderCard
                        key={item.id}
                        reminder={item}
                        category="future"
                        onEdit={(r) => handleOpenEdit(r, false)}
                        onComplete={handleCompleteReminder}
                        onPushToCalendar={handlePushSingleToCalendar}
                        onUnlinkCalendar={handleUnlinkCalendar}
                        isPushingCalendar={pushingReminderId === item.id}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedReminderIds.has(item.id)}
                        onToggleSelect={handleToggleSelectReminder}
                      />
                    ))}
                  </div>
                </section>
              )}

              {reminders.length === 0 && (
                <div className="text-center py-20 px-4 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-[#3a4a5e] flex items-center justify-center text-3xl shadow-inner text-gray-400">
                    🔔
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-gray-200">
                      予定がありません。
                    </p>
                    <p className="text-xs text-gray-400">
                      右上の「＋ 追加」ボタンから予定を登録してください。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsReminderModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>予定を追加する</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#68d391]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#68d391]">
                    ■ 完了した履歴一覧 ({completed.length})
                  </h2>
                </div>
              </div>

              {completed.length === 0 ? (
                <div className="text-center py-20 px-4 space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-[#3a4a5e] flex items-center justify-center text-3xl shadow-inner text-gray-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
                  </div>
                  <p className="text-sm font-bold text-gray-300">
                    完了済みの予定はありません。
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {completed.map((item) => (
                    <CompletedCard
                      key={item.id}
                      item={item}
                      onEdit={(it) => handleOpenEdit(it, true)}
                      onDelete={handleDeleteCompleted}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        onSave={handleSaveReminder}
        targetItem={editingItem}
        user={user}
        onGoogleSignIn={handleGoogleSignIn}
        customSounds={customSounds}
        onAddCustomSounds={handleAddCustomSounds}
        onDeleteCustomSound={handleDeleteCustomSound}
      />

      <AlarmModal
        alarm={activeAlarm}
        onStop={handleStopAlarm}
        onSnooze={handleSnoozeAlarm}
        onCompleteDirectly={handleCompleteFromAlarm}
      />

      <GoogleSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        user={user}
        hasToken={hasToken}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
        importedCount={importedCalendarItemsCount}
        onPurgeImported={handlePurgeImportedEvents}
        onStartBatchExport={() => {
          setIsSelectionMode(true);
          setSelectedReminderIds(new Set());
        }}
      />

      <PhoneShareModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
      />

      <AndroidApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        isDestructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
