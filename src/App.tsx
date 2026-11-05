import React, { useState, useEffect, useRef, useMemo } from 'react';
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

  // Simple toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Smartphone frame mockup toggle for desktop
  const [isFramed, setIsFramed] = useState(true);

  // 1. Initial Load from LocalStorage & IndexedDB
  useEffect(() => {
    getAllCustomSounds().then((sounds) => {
      if (sounds && sounds.length > 0) {
        setCustomSounds(sounds);
      }
    });

    const savedReminders = localStorage.getItem(STORAGE_REMINDERS_KEY);
    const savedCompleted = localStorage.getItem(STORAGE_COMPLETED_KEY);

    if (savedReminders) {
      try {
        let parsed: ReminderItem[] = JSON.parse(savedReminders);
        // Automatically roll forward any repeating reminders whose target_time has passed
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

        if (hasChanges) {
          try {
            localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(parsed));
          } catch {}
        }

        setReminders(parsed);
        syncAllNativeReminders(parsed);
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
      syncAllNativeReminders(defaultReminders);
    }

    if (savedCompleted) {
      try {
        setCompleted(JSON.parse(savedCompleted));
      } catch (e) {
        console.error('Failed to parse saved completed', e);
      }
    }

    initNativeAlarmSystem();
    requestNotificationPermission();
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

  // Add or update custom sound
  const handleAddCustomSounds = async (sounds: { name: string; url: string; size?: number; mimeType?: string }[]) => {
    for (const s of sounds) {
      await saveCustomSound(s.name, s.url, s.size, s.mimeType);
    }
    const freshSounds = await getAllCustomSounds();
    setCustomSounds(freshSounds);
    showToast(`🎵 音源「${sounds.map((s) => s.name).join(', ')}」を保存しました`);
  };

  // Delete custom sound
  const handleDeleteCustomSound = async (name: string) => {
    await deleteCustomSound(name);
    const freshSounds = await getAllCustomSounds();
    setCustomSounds(freshSounds);
    showToast(`🗑 音源「${name}」を削除しました`);
  };

  // Timer check loop for browser/PWA fallback
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
    }, 5000);

    return () => clearInterval(timer);
  }, [reminders]);

  const triggerAlarm = (item: ReminderItem, isNotice: boolean, noticeLabel?: string) => {
    if (activeAlarm && activeAlarm.reminder.id === item.id) return;

    setActiveAlarm({
      reminder: item,
      isNotice,
      noticeLabel,
    });

    const vol = (item as any).volume !== undefined ? (item as any).volume : 70;
    playAlarmSound(item.sound, item.custom_sound_url, vol, item.duration || 15);

    const titlePrefix = isNotice ? `📢【事前通知 ${noticeLabel}】` : '⏰【リマインダー】';
    sendSystemNotification(`${titlePrefix} ${item.title}`, {
      body: item.memo || item.target_time,
      requireInteraction: true,
    });
  };

  // Add or Edit Reminder
  const handleSaveReminder = async (newItem: ReminderItem) => {
    let updated: ReminderItem[];

    if (isEditingFromCompleted) {
      setCompleted((prev) => prev.filter((r) => r.id !== newItem.id));
      updateCompletedState(completed.filter((r) => r.id !== newItem.id));
      updated = [newItem, ...reminders];
      setIsEditingFromCompleted(false);
    } else {
      const exists = reminders.some((r) => r.id === newItem.id);
      if (exists) {
        updated = reminders.map((r) => (r.id === newItem.id ? newItem : r));
      } else {
        updated = [newItem, ...reminders];
      }
    }

    updateRemindersState(updated);
    await scheduleNativeReminder(newItem);
    setIsReminderModalOpen(false);
    setEditingItem(null);
    showToast('✅ 予定を保存しました');
  };

  // Delete Reminder
  const handleDeleteReminder = (item: ReminderItem) => {
    setConfirmDialog({
      isOpen: true,
      title: '予定の削除',
      message: `「${item.title}」を削除してもよろしいですか？`,
      onConfirm: async () => {
        const filtered = reminders.filter((r) => r.id !== item.id);
        updateRemindersState(filtered);
        await cancelNativeReminder(item);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('🗑 予定を削除しました');
      },
    });
  };

  // Complete Reminder (Mark as completed)
  const handleCompleteReminder = (item: ReminderItem) => {
    if (item.repeat && item.repeat !== 'なし') {
      const nextTime = calculateNextOccurrence(item.target_time, item.repeat);
      if (nextTime) {
        const updated = reminders.map((r) =>
          r.id === item.id ? { ...r, target_time: nextTime, snoozed_until: undefined } : r
        );
        updateRemindersState(updated);
        scheduleNativeReminder({ ...item, target_time: nextTime, snoozed_until: undefined });
        showToast(`🎉 完了しました！次回予定（${nextTime}）に更新しました`);
        return;
      }
    }

    const remaining = reminders.filter((r) => r.id !== item.id);
    const newCompleted = [{ ...item, completed_at: formatDateTime(new Date()) }, ...completed];

    updateRemindersState(remaining);
    updateCompletedState(newCompleted);
    cancelNativeReminder(item);
    showToast('🎉 予定を完了タブに移動しました');
  };

  // Delete Completed item
  const handleDeleteCompleted = (item: ReminderItem) => {
    const nextCompleted = completed.filter((c) => c.id !== item.id);
    updateCompletedState(nextCompleted);
    showToast('🗑 完了履歴から削除しました');
  };

  // Clear all completed
  const handleClearAllCompleted = () => {
    setConfirmDialog({
      isOpen: true,
      title: '完了済み予定の一括消去',
      message: '完了タブのすべての予定を消去してもよろしいですか？',
      onConfirm: () => {
        updateCompletedState([]);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('🧹 完了履歴をすべて削除しました');
      },
    });
  };

  // Calendar sync single item
  const handleExportSingleToCalendar = async (item: ReminderItem) => {
    setPushingReminderId(item.id);
    try {
      await openAndroidCalendarEvent({
        title: item.title,
        memo: item.memo,
        target_time: item.target_time,
      });
      showToast('📅 Googleカレンダーに予定を送信しました');
    } catch (e) {
      showToast('⚠️ カレンダー送信に失敗しました');
    } finally {
      setPushingReminderId(null);
    }
  };

  // Batch Calendar Export
  const handleBatchExportToCalendar = async () => {
    const selectedList = reminders.filter((r) => selectedReminderIds.has(r.id));
    if (selectedList.length === 0) {
      showToast('送信する予定を選択してください');
      return;
    }

    setIsBatchExporting(true);
    for (const item of selectedList) {
      await openAndroidCalendarEvent({
        title: item.title,
        memo: item.memo,
        target_time: item.target_time,
      });
    }
    setIsBatchExporting(false);
    setIsSelectionMode(false);
    setSelectedReminderIds(new Set());
    showToast(`📅 ${selectedList.length}件の予定をカレンダーに送信しました`);
  };

  // Group active reminders by today / future / past
  const groupedReminders = useMemo(() => {
    const today: ReminderItem[] = [];
    const future: ReminderItem[] = [];
    const past: ReminderItem[] = [];

    const sorted = [...reminders].sort((a, b) => {
      const da = parseDateTime(a.target_time)?.getTime() || 0;
      const db = parseDateTime(b.target_time)?.getTime() || 0;
      return da - db;
    });

    sorted.forEach((item) => {
      const cat = getScheduleCategory(item.target_time);
      if (cat === 'today') today.push(item);
      else if (cat === 'future') future.push(item);
      else past.push(item);
    });

    return { today, future, past };
  }, [reminders]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 z-50 bg-emerald-600 text-white font-medium px-4 py-2 rounded-full shadow-lg text-sm animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <div className={`w-full ${isFramed ? 'max-w-md' : 'max-w-xl'} flex-1 flex flex-col bg-slate-950 min-h-screen shadow-2xl relative border-x border-slate-800`}>
        {/* Header */}
        <Header
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          scheduleCount={reminders.length}
          completedCount={completed.length}
          onOpenPhoneShare={() => setIsPhoneModalOpen(true)}
        />

        {/* Action Toolbar */}
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
          {currentTab === 'schedule' ? (
            <>
              <button
                onClick={() => {
                  if (isSelectionMode) {
                    setIsSelectionMode(false);
                    setSelectedReminderIds(new Set());
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${
                  isSelectionMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {isSelectionMode ? '選択解除' : 'カレンダー選択送信'}
              </button>

              {isSelectionMode && selectedReminderIds.size > 0 && (
                <button
                  onClick={handleBatchExportToCalendar}
                  disabled={isBatchExporting}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isBatchExporting ? '送信中...' : `送信 (${selectedReminderIds.size})`}
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-400 font-medium">完了済みの予定履歴</span>
              {completed.length > 0 && (
                <button
                  onClick={handleClearAllCompleted}
                  className="text-xs px-2.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded border border-rose-900/50 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  すべて消去
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 p-4 overflow-y-auto pb-28">
          {currentTab === 'schedule' ? (
            <div>
              {reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-300">予定はありません</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    下の「+ 予定を追加する」ボタンから新しいリマインダーを作成できます。
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Today Reminders */}
                  {groupedReminders.today.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        今日の予定 ({groupedReminders.today.length})
                      </h3>
                      <div className="space-y-2.5">
                        {groupedReminders.today.map((item) => (
                          <ReminderCard
                            key={item.id}
                            item={item}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedReminderIds.has(item.id)}
                            onToggleSelect={() => {
                              setSelectedReminderIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            onEdit={() => {
                              setEditingItem(item);
                              setIsEditingFromCompleted(false);
                              setIsReminderModalOpen(true);
                            }}
                            onDelete={() => handleDeleteReminder(item)}
                            onComplete={() => handleCompleteReminder(item)}
                            onExportToCalendar={() => handleExportSingleToCalendar(item)}
                            isPushing={pushingReminderId === item.id}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Future Reminders */}
                  {groupedReminders.future.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                        これからの予定 ({groupedReminders.future.length})
                      </h3>
                      <div className="space-y-2.5">
                        {groupedReminders.future.map((item) => (
                          <ReminderCard
                            key={item.id}
                            item={item}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedReminderIds.has(item.id)}
                            onToggleSelect={() => {
                              setSelectedReminderIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            onEdit={() => {
                              setEditingItem(item);
                              setIsEditingFromCompleted(false);
                              setIsReminderModalOpen(true);
                            }}
                            onDelete={() => handleDeleteReminder(item)}
                            onComplete={() => handleCompleteReminder(item)}
                            onExportToCalendar={() => handleExportSingleToCalendar(item)}
                            isPushing={pushingReminderId === item.id}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Past Reminders */}
                  {groupedReminders.past.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        過去・期限切れの予定 ({groupedReminders.past.length})
                      </h3>
                      <div className="space-y-2.5">
                        {groupedReminders.past.map((item) => (
                          <ReminderCard
                            key={item.id}
                            item={item}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedReminderIds.has(item.id)}
                            onToggleSelect={() => {
                              setSelectedReminderIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            onEdit={() => {
                              setEditingItem(item);
                              setIsEditingFromCompleted(false);
                              setIsReminderModalOpen(true);
                            }}
                            onDelete={() => handleDeleteReminder(item)}
                            onComplete={() => handleCompleteReminder(item)}
                            onExportToCalendar={() => handleExportSingleToCalendar(item)}
                            isPushing={pushingReminderId === item.id}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              {completed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-300">完了した予定はありません</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    完了した予定はここに保存され、いつでも再編集・再登録できます。
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {completed.map((item) => (
                    <CompletedCard
                      key={item.id}
                      item={item}
                      onEdit={() => {
                        setEditingItem(item);
                        setIsEditingFromCompleted(true);
                        setIsReminderModalOpen(true);
                      }}
                      onDelete={() => handleDeleteCompleted(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Add Reminder Button (Bottom Bar) */}
        {currentTab === 'schedule' && (
          <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-center pointer-events-none">
            <button
              onClick={() => {
                setEditingItem(null);
                setIsEditingFromCompleted(false);
                setIsReminderModalOpen(true);
              }}
              className="pointer-events-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold px-6 py-3.5 rounded-full shadow-xl flex items-center gap-2 transform active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              予定を追加する
            </button>
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
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        isDestructive={true}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export { App };
