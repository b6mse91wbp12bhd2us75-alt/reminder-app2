import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReminderItem, TriggeredAlarm } from './types/reminder';
import { Header } from './components/Header';
import { ReminderCard } from './components/ReminderCard';
import { CompletedCard } from './components/CompletedCard';
import { ReminderModal } from './components/ReminderModal';
import { AlarmModal } from './components/AlarmModal';
import { GoogleSyncModal } from './components/GoogleSyncModal';
import { PhoneShareModal } from './components/PhoneShareModal';
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
  scheduleNativeReminder,
  cancelNativeReminder,
  syncAllNativeReminders,
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

  const [isFramed, setIsFramed] = useState(true);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const remindersRef = useRef<ReminderItem[]>(reminders);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  // 1. Load initial data
  useEffect(() => {
    try {
      const savedReminders = localStorage.getItem(STORAGE_REMINDERS_KEY);
      const savedCompleted = localStorage.getItem(STORAGE_COMPLETED_KEY);

      // Load custom sounds from IndexedDB (no 5MB limit)
      getAllCustomSounds().then((sounds) => {
        if (sounds && sounds.length > 0) {
          setCustomSounds(sounds);
        }
      });

      if (savedReminders) {
        setReminders(JSON.parse(savedReminders));
      } else {
        // Friendly test & sample reminders
        const now = new Date();
        const test5MinLater = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins later
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

    // Automatically sync alarms with Android OS on startup
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
      }).catch((e) => console.warn('Save sound error:', e));
    }
    setCustomSounds(merged);
    showToast(`🎵 音源「${newSounds[newSounds.length - 1].name}」を追加・保存しました！`);
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
      () => setHasToken(false)
    );
    return () => unsubscribe();
  }, []);

  // Timer loop for foreground alarms
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

  const triggerAlarm = (reminder: ReminderItem, isPreNotice = false, preLabel = '') => {
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
          if (eventId) googleEventId = eventId;
        }
      } catch (err: any) {
        showToast(`Googleカレンダー送信エラー: ${err.message || '通信エラー'}`);
      }
    } else if (item.google_event_id) {
      try {
        await deleteFromGoogleCalendar(item.google_event_id);
        googleEventId = null;
      } catch {}
    }

    const finalItem: ReminderItem = {
      ...item,
      google_event_id: googleEventId,
      sync_with_google: item.sync_with_google ?? !!googleEventId,
    };

    if (isEditingFromCompleted) {
      const newCompleted = completed.filter((c) => c.id !== item.id);
      saveCompletedToStorage(newCompleted);
      saveRemindersToStorage([finalItem, ...reminders]);
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
      <div className={`w-full bg-[#2d3748] flex flex-col shadow-2xl transition-all duration-200 overflow-hidden ${
        isFramed ? 'max-w-[420px] md:h-[900px] md:rounded-[40px] md:border-4 md:border-gray-700/80' : 'max-w-2xl min-h-screen md:rounded-2xl'
      }`}>
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
              className="text-emerald-300 hover:text-white ml-2 text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {currentTab === 'schedule' ? (
            <div className="space-y-4">
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
                        onEdit={(r) => {
                          setEditingItem(r);
                          setIsEditingFromCompleted(false);
                          setIsReminderModalOpen(true);
                        }}
                        onComplete={handleCompleteReminder}
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
                        onEdit={(r) => {
                          setEditingItem(r);
                          setIsEditingFromCompleted(false);
                          setIsReminderModalOpen(true);
                        }}
                        onComplete={handleCompleteReminder}
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
                        onEdit={(r) => {
                          setEditingItem(r);
                          setIsEditingFromCompleted(false);
                          setIsReminderModalOpen(true);
                        }}
                        onComplete={handleCompleteReminder}
                      />
                    ))}
                  </div>
                </section>
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
              <div className="space-y-2.5">
                {completed.map((item) => (
                  <CompletedCard
                    key={item.id}
                    item={item}
                    onEdit={(it) => {
                      setEditingItem(it);
                      setIsEditingFromCompleted(true);
                      setIsReminderModalOpen(true);
                    }}
                    onDelete={(it) => {
                      const updated = completed.filter((c) => c.id !== it.id);
                      saveCompletedToStorage(updated);
                    }}
                  />
                ))}
              </div>
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
        onSignOut={() => logout().then(() => setUser(null))}
      />

      <PhoneShareModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
      />
    </div>
  );
}
