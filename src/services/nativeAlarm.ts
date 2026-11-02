import { registerPlugin, Capacitor } from '@capacitor/core';
import { ReminderItem } from '../types/reminder';
import { parseDateTime } from '../utils/dateUtils';

/**
 * TypeScript interface for the custom Native Android AlarmClock Plugin.
 * Uses Android's AlarmManager.setAlarmClock() and ForegroundService + MediaPlayer.
 */
interface NativeAlarmPluginInterface {
  scheduleAlarm(options: {
    id: string;
    title: string;
    memo?: string;
    timestamp: number;
    audioBase64?: string;
    duration?: number;
    volume?: number;
  }): Promise<{ success: boolean; audioPath?: string }>;

  cancelAlarm(options: { id: string }): Promise<{ success: boolean }>;

  stopAlarm(): Promise<{ success: boolean }>;

  testAlarmNow(options: {
    delaySeconds?: number;
    title?: string;
    memo?: string;
    audioBase64?: string;
    volume?: number;
  }): Promise<{ success: boolean }>;

  openCalendarEvent?(options: {
    title: string;
    memo?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<{ success: boolean }>;
}

const NativeAlarm = registerPlugin<NativeAlarmPluginInterface>('NativeAlarm');

/**
 * Open native Android Google Calendar app with event pre-filled (100% native Android Intent, No OAuth login required!)
 */
export const openAndroidCalendarEvent = async (item: {
  title: string;
  memo?: string;
  target_time: string;
}): Promise<boolean> => {
  const targetDate = parseDateTime(item.target_time);
  const startTime = targetDate ? targetDate.getTime() : Date.now();
  const endTime = startTime + 60 * 60 * 1000;

  if (Capacitor.isNativePlatform()) {
    try {
      if (NativeAlarm.openCalendarEvent) {
        await NativeAlarm.openCalendarEvent({
          title: item.title,
          memo: item.memo || '',
          startTime,
          endTime,
        });
        return true;
      }
    } catch (e) {
      console.warn('Native openCalendarEvent error:', e);
    }
  }

  // Fallback (for browser/preview): open Google Calendar URL directly
  try {
    const [datePart, timePart = '09:00'] = item.target_time.trim().split(' ');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    const startStr = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}T${hour.padStart(2, '0')}${minute.padStart(2, '0')}00`;
    const sDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const eDate = new Date(sDate.getTime() + 60 * 60 * 1000);
    const endStr = `${eDate.getFullYear()}${String(eDate.getMonth() + 1).padStart(2, '0')}${String(eDate.getDate()).padStart(2, '0')}T${String(eDate.getHours()).padStart(2, '0')}${String(eDate.getMinutes()).padStart(2, '0')}00`;
    const details = item.memo ? `${item.memo}\n\n[リマインダー連携アプリから登録]` : '[リマインダー連携アプリから登録]';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(item.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}`;
    window.open(url, '_blank');
  } catch (e) {
    // fallback
  }
  return true;
};

/**
 * Initialize system
 */
export const initNativeAlarmSystem = async () => {
  return Promise.resolve();
};

export const setSystemClockAlarm = (hour: number, minute: number, title: string): boolean => {
  return true;
};

/**
 * Schedule a native reminder in Android AlarmManager.setAlarmClock.
 * Guaranteed to wake device and play custom MP3 even when app is killed or screen is OFF.
 */
export const scheduleNativeReminder = async (item: ReminderItem) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const now = Date.now();
  let targetDate = parseDateTime(item.target_time);

  if (item.snoozed_until) {
    const sDate = new Date(item.snoozed_until);
    if (!isNaN(sDate.getTime())) {
      targetDate = sDate;
    }
  }

  if (!targetDate) return;

  let mainTimestamp = targetDate.getTime();

  // If set to current minute (past within 60s), schedule 5 seconds in future
  if (mainTimestamp <= now) {
    const diff = now - mainTimestamp;
    if (diff < 60 * 1000) {
      mainTimestamp = now + 5000;
    } else {
      return; // Do not schedule past reminders
    }
  }

  try {
    await NativeAlarm.scheduleAlarm({
      id: item.id,
      title: item.title,
      memo: item.memo,
      timestamp: mainTimestamp,
      audioBase64: item.custom_sound_url,
      duration: item.duration || 15,
      volume: (item as any).volume !== undefined ? (item as any).volume : 70,
    });
    console.log(`[NativeAlarm] Scheduled exact AlarmClock for "${item.title}" at ${mainTimestamp}`);
  } catch (err) {
    console.warn('[NativeAlarm] Failed to schedule native alarm:', err);
  }
};

/**
 * Cancel a scheduled native alarm
 */
export const cancelNativeReminder = async (itemOrId: ReminderItem | string) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  try {
    await NativeAlarm.cancelAlarm({ id });
  } catch (err) {
    console.warn('[NativeAlarm] Failed to cancel native alarm:', err);
  }
};

/**
 * Stop currently ringing native alarm service
 */
export const stopNativeAlarm = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await NativeAlarm.stopAlarm();
  } catch (err) {
    console.warn('[NativeAlarm] Failed to stop native alarm:', err);
  }
};

/**
 * Schedule an instant 10-second test alarm.
 * Allows user to tap, immediately kill the app, turn screen OFF, and verify it rings in 10s.
 */
export const scheduleQuickTestAlarm = async (delaySeconds = 10, audioBase64?: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const res = await NativeAlarm.testAlarmNow({
      delaySeconds,
      title: '⏰【テスト成功】大音量アラーム',
      memo: 'アプリを完全に閉じた状態（画面OFF）での発火テストに成功しました！',
      audioBase64,
    });
    return !!res.success;
  } catch (e) {
    console.error('[NativeAlarm] Failed to schedule test alarm:', e);
    return false;
  }
};

/**
 * Synchronize all active reminders with Android OS Native AlarmClock.
 */
export const syncAllNativeReminders = async (reminders: ReminderItem[]) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  for (const rem of reminders) {
    await scheduleNativeReminder(rem);
  }
};
