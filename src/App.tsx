import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { ReminderItem, TriggeredAlarm } from './types/reminder';
import { Header } from './components/Header';
import { ReminderCard } from './components/ReminderCard';
import { CompletedCard } from './components/CompletedCard';
import { ReminderModal } from './components/ReminderModal';
import { AlarmModal } from './components/AlarmModal';
import { PhoneShareModal } from './components/PhoneShareModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { playAlarmSound, stopAlarmSound } from './services/audio';
import { requestNotificationPermission, sendSystemNotification } from './services/notifications';
import {
  formatDateTime,
  parseDateTime,
  getScheduleCategory,
  parseNoticesString,
  calculateNextOccurrence,
  getNextFutureOccurrence,
} from './utils/dateUtils';
import { Plus, CheckCircle2, AlertTriangle, Trash2, Send, CheckSquare } from 'lucide-react';
import {
  initNativeAlarmSystem,
  scheduleNativeReminder,
  cancelNativeReminder,
  syncAllNativeReminders,
  stopNativeAlarm,
  openAndroidCalendarEvent,
  checkOverlayPermission,
  requestOverlayPermission,
  saveNativeAudioFile,
} from './services/nativeAlarm';
import {
  getAllCustomSounds,
  saveCustomSound,
  deleteCustomSound,
} from './services/soundStorage';

const STORAGE_REMINDERS_KEY = 'reminder_app_reminders_v2';
const STORAGE_COMPLETED_KEY = 'reminder_app_completed_v2';

