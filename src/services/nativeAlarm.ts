import { registerPlugin, Capacitor } from '@capacitor/core';
import { ReminderItem } from '../types/reminder';
import { parseDateTime } from '../utils/dateUtils';

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
}

const NativeAlarm = registerPlugin<NativeAlarmPluginInterface>('NativeAlarm');

export const initNativeAlarmSystem = async () => Promise.resolve();
export const setSystemClockAlarm = () => true;

export const scheduleNativeReminder = async (item: ReminderItem) => {
  if (!Capacitor.isNativePlatform()) return;

  const now = Date.now();
  let targetDate = parseDateTime(item.target_time);
  if (item.snoozed_until) {
    const sDate = new Date(item.snoozed_until);
    if (!isNaN(sDate.getTime())) targetDate = sDate;
  }
  if (!targetDate) return;

  let mainTimestamp = targetDate.getTime();
  if (mainTimestamp <= now) {
    const diff = now - mainTimestamp;
    if (diff < 60 * 1000) mainTimestamp = now + 5000;
    else return;
  }

  try {
    await NativeAlarm.scheduleAlarm({
      id: item.id,
      title: item.title,
      memo: item.memo,
      timestamp: mainTimestamp,
      audioBase64: item.custom_sound_url,
      duration: item.duration || 15,
      volume: item.volume !== undefined ? item.volume : 70,
    });
  } catch (err) {
    console.warn('[NativeAlarm] Failed to schedule:', err);
  }
};

export const cancelNativeReminder = async (itemOrId: ReminderItem | string) => {
  if (!Capacitor.isNativePlatform()) return;
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  try {
    await NativeAlarm.cancelAlarm({ id });
  } catch (err) {
    console.warn('[NativeAlarm] Failed to cancel:', err);
  }
};

export const stopNativeAlarm = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await NativeAlarm.stopAlarm();
  } catch (err) {
    console.warn('[NativeAlarm] Failed to stop:', err);
  }
};

export const syncAllNativeReminders = async (reminders: ReminderItem[]) => {
  if (!Capacitor.isNativePlatform()) return;
  for (const rem of reminders) {
    await scheduleNativeReminder(rem);
  }
};
