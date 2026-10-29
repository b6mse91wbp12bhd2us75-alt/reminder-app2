import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { ReminderItem } from '../types/reminder';
import { parseDateTime, parseNoticesString } from '../utils/dateUtils';

/**
 * Service to handle native Android Alarm / LocalNotification system.
 * Uses real Capacitor LocalNotifications plugin import to ensure plugin is registered in Android runtime.
 */

// Unique channel ID for high-priority loud reminder alarms.
// Bumping to v4 to ensure Android OS applies the newly assigned alarm_ring.wav sound configuration.
export const ALARM_CHANNEL_ID = 'reminder_alarm_channel_v4';

// Convert string ID into a deterministic 32-bit positive integer for Android notification IDs
export const hashIdToNumber = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash % 2147483647);
};

/**
 * Initialize notification channels, permissions, and audio wake setup.
 */
export const initNativeAlarmSystem = async () => {
  try {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Request permissions on Android
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // Clean up older channels so Android doesn't get confused
    try {
      await LocalNotifications.deleteChannel({ id: 'reminder_alarm_channel_v1' });
      await LocalNotifications.deleteChannel({ id: 'reminder_alarm_channel_v2' });
      await LocalNotifications.deleteChannel({ id: 'reminder_alarm_channel_v3' });
    } catch {}

    // Create high-importance Android Notification Channel with alarm sound
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'リマインダー大音量アラーム (高優先度)',
      description: '予定の時刻に音とバイブレーションで通知する高優先度チャンネル',
      importance: 5, // High importance (heads-up banner, sound, vibrate)
      visibility: 1, // Public on lockscreen
      vibration: true,
      lights: true,
      lightColor: '#10B981',
      sound: 'alarm_ring.wav', // Real sound bundled in res/raw/alarm_ring.wav
    });
  } catch (err) {
    console.warn('[NativeAlarm] Init warning:', err);
  }
};

/**
 * Schedule a native reminder and its pre-notices in Android OS AlarmManager
 */
export const scheduleNativeReminder = async (item: ReminderItem) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const now = Date.now();
  const notificationsToSchedule: any[] = [];

  // 1. Calculate Main Target Time
  let targetDate = parseDateTime(item.target_time);
  if (item.snoozed_until) {
    const sDate = new Date(item.snoozed_until);
    if (!isNaN(sDate.getTime())) {
      targetDate = sDate;
    }
  }

  if (!targetDate) return;

  let mainTimestamp = targetDate.getTime();
  const baseId = hashIdToNumber(item.id);

  // If user selected current minute (e.g., target is at :00 but current seconds is :15),
  // do NOT discard it! Schedule it for 5 seconds from now so it actually rings.
  if (mainTimestamp <= now) {
    const diff = now - mainTimestamp;
    if (diff < 60 * 1000) {
      // Within the same minute: schedule 5 seconds in future
      mainTimestamp = now + 5000;
    } else {
      // Over 1 minute in the past: don't ring past events
      return;
    }
  }

  // Schedule main alarm with exact allowWhileIdle
  notificationsToSchedule.push({
    id: baseId,
    title: `⏰ リマインダー: ${item.title}`,
    body: item.memo || '予定の時刻になりました。確認してください。',
    channelId: ALARM_CHANNEL_ID,
    sound: 'alarm_ring.wav',
    schedule: {
      at: new Date(mainTimestamp),
      allowWhileIdle: true, // Wakes phone from Doze sleep (AlarmManager.setExactAndAllowWhileIdle)
    },
    extra: {
      reminderId: item.id,
      isPreNotice: false,
    },
    smallIcon: 'ic_launcher',
  });

  // 2. Pre-notices (事前通知)
  if (item.notices && item.notices !== 'なし' && !item.snoozed_until) {
    const preList = parseNoticesString(item.notices);
    preList.forEach((p, idx) => {
      const msBefore = p.sec * 1000;
      const preTime = mainTimestamp - msBefore;
      if (preTime > now + 1000) {
        notificationsToSchedule.push({
          id: baseId + 10000 + idx,
          title: `🔔 事前通知 [${p.label}]: ${item.title}`,
          body: item.memo ? `[${p.label}] ${item.memo}` : `${p.label}の事前通知です。`,
          channelId: ALARM_CHANNEL_ID,
          sound: 'alarm_ring.wav',
          schedule: {
            at: new Date(preTime),
            allowWhileIdle: true,
          },
          extra: {
            reminderId: item.id,
            isPreNotice: true,
            label: p.label,
          },
          smallIcon: 'ic_launcher',
        });
      }
    });
  }

  if (notificationsToSchedule.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    } catch (e) {
      console.warn('[NativeAlarm] Schedule failed:', e);
    }
  }
};

/**
 * Schedule an instant 10-second test alarm.
 * Allows user to tap, immediately close the app, lock screen, and verify it rings in 10s.
 */
export const scheduleQuickTestAlarm = async (delaySeconds = 10): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await initNativeAlarmSystem();
    const testTime = new Date(Date.now() + delaySeconds * 1000);
    const testId = 999999;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: testId,
          title: '⏰【テスト成功】アラームが作動しました！',
          body: `アプリを閉じた状態（画面OFF）での発火テストに成功しました！`,
          channelId: ALARM_CHANNEL_ID,
          sound: 'alarm_ring.wav',
          schedule: {
            at: testTime,
            allowWhileIdle: true,
          },
          smallIcon: 'ic_launcher',
        },
      ],
    });
    return true;
  } catch (e) {
    console.error('Failed to schedule quick test:', e);
    return false;
  }
};

/**
 * Register an alarm directly in the Android System Clock (標準時計・アラームアプリ) via Android Intent.
 * This is the ultimate fallback: guaranteed by the Android OS Clock subsystem.
 */
export const setSystemClockAlarm = (hour: number, minute: number, title: string): boolean => {
  try {
    const encodedTitle = encodeURIComponent(title || 'リマインダー');
    const intentUrl = `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.HOUR=${hour};i.android.intent.extra.MINUTES=${minute};S.android.intent.extra.MESSAGE=${encodedTitle};B.android.intent.extra.SKIP_UI=false;end`;
    window.location.href = intentUrl;
    return true;
  } catch (e) {
    console.warn('System Clock Alarm intent error:', e);
    return false;
  }
};

/**
 * Cancel native notifications for a specific reminder
 */
export const cancelNativeReminder = async (itemOrId: ReminderItem | string) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const idStr = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  const baseId = hashIdToNumber(idStr);

  const idsToCancel = [{ id: baseId }];
  // Cancel potential pre-notice IDs (up to 10 notices)
  for (let i = 0; i < 10; i++) {
    idsToCancel.push({ id: baseId + 10000 + i });
  }

  try {
    await LocalNotifications.cancel({ notifications: idsToCancel });
  } catch (e) {
    console.warn('[NativeAlarm] Cancel failed:', e);
  }
};

/**
 * Synchronize all active reminders with Android OS Native AlarmManager.
 */
export const syncAllNativeReminders = async (reminders: ReminderItem[]) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending && pending.notifications && pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    for (const rem of reminders) {
      await scheduleNativeReminder(rem);
    }
  } catch (err) {
    console.warn('[NativeAlarm] syncAllNativeReminders error:', err);
  }
};