export default function App() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [completed, setCompleted] = useState<ReminderItem[]>([]);
  const [currentTab, setCurrentTab] = useState<'schedule' | 'completed'>('schedule');

  // Custom sounds (MP3 uploads preserved in IndexedDB)
  const [customSounds, setCustomSounds] = useState<{ name: string; url: string }[]>([]);

  // Modals state
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReminderItem | null>(null);
  const [isEditingFromCompleted, setIsEditingFromCompleted] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<TriggeredAlarm | null>(null);

  // Selection & Export state (リマインダーから選択式でGoogleカレンダーに送る)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedReminderIds, setSelectedReminderIds] = useState<Set<string>>(new Set());
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [pushingReminderId, setPushingReminderId] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    requireTwoStep?: boolean;
    stepOneConfirmLabel?: string;
    stepTwoTitle?: string;
    stepTwoMessage?: string;
    stepTwoCheckboxLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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

  // Overlay permission state (他のアプリの上に重ねて表示)
  const [hasOverlayPermission, setHasOverlayPermission] = useState<boolean>(true);

  const verifyOverlayPermission = async () => {
    const granted = await checkOverlayPermission();
    setHasOverlayPermission(granted);
  };

  useEffect(() => {
    verifyOverlayPermission();
    const handleFocus = () => {
      verifyOverlayPermission();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // 1. Initial Load from LocalStorage & IndexedDB
  useEffect(() => {
    const initializeAppData = async () => {
      // 1. Load custom sounds from IndexedDB and persist them to native Android files
      let loadedSounds: { name: string; url: string }[] = [];
      try {
        const sounds = await getAllCustomSounds();
        if (sounds && sounds.length > 0) {
          loadedSounds = sounds;
          setCustomSounds(sounds);
          for (const s of sounds) {
            if (s.name && s.url) {
              await saveNativeAudioFile(s.name, s.url);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load custom sounds on startup:', err);
      }

      // 2. Load reminders, roll forward repeats, and reconcile audio base64
      const savedReminders = localStorage.getItem(STORAGE_REMINDERS_KEY);
      if (savedReminders) {
        try {
          let parsed: ReminderItem[] = JSON.parse(savedReminders);
          let hasChanges = false;
          parsed = parsed.map((item) => {
            if (item.repeat && item.repeat !== 'なし') {
              const t = parseDateTime(item.target_time);
              if (t && t.getTime() <= Date.now()) {
                const nextTime = getNextFutureOccurrence(item.target_time, item.repeat);
                if (nextTime && nextTime !== item.target_time) {
                  hasChanges = true;
                  return { ...item, target_time: nextTime, snoozed_until: undefined };
                }
              }
            }
            return item;
          });

          // Attach custom sound URLs from IndexedDB so native alarm gets full audioBase64
          if (loadedSounds.length > 0) {
            parsed = parsed.map((r) => {
              if (r.sound) {
                const matched = loadedSounds.find((s) => s.name === r.sound);
                if (matched && matched.url) {
                  return { ...r, custom_sound_url: matched.url };
                }
              }
              return r;
            });
          }

          if (hasChanges) {
            try {
              const sanitized = parsed.map((r) => {
                if (r.custom_sound_url && r.custom_sound_url.length > 500) {
                  return { ...r, custom_sound_url: undefined };
                }
                return r;
              });
              localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(sanitized));
            } catch {}
          }

          setReminders(parsed);
          // Sync with native AlarmClock with audioBase64 fully populated
          await syncAllNativeReminders(parsed);
        } catch (e) {
          console.error('Failed to parse saved reminders', e);
        }
      } else {
        const now = new Date();
        const inTenMin = new Date(now.getTime() + 10 * 60 * 1000);
        const defaultReminders: ReminderItem[] = [
          {
            id: 'sample-1',
            title: '☕ ほっと一息リフレッシュ',
            memo: '水分補給とお茶の時間。少し背伸びをしてリフレッシュしましょう！',
            sound: '電子音（ピピッ）',
            duration: 10,
            repeat: 'なし',
            notices: '5分前',
            snooze_min: 5,
            target_time: formatDateTime(inTenMin),
            volume: 70,
          },
        ];
        setReminders(defaultReminders);
        try {
          localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(defaultReminders));
        } catch {}
        await syncAllNativeReminders(defaultReminders);
      }
      const savedCompleted = localStorage.getItem(STORAGE_COMPLETED_KEY);
      if (savedCompleted) {
        try {
          setCompleted(JSON.parse(savedCompleted));
        } catch (e) {
          console.error('Failed to parse saved completed', e);
        }
      }
    };

    initializeAppData();

    initNativeAlarmSystem();
    if (!Capacitor.isNativePlatform()) {
      requestNotificationPermission();
    }
  }, []);

  // When app returns to foreground, check if any repeating alarms should roll forward
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setReminders((prev) => {
          let hasChanges = false;
          const updated = prev.map((item) => {
            if (item.repeat && item.repeat !== 'なし') {
              const t = parseDateTime(item.target_time);
              if (t && t.getTime() <= Date.now()) {
                const nextTime = getNextFutureOccurrence(item.target_time, item.repeat);
                if (nextTime && nextTime !== item.target_time) {
                  hasChanges = true;
                  return { ...item, target_time: nextTime, snoozed_until: undefined };
                }
              }
            }
            return item;
          });

          if (hasChanges) {
            try {
              localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(updated));
            } catch {}
            syncAllNativeReminders(updated);
            return updated;
          }
          return prev;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Save changes to localStorage & sync Android AlarmClock
  const updateRemindersState = (newReminders: ReminderItem[]) => {
    setReminders(newReminders);
    try {
      // Strip huge base64 from localStorage to never exceed 5MB quota
      const sanitized = newReminders.map((r) => {
        if (r.custom_sound_url && r.custom_sound_url.length > 500) {
          return { ...r, custom_sound_url: undefined };
        }
        return r;
      });
      localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
    syncAllNativeReminders(newReminders);
  };

  const updateCompletedState = (newCompleted: ReminderItem[]) => {
    setCompleted(newCompleted);
    try {
      const sanitized = newCompleted.map((r) => {
        if (r.custom_sound_url && r.custom_sound_url.length > 500) {
          return { ...r, custom_sound_url: undefined };
        }
        return r;
      });
      localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  // Trigger alarm modal & sound
  const triggerAlarm = (item: ReminderItem, isNotice: boolean, noticeLabel?: string) => {
    if (activeAlarm && activeAlarm.reminder.id === item.id) return;

    setActiveAlarm({
      reminder: item,
      isPreNotice: isNotice,
      preLabel: noticeLabel,
      alarmKey: `${item.id}-${Date.now()}`,
    });

    const vol = (item as any).volume !== undefined ? (item as any).volume : 70;
    playAlarmSound(item.sound, item.custom_sound_url, vol, item.duration || 15);

    if (!Capacitor.isNativePlatform()) {
      const titlePrefix = isNotice ? `📢【事前通知 ${noticeLabel}】` : '⏰【リマインダー】';
      sendSystemNotification(`${titlePrefix} ${item.title}`, {
        body: item.memo || item.target_time,
        requireInteraction: true,
      });
    }
  };

  // Timer loop for in-app alarm triggering
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const nowTs = now.getTime();

      reminders.forEach((item) => {
        const targetDate = parseDateTime(item.target_time);
        if (!targetDate) return;

        // Snooze check
        if (item.snoozed_until) {
          const snoozeDate = new Date(item.snoozed_until);
          if (nowTs >= snoozeDate.getTime() && nowTs - snoozeDate.getTime() < 30000) {
            triggerAlarm(item, false);
            return;
          }
        }

        // Advance notices check
        if (item.notices && item.notices !== 'なし' && !item.snoozed_until) {
          const parsed = parseNoticesString(item.notices);
          parsed.forEach((n) => {
            const noticeTs = targetDate.getTime() - n.sec * 1000;
            if (Math.abs(nowTs - noticeTs) < 15000) {
              const firedKey = `fired_notice_${item.id}_${n.label}`;
              if (!sessionStorage.getItem(firedKey)) {
                sessionStorage.setItem(firedKey, 'true');
                triggerAlarm(item, true, n.label);
              }
            }
          });
        }

        // Main scheduled alarm check
        if (!item.snoozed_until) {
          const diff = nowTs - targetDate.getTime();
          if (diff >= 0 && diff < 30000) {
            const firedKey = `fired_main_${item.id}_${item.target_time}`;
            if (!sessionStorage.getItem(firedKey)) {
              sessionStorage.setItem(firedKey, 'true');
              triggerAlarm(item, false);
            }
          }
        }
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [reminders, activeAlarm]);

  // Google Calendar Push Action (100% Native Intent: opens Android Google Calendar app directly)
  const handlePushToGoogleCalendar = async (item: ReminderItem) => {
    setPushingReminderId(item.id);
    try {
      const success = await openAndroidCalendarEvent(item);
      if (success) {
        const updated = reminders.map((r) =>
          r.id === item.id ? { ...r, google_event_id: `gcal-${Date.now()}` } : r
        );
        updateRemindersState(updated);
        showToast(`📅 「${item.title}」をカレンダーへ送信しました`);
      }
    } catch (err: any) {
      console.error(err);
      showToast('カレンダーの起動に失敗しました');
    } finally {
      setPushingReminderId(null);
    }
  };

  const handleUnlinkCalendar = (item: ReminderItem) => {
    const updated = reminders.map((r) =>
      r.id === item.id ? { ...r, google_event_id: null } : r
    );
    updateRemindersState(updated);
    showToast('カレンダー登録フラグを解除しました');
  };

  // Batch Export to Calendar
  const handleBatchExportToCalendar = async () => {
    const selectedItems = reminders.filter((r) => selectedReminderIds.has(r.id));
    if (selectedItems.length === 0) return;

    setIsBatchExporting(true);
    let count = 0;
    for (const item of selectedItems) {
      try {
        await openAndroidCalendarEvent(item);
        count++;
      } catch (err) {
        console.error(err);
      }
    }
    const updated = reminders.map((r) =>
      selectedReminderIds.has(r.id) ? { ...r, google_event_id: `gcal-${Date.now()}` } : r
    );
    updateRemindersState(updated);
    setIsBatchExporting(false);
    setIsSelectionMode(false);
    setSelectedReminderIds(new Set());
    showToast(`📅 ${count}件の予定をGoogleカレンダーに送信しました！`);
  };

  const toggleSelectReminder = (item: ReminderItem) => {
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

  const toggleSelectAll = () => {
    if (selectedReminderIds.size === reminders.length) {
      setSelectedReminderIds(new Set());
    } else {
      setSelectedReminderIds(new Set(reminders.map((r) => r.id)));
    }
  };

  // Add/Save Reminder (Robust with no quota crashes)
  const handleSaveReminder = async (item: ReminderItem) => {
    let updated: ReminderItem[];
    if (isEditingFromCompleted) {
      const remainingCompleted = completed.filter((c) => c.id !== item.id);
      updateCompletedState(remainingCompleted);
      updated = [item, ...reminders.filter((r) => r.id !== item.id)];
      setIsEditingFromCompleted(false);
    } else {
      const existsIndex = reminders.findIndex((r) => r.id === item.id);
      if (existsIndex >= 0) {
        updated = [...reminders];
        updated[existsIndex] = item;
      } else {
        updated = [item, ...reminders];
      }
    }

    updated.sort((a, b) => a.target_time.localeCompare(b.target_time));
    updateRemindersState(updated);
    await scheduleNativeReminder(item);
    showToast(`✅ 「${item.title}」を保存しました`);
  };

  // Complete Reminder
  const handleCompleteReminder = (item: ReminderItem) => {
    cancelNativeReminder(item.id);
    const nowStr = formatDateTime(new Date());

    if (item.repeat && item.repeat !== 'なし') {
      const nextTime = calculateNextOccurrence(item.target_time, item.repeat);
      if (nextTime) {
        const completedRecord: ReminderItem = {
          ...item,
          id: `comp-${Date.now()}-${item.id}`,
          completed_time: nowStr,
        };
        updateCompletedState([completedRecord, ...completed]);

        const nextReminder: ReminderItem = {
          ...item,
          target_time: nextTime,
          snoozed_until: null,
          google_event_id: null,
        };
        const remaining = reminders.map((r) => (r.id === item.id ? nextReminder : r));
        remaining.sort((a, b) => a.target_time.localeCompare(b.target_time));
        updateRemindersState(remaining);
        showToast(`🎉 完了！次回予定: ${nextTime}（${item.repeat}）`);
        return;
      }
    }

    const updatedReminders = reminders.filter((r) => r.id !== item.id);
    const completedItem: ReminderItem = {
      ...item,
      completed_time: nowStr,
    };
    updateRemindersState(updatedReminders);
    updateCompletedState([completedItem, ...completed]);
    showToast(`🎉 「${item.title}」を完了にしました`);
  };

  // Restore completed reminder back to schedule
  const handleRestoreReminder = (item: ReminderItem) => {
    const updatedCompleted = completed.filter((c) => c.id !== item.id);
    const restoredItem: ReminderItem = {
      ...item,
      completed_time: undefined,
      snoozed_until: null,
    };
    const updatedReminders = [...reminders, restoredItem];
    updatedReminders.sort((a, b) => a.target_time.localeCompare(b.target_time));

    updateCompletedState(updatedCompleted);
    updateRemindersState(updatedReminders);
    scheduleNativeReminder(restoredItem);
    showToast(`↩️ 「${item.title}」を予定表に戻しました`);
  };

  // Delete reminder permanently (including repeating schedules) with 2-step confirmation
  const handleDeleteReminder = (item: ReminderItem) => {
    const isRepeating = Boolean(item.repeat && item.repeat !== 'なし');
    setConfirmDialog({
      isOpen: true,
      title: isRepeating ? 'リピート予定の完全削除' : '予定の完全削除',
      message: isRepeating
        ? `「${item.title}」はリピート設定（${item.repeat}）が登録されています。\n削除すると、今回分だけでなく「次回以降のすべての予定」とアラームも完全に削除されます。`
        : `「${item.title}」の予定と予約されているアラームを完全に削除しますか？`,
      requireTwoStep: true,
      stepOneConfirmLabel: '次へ進む（最終確認）',
      stepTwoTitle: '最終確認：本当に削除しますか？',
      stepTwoMessage: isRepeating
        ? `「${item.title}」（${item.repeat}）を完全に削除します。\nこの操作は取り消せません。`
        : `「${item.title}」を完全に削除します。\nこの操作は取り消せません。`,
      stepTwoCheckboxLabel: isRepeating
        ? '次回以降の繰り返し予定も含めて削除することに同意する'
        : 'この予定を完全に削除することに同意する',
      confirmLabel: '完全に削除する',
      onConfirm: async () => {
        await cancelNativeReminder(item.id);
        if (isEditingFromCompleted) {
          const nextCompleted = completed.filter((c) => c.id !== item.id);
          updateCompletedState(nextCompleted);
          setIsEditingFromCompleted(false);
        } else {
          const nextReminders = reminders.filter((r) => r.id !== item.id);
          updateRemindersState(nextReminders);
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setIsReminderModalOpen(false);
        setEditingItem(null);
        showToast(`🗑️ 「${item.title}」を完全に削除しました`);
      },
    });
  };

  // Delete completed
  const handleDeleteCompleted = (item: ReminderItem) => {
    setConfirmDialog({
      isOpen: true,
      title: '完了履歴の削除',
      message: `「${item.title}」の履歴を完全に削除しますか？`,
      confirmLabel: '削除する',
      requireTwoStep: false,
      onConfirm: () => {
        const next = completed.filter((c) => c.id !== item.id);
        updateCompletedState(next);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('完了履歴を削除しました');
      },
    });
  };

  const handleClearAllCompleted = () => {
    if (completed.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: '完了履歴の一括削除',
      message: `完了済みの全 ${completed.length} 件の履歴をすべて削除しますか？`,
      confirmLabel: '削除する',
      requireTwoStep: false,
      onConfirm: () => {
        updateCompletedState([]);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('すべての完了履歴を削除しました');
      },
    });
  };

  // Audio additions preserved properly in IndexedDB & internal device storage
  const handleAddCustomSounds = async (newSounds: { name: string; url: string; size?: number; mimeType?: string }[]) => {
    for (const ns of newSounds) {
      await saveCustomSound({
        id: `sound-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: ns.name,
        url: ns.url,
        mimeType: ns.mimeType || 'audio/mpeg',
        size: ns.size || ns.url.length,
        createdAt: Date.now(),
      }).catch((e) => console.warn('Failed to save to IndexedDB:', e));

      // Also permanently save to Android's internal files storage (survives app updates)
      await saveNativeAudioFile(ns.name, ns.url);
    }
    const all = await getAllCustomSounds();
    setCustomSounds(all);
    showToast(`🎵 音源「${newSounds[0]?.name}」を端末ストレージに保存しました`);
  };

  const handleDeleteCustomSound = async (name: string) => {
    await deleteCustomSound(name);
    const all = await getAllCustomSounds();
    setCustomSounds(all);
    showToast(`音源「${name}」を削除しました`);
  };

  // Categorize schedule items
  const categorizedReminders = useMemo(() => {
    const past: ReminderItem[] = [];
    const today: ReminderItem[] = [];
    const future: ReminderItem[] = [];

    reminders.forEach((r) => {
      const cat = getScheduleCategory(r.target_time);
      if (cat === 'past') past.push(r);
      else if (cat === 'today') today.push(r);
      else future.push(r);
    });

    return { past, today, future };
  }, [reminders]);

  return (
    <div className="min-h-screen bg-[#1a202c] text-white flex flex-col items-center">
      {/* Main Container - Mobile Responsive */}
      <div className={`w-full ${isFramed ? 'max-w-[430px]' : 'max-w-2xl'} min-h-screen flex flex-col bg-[#242e3d] shadow-2xl relative border-x border-gray-700/60`}>
        {/* Header (Clean: Title, 最新化, 説明書) */}
        <Header
          onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
          isFramed={isFramed}
          onToggleFrame={() => setIsFramed(!isFramed)}
        />

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-700/80 bg-[#1c2430] sticky top-0 z-30 shadow-xs">
          <button
            type="button"
            onClick={() => {
              setCurrentTab('schedule');
              setIsSelectionMode(false);
            }}
            className={`flex-1 py-3 text-center font-bold text-sm transition cursor-pointer border-b-2 flex items-center justify-center gap-2 ${
              currentTab === 'schedule'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>📅 予定表</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900/80 text-blue-200 border border-blue-600/40 font-mono">
              {reminders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentTab('completed');
              setIsSelectionMode(false);
            }}
            className={`flex-1 py-3 text-center font-bold text-sm transition cursor-pointer border-b-2 flex items-center justify-center gap-2 ${
              currentTab === 'completed'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>🎉 完了</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/80 text-emerald-200 border border-emerald-600/40 font-mono">
              {completed.length}
            </span>
          </button>
        </div>



        {/* Selection Toolbar (for sending to Google Calendar) */}
        {currentTab === 'schedule' && reminders.length > 0 && (
          <div className="bg-[#1f2937] px-3.5 py-2 border-b border-gray-700/70 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) setSelectedReminderIds(new Set());
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 border ${
                  isSelectionMode
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-[#2d3748] hover:bg-gray-700 text-gray-300 border-gray-600'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isSelectionMode ? '選択終了' : '選択して一括送信'}</span>
              </button>

              {isSelectionMode && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold transition cursor-pointer text-[11px]"
                >
                  {selectedReminderIds.size === reminders.length ? '全解除' : '全選択'}
                </button>
              )}
            </div>

            {isSelectionMode && selectedReminderIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchExportToCalendar}
                disabled={isBatchExporting}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{isBatchExporting ? '送信中...' : `${selectedReminderIds.size}件をカレンダーに送信`}</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 1: Schedules List */}
        {currentTab === 'schedule' && (
          <div className="flex-1 p-3.5 space-y-4 pb-24">
            {reminders.length === 0 ? (
              <div className="text-center py-16 text-gray-400 space-y-3">
                <span className="text-5xl block animate-bounce">🔔</span>
                <p className="font-bold text-base text-gray-300">登録されたリマインダーはありません</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  下の「＋ 予定を追加する」ボタンから、アラーム予定を作成できます。
                </p>
              </div>
            ) : (
              <>
                {/* Past Reminders */}
                {categorizedReminders.past.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase tracking-wider px-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>予定時刻を過ぎています ({categorizedReminders.past.length})</span>
                    </div>
                    <div className="space-y-2">
                      {categorizedReminders.past.map((item) => (
                        <ReminderCard
                          key={item.id}
                          reminder={item}
                          category="past"
                          onEdit={(r) => {
                            setEditingItem(r);
                            setIsEditingFromCompleted(false);
                            setIsReminderModalOpen(true);
                          }}
                          onComplete={handleCompleteReminder}
                          onPushToCalendar={handlePushToGoogleCalendar}
                          onUnlinkCalendar={handleUnlinkCalendar}
                          isPushingCalendar={pushingReminderId === item.id}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedReminderIds.has(item.id)}
                          onToggleSelect={toggleSelectReminder}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Today Reminders */}
                {categorizedReminders.today.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider px-1">
                      <span>⏰ 本日の予定 ({categorizedReminders.today.length})</span>
                    </div>
                    <div className="space-y-2">
                      {categorizedReminders.today.map((item) => (
                        <ReminderCard
                          key={item.id}
                          reminder={item}
                          category="today"
                          onEdit={(r) => {
                            setEditingItem(r);
                            setIsEditingFromCompleted(false);
                            setIsReminderModalOpen(true);
                          }}
                          onComplete={handleCompleteReminder}
                          onPushToCalendar={handlePushToGoogleCalendar}
                          onUnlinkCalendar={handleUnlinkCalendar}
                          isPushingCalendar={pushingReminderId === item.id}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedReminderIds.has(item.id)}
                          onToggleSelect={toggleSelectReminder}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Future Reminders */}
                {categorizedReminders.future.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 uppercase tracking-wider px-1">
                      <span>📅 明日以降の予定 ({categorizedReminders.future.length})</span>
                    </div>
                    <div className="space-y-2">
                      {categorizedReminders.future.map((item) => (
                        <ReminderCard
                          key={item.id}
                          reminder={item}
                          category="future"
                          onEdit={(r) => {
                            setEditingItem(r);
                            setIsEditingFromCompleted(false);
                            setIsReminderModalOpen(true);
                          }}
                          onComplete={handleCompleteReminder}
                          onPushToCalendar={handlePushToGoogleCalendar}
                          onUnlinkCalendar={handleUnlinkCalendar}
                          isPushingCalendar={pushingReminderId === item.id}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedReminderIds.has(item.id)}
                          onToggleSelect={toggleSelectReminder}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Completed List */}
        {currentTab === 'completed' && (
          <div className="flex-1 p-3.5 space-y-3 pb-24">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-gray-400">完了履歴 ({completed.length}件)</span>
              {completed.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllCompleted}
                  className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>全履歴を削除</span>
                </button>
              )}
            </div>

            {completed.length === 0 ? (
              <div className="text-center py-16 text-gray-400 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto text-gray-600 stroke-[1.5]" />
                <p className="font-bold text-base text-gray-300">完了したリマインダーはありません</p>
                <p className="text-xs text-gray-500">
                  予定を達成して「完了」ボタンを押すと、ここに履歴が保存されます。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {completed.map((item) => (
                  <CompletedCard
                    key={item.id}
                    item={item}
                    onRestore={handleRestoreReminder}
                    onDelete={handleDeleteCompleted}
                    onEdit={(r) => {
                      setEditingItem(r);
                      setIsEditingFromCompleted(true);
                      setIsReminderModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating Action Button (Add Reminder) */}
        {currentTab === 'schedule' && !isSelectionMode && (
          <div className="fixed bottom-6 z-40 max-w-[430px] w-full px-4 pointer-events-none flex justify-center">
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsEditingFromCompleted(false);
                setIsReminderModalOpen(true);
              }}
              className="pointer-events-auto w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-98 text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 transition cursor-pointer border border-blue-400/40"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>予定を追加する</span>
            </button>
          </div>
        )}

        {/* Toast Message */}
        {toastMessage && (
          <div className="fixed bottom-20 z-50 max-w-[400px] w-[90%] left-1/2 -translate-x-1/2 bg-gray-900/95 text-white border border-gray-600 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold text-center animate-in fade-in slide-in-from-bottom-2">
            {toastMessage}
          </div>
        )}
      </div>

      {/* Reminder Create/Edit Modal */}
      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => {
          setIsReminderModalOpen(false);
          setEditingItem(null);
          setIsEditingFromCompleted(false);
        }}
        onSave={handleSaveReminder}
        targetItem={editingItem}
        customSounds={customSounds}
        onAddCustomSounds={handleAddCustomSounds}
        onDeleteCustomSound={handleDeleteCustomSound}
        onDelete={editingItem ? handleDeleteReminder : undefined}
      />

      {/* Triggered Alarm Fullscreen Modal */}
      <AlarmModal
        alarm={activeAlarm}
        onStop={() => {
          stopAlarmSound();
          stopNativeAlarm();
          setActiveAlarm(null);
        }}
        onSnooze={(alarmData) => {
          stopAlarmSound();
          stopNativeAlarm();
          setActiveAlarm(null);
          const item = alarmData.reminder;
          const snoozeMin = item.snooze_min || 5;
          const nextTime = new Date(Date.now() + snoozeMin * 60 * 1000);
          const updated = reminders.map((r) =>
            r.id === item.id ? { ...r, snoozed_until: formatDateTime(nextTime) } : r
          );
          updateRemindersState(updated);
          showToast(`💤 ${snoozeMin}分間スヌーズしました`);
        }}
        onCompleteDirectly={(alarmData) => {
          stopAlarmSound();
          stopNativeAlarm();
          setActiveAlarm(null);
          handleCompleteReminder(alarmData.reminder);
        }}
      />

      {/* Smartphone QR Code & Home Screen Installation Modal */}
      <PhoneShareModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
      />

      {/* Confirmation Dialog for Destructive Operations */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel || '削除する'}
        cancelLabel="キャンセル"
        isDestructive={true}
        requireTwoStep={confirmDialog.requireTwoStep}
        stepOneConfirmLabel={confirmDialog.stepOneConfirmLabel}
        stepTwoTitle={confirmDialog.stepTwoTitle}
        stepTwoMessage={confirmDialog.stepTwoMessage}
        stepTwoCheckboxLabel={confirmDialog.stepTwoCheckboxLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export { App };
