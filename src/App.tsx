import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReminderItem, TriggeredAlarm } from './types/reminder';
import { Header } from './components/Header';
import { ReminderCard } from './components/ReminderCard';
import { ReminderModal } from './components/ReminderModal';
import { AlarmOverlay } from './components/AlarmOverlay';
import { PhonePreviewModal } from './components/PhonePreviewModal';
import { CalendarSyncModal } from './components/CalendarSyncModal';
import {
  googleSignIn,
  logout,
  getAccessToken,
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
  scheduleNativeReminder,
  cancelNativeReminder,
  syncAllNativeReminders,
  scheduleQuickTestAlarm,
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
  const [customSounds, setCustomSounds] = useState<{ name: string; url: string }[]>([]);

  // Navigation tab: 'schedule' or 'history'
  const [currentTab, setCurrentTab] = useState<'schedule' | 'history'>('schedule');

  // Modal states
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [targetReminder, setTargetReminder] = useState<ReminderItem | null>(null);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // Active ringing alarm
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

  // Instant 10-second alarm test for closed app verification
  const handleRun10SecTest = async () => {
    const success = await scheduleQuickTestAlarm(10);
    if (success) {
      showToast('⚡ 10秒後にテストアラームを予約しました！【今すぐアプリを閉じて】画面をOFFにして10秒お待ちください。大音量で通知が届きます。');
    } else {
      showToast('📱 10秒後テストはAndroid APKアプリ専用の機能です。');
    }
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
      // Load custom sounds from IndexedDB (no 5MB limit)
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
        // Seed friendly test & sample reminders
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

      // Mark past reminders on load so they don't fire retroactively
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

    // Request notification permission on first interaction
    requestNotificationPermission();

    // Initialize Android native alarm channels and permissions, then automatically sync all reminders
    initNativeAlarmSystem().then(() => {
      const saved = localStorage.getItem(STORAGE_REMINDERS_KEY);
      if (saved) {
        try {
          syncAllNativeReminders(JSON.parse(saved));
        } catch {}
      }
    });
  }, []);

  // 2. Persist data changes
  const saveRemindersToStorage = (updated: ReminderItem[]) => {
    setReminders(updated);
    remindersRef.current = updated;
    try {
      localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(updated));
    } catch {}
    // Sync with Android OS AlarmManager
    syncAllNativeReminders(updated);
  };

  const saveCompletedToStorage = (updated: ReminderItem[]) => {
    setCompleted(updated);
    try {
      localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleImportJsonData = (newReminders: ReminderItem[], newCompleted: ReminderItem[]) => {
    saveRemindersToStorage([...newReminders, ...reminders]);
    saveCompletedToStorage([...newCompleted, ...completed]);
    showToast(`${newReminders.length + newCompleted.length}件のデータをインポートしました。`);
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

  // 3. Heartbeat: In-App Interval Timer Check (every 1 second)
  useEffect(() => {
    const checkSchedule = () => {
      const currentReminders = remindersRef.current;
      const now = new Date();
      const currentTimestamp = now.getTime();

      currentReminders.forEach((reminder) => {
        let targetDate = parseDateTime(reminder.target_time);

        // Check if currently snoozed
        if (reminder.snoozed_until) {
          const snoozedDate = new Date(reminder.snoozed_until);
          if (!isNaN(snoozedDate.getTime())) {
            targetDate = snoozedDate;
          }
        }

        if (!targetDate) return;

        const mainTimestamp = targetDate.getTime();
        const mainKey = `${reminder.id}_${reminder.target_time}_${reminder.snoozed_until || 'direct'}_main`;

        // A. Trigger Main Alarm
        if (currentTimestamp >= mainTimestamp && !notifiedKeysRef.current.has(mainKey)) {
          notifiedKeysRef.current.add(mainKey);

          playAlarmSound(reminder.sound, reminder.duration ?? 5, reminder.custom_sound_url);
          sendSystemNotification(
            `⏰ リマインダー: ${reminder.title}`,
            reminder.memo || '予定の時刻になりました。確認してください。'
          );

          setActiveAlarm({
            reminder,
            isPreNotice: false,
            timestamp: currentTimestamp,
          });

          return;
        }

        // B. Check Pre-Notices
        if (reminder.notices && reminder.notices !== 'なし' && !reminder.snoozed_until) {
          const preNoticeOptions = parseNoticesString(reminder.notices);

          preNoticeOptions.forEach((opt) => {
            const noticeTimestamp = mainTimestamp - opt.sec * 1000;
            const noticeKey = `${reminder.id}_${reminder.target_time}_notice_${opt.label}`;

            if (
              currentTimestamp >= noticeTimestamp &&
              currentTimestamp < mainTimestamp &&
              !notifiedKeysRef.current.has(noticeKey)
            ) {
              notifiedKeysRef.current.add(noticeKey);

              playAlarmSound('🔔 チャイム（標準）', 3);
              sendSystemNotification(
                `🔔 事前通知 [${opt.label}]: ${reminder.title}`,
                reminder.memo ? `[${opt.label}] ${reminder.memo}` : `${opt.label}の事前通知です。`
              );

              setActiveAlarm({
                reminder,
                isPreNotice: true,
                noticeLabel: opt.label,
                timestamp: currentTimestamp,
              });
            }
          });
        }
      });
    };

    const interval = setInterval(checkSchedule, 1000);
    return () => clearInterval(interval);
  }, []);

  // 4. Alarm Actions: Stop, Snooze, Complete
  const handleStopAlarm = () => {
    stopAlarmSound();
    setActiveAlarm(null);
  };

  const handleSnoozeAlarm = (alarmData: TriggeredAlarm) => {
    stopAlarmSound();
    setActiveAlarm(null);

    const snoozeMinutes = alarmData.reminder.snooze_min || 5;
    const snoozedDate = new Date(Date.now() + snoozeMinutes * 60 * 1000);
    const snoozedIso = snoozedDate.toISOString();

    const updated = reminders.map((r) => {
      if (r.id === alarmData.reminder.id) {
        return {
          ...r,
          snoozed_until: snoozedIso,
        };
      }
      return r;
    });

    saveRemindersToStorage(updated);
    showToast(`「${alarmData.reminder.title}」を ${snoozeMinutes}分後 にスヌーズしました。`);
  };

  const handleCompleteAlarm = (alarmData: TriggeredAlarm) => {
    stopAlarmSound();
    setActiveAlarm(null);
    handleCompleteReminder(alarmData.reminder);
  };

  // Google sign in / sign out
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

  // Save Reminder (Create or Edit)
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
            id: item.google_event_id || undefined,
            title: item.title,
            memo: item.memo,
            target_time: item.target_time,
            notices: parsed.map((p) => ({
              sec: p.sec,
              label: p.label,
            })),
          });
          googleEventId = eventId;
        }
      } catch (e: any) {
        console.warn('Google Calendar sync failed:', e);
        showToast(`Googleカレンダー同期エラー: ${e.message}`);
      }
    }

    const reminderToSave: ReminderItem = {
      ...item,
      google_event_id: googleEventId,
      snoozed_until: null,
    };

    const exists = reminders.some((r) => r.id === reminderToSave.id);
    let updatedReminders: ReminderItem[];
    if (exists) {
      updatedReminders = reminders.map((r) => (r.id === reminderToSave.id ? reminderToSave : r));
      showToast(`「${reminderToSave.title}」を更新しました。`);
    } else {
      updatedReminders = [reminderToSave, ...reminders];
      showToast(`「${reminderToSave.title}」を登録しました！`);
    }

    saveRemindersToStorage(updatedReminders);
  };

  // Push single reminder to Google Calendar
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
      const updated = reminders.map((r) => {
        if (r.id === item.id) {
          return {
            ...r,
            google_event_id: eventId,
            sync_with_google: true,
          };
        }
        return r;
      });
      saveRemindersToStorage(updated);
      showToast(`「${item.title}」をGoogleカレンダーに送信しました！`);
    } catch (e: any) {
      showToast(`送信に失敗しました: ${e.message}`);
    } finally {
      setPushingReminderId(null);
    }
  };

  // Unlink single reminder from Google Calendar
  const handleUnlinkCalendar = (item: ReminderItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Googleカレンダー連携の解除',
      message: `「${item.title}」のGoogleカレンダー連携を解除しますか？\n（リマインダー自体は削除されずそのまま残ります）`,
      onConfirm: async () => {
        if (item.google_event_id) {
          try {
            await deleteFromGoogleCalendar(item.google_event_id);
          } catch (e) {
            console.warn('Failed to delete Google event:', e);
          }
        }
        const updated = reminders.map((r) => {
          if (r.id === item.id) {
            return {
              ...r,
              google_event_id: null,
              sync_with_google: false,
            };
          }
          return r;
        });
        saveRemindersToStorage(updated);
        showToast(`「${item.title}」のカレンダー連携を解除しました。`);
      },
    });
  };

  // Toggle selection for batch export
  const handleToggleSelectReminder = (id: string) => {
    setSelectedReminderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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

  // Mark as Completed
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

  // Delete completed item
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
        showToast(`「${item.title}」を履歴から削除しました。`);
      },
    });
  };

  // Restore completed item
  const handleRestoreCompleted = (item: ReminderItem) => {
    const newCompleted = completed.filter((c) => c.id !== item.id);
    const restoredItem: ReminderItem = {
      ...item,
      completed_time: undefined,
      snoozed_until: null,
    };
    saveCompletedToStorage(newCompleted);
    saveRemindersToStorage([restoredItem, ...reminders]);
    showToast(`「${item.title}」を予定一覧に戻しました。`);
  };

  // Open edit modal
  const handleOpenEdit = (item: ReminderItem, fromCompleted = false) => {
    setTargetReminder(item);
    setIsReminderModalOpen(true);
  };

  // Delete reminder directly
  const handleDeleteReminder = (item: ReminderItem) => {
    const hasGoogle = !!item.google_event_id;
    const confirmMessage = hasGoogle
      ? `「${item.title}」を削除しますか？\n登録されていたGoogleカレンダーの予定も削除されます。`
      : `「${item.title}」を削除しますか？`;

    setConfirmDialog({
      isOpen: true,
      title: 'リマインダーの削除確認',
      message: confirmMessage,
      onConfirm: async () => {
        if (item.google_event_id) {
          try {
            await deleteFromGoogleCalendar(item.google_event_id);
          } catch (e) {
            console.warn('Failed to delete Google event:', e);
          }
        }
        cancelNativeReminder(item);
        const updated = reminders.filter((r) => r.id !== item.id);
        saveRemindersToStorage(updated);
        showToast(`「${item.title}」を削除しました。`);
      },
    });
  };

  // Categorize reminders
  const { pastItems, todayItems, futureItems } = useMemo(() => {
    const past: ReminderItem[] = [];
    const today: ReminderItem[] = [];
    const future: ReminderItem[] = [];

    const sorted = [...reminders].sort((a, b) => {
      const da = parseDateTime(a.target_time)?.getTime() || 0;
      const db = parseDateTime(b.target_time)?.getTime() || 0;
      return da - db;
    });

    sorted.forEach((item) => {
      const cat = getScheduleCategory(item.target_time);
      if (cat === 'past') past.push(item);
      else if (cat === 'today') today.push(item);
      else future.push(item);
    });

    return { pastItems: past, todayItems: today, futureItems: future };
  }, [reminders]);

  return (
    <div className="min-h-screen bg-[#111827] text-white flex flex-col items-center">
      <div
        className={`w-full flex-1 flex flex-col bg-[#1a202c] transition-all duration-300 ${
          isFramed
            ? 'max-w-md my-0 sm:my-4 sm:rounded-3xl sm:border sm:border-gray-700/80 sm:shadow-2xl overflow-hidden min-h-[96vh]'
            : 'max-w-4xl min-h-screen'
        }`}
      >
        {/* Header Bar */}
        <Header
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onOpenNewReminder={() => {
            setTargetReminder(null);
            setIsReminderModalOpen(true);
          }}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
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

        {/* Toast Feedback Notification Banner */}
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {currentTab === 'schedule' ? (
            /* SCHEDULE TAB */
            <div className="space-y-4">
              {/* Emergency Cleanup Banner for Google Calendar Clutter */}
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

              {/* Selection Export Floating Action Bar */}
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

              {/* 10-Second Quick Alarm Test for Closed App Verification */}
              <div className="bg-gradient-to-r from-[#172554] to-[#1e293b] border border-blue-500/50 rounded-2xl p-3 shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-lg shrink-0">
                    ⚡
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-blue-200">
                      閉じた状態のアラーム即時テスト
                    </div>
                    <div className="text-[11px] text-blue-300/80">
                      押してすぐにアプリを閉じると10秒後に大音量アラームが鳴ります
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRun10SecTest}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer shrink-0"
                >
                  10秒テスト
                </button>
              </div>

              {/* Past Section */}
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
                        onDelete={handleDeleteReminder}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedReminderIds.has(item.id)}
                        onToggleSelect={handleToggleSelectReminder}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Today Section */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#68d391]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#68d391]">
                    ■ 今日の予定 ({todayItems.length})
                  </h2>
                </div>
                {todayItems.length > 0 ? (
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
                        onDelete={handleDeleteReminder}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedReminderIds.has(item.id)}
                        onToggleSelect={handleToggleSelectReminder}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#2d3748] rounded-2xl p-4 text-center text-gray-400 text-xs border border-gray-700/60">
                    今日の予定はありません
                  </div>
                )}
              </section>

              {/* Future Section */}
              <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#63b3ed]" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#63b3ed]">
                    ■ 明日以降の予定 ({futureItems.length})
                  </h2>
                </div>
                {futureItems.length > 0 ? (
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
                        onDelete={handleDeleteReminder}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedReminderIds.has(item.id)}
                        onToggleSelect={handleToggleSelectReminder}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#2d3748] rounded-2xl p-4 text-center text-gray-400 text-xs border border-gray-700/60">
                    明日以降の予定はありません
                  </div>
                )}
              </section>

              {reminders.length === 0 && (
                <div className="text-center py-10 px-4 space-y-3">
                  <div className="text-4xl">🔔</div>
                  <p className="text-sm text-gray-300 font-bold">リマインダーがありません</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    右下の「＋」ボタンを押して新しいリマインダーを追加してください。
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  ■ 完了した予定 ({completed.length})
                </h2>
                {completed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: '履歴の一括削除',
                        message: '完了した履歴をすべて削除しますか？\n（Googleカレンダーに登録された予定はそのまま残ります）',
                        onConfirm: () => {
                          saveCompletedToStorage([]);
                          showToast('完了履歴をすべて削除しました。');
                        },
                      });
                    }}
                    className="text-xs font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    履歴をすべて削除
                  </button>
                )}
              </div>

              {completed.length > 0 ? (
                <div className="space-y-2.5">
                  {completed.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#2d3748]/70 border border-gray-700 rounded-2xl p-3.5 flex items-start justify-between gap-3 opacity-80"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <h3 className="font-bold text-sm text-gray-300 line-through truncate">
                            {item.title}
                          </h3>
                        </div>
                        {item.memo && (
                          <p className="text-xs text-gray-400 line-clamp-2 mb-1.5">{item.memo}</p>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                          <span>予定日時: {item.target_time}</span>
                          {item.completed_time && <span>(完了: {item.completed_time})</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreCompleted(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-xs font-bold transition cursor-pointer"
                          title="予定一覧に戻す"
                        >
                          復元
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCompleted(item)}
                          className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-800 text-red-300 transition cursor-pointer"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#2d3748] rounded-2xl p-6 text-center text-gray-400 text-xs border border-gray-700/60">
                  完了した予定はありません
                </div>
              )}
            </div>
          )}
        </main>

        {/* Floating Action Button (New Reminder) */}
        <button
          type="button"
          onClick={() => {
            setTargetReminder(null);
            setIsReminderModalOpen(true);
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 rounded-full bg-[#38a169] hover:bg-[#2f855a] active:scale-95 text-white shadow-2xl flex items-center justify-center cursor-pointer transition z-40 border-2 border-emerald-400/50"
          title="新規リマインダー作成"
        >
          <Plus className="w-8 h-8" />
        </button>

        {/* Modals */}
        <ReminderModal
          isOpen={isReminderModalOpen}
          onClose={() => {
            setIsReminderModalOpen(false);
            setTargetReminder(null);
          }}
          onSave={handleSaveReminder}
          targetItem={targetReminder}
          user={user}
          onGoogleSignIn={handleGoogleSignIn}
          customSounds={customSounds}
          onAddCustomSounds={handleAddCustomSounds}
          onDeleteCustomSound={handleDeleteCustomSound}
        />

        <PhonePreviewModal
          isOpen={isPhoneModalOpen}
          onClose={() => setIsPhoneModalOpen(false)}
          reminders={reminders}
        />

        <CalendarSyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          reminders={reminders}
          completed={completed}
          onImportJsonData={handleImportJsonData}
          user={user}
          hasToken={hasToken}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleSignOut={handleGoogleSignOut}
        />

        {/* Active Ringing Alarm Overlay */}
        <AlarmOverlay
          alarm={activeAlarm}
          onStop={handleStopAlarm}
          onSnooze={handleSnoozeAlarm}
          onComplete={handleCompleteAlarm}
        />

        {/* Simple Confirmation Dialog */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-[#2d3748] border border-gray-600 rounded-3xl p-5 shadow-2xl text-white space-y-4 animate-in zoom-in-95">
              <h3 className="font-bold text-base text-gray-100">{confirmDialog.title}</h3>
              <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                {confirmDialog.message}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold text-xs cursor-pointer transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer shadow-md transition"
                >
                  実行する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
