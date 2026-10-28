import { getAccessToken, clearAccessToken } from './firebase';
import { ReminderItem } from '../types/reminder';
import { parseNoticesString } from '../utils/dateUtils';

export interface CalendarEventPayload {
  title: string;
  memo: string;
  targetTime: string; // "YYYY-MM-DD HH:mm"
  parsedNoticesSec?: { label: string; sec: number }[];
  eventId?: string | null;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * Parses YYYY-MM-DD HH:mm to ISO string in local timezone
 */
function toLocalIsoString(targetTimeStr: string): { startIso: string; endIso: string } {
  const [datePart, timePart] = targetTimeStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  const startDate = new Date(year, month - 1, day, hour, minute, 0);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default duration

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}

/**
 * Push a single reminder to Google Calendar (Insert or Update)
 */
export const pushReminderToGoogleCalendar = async (
  reminder: ReminderItem
): Promise<string> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Googleアカウントへのログイン（連携）が必要です。');
  }

  const parsedNotices = parseNoticesString(reminder.notices || '');
  const eventId = await saveToGoogleCalendar({
    title: reminder.title,
    memo: reminder.memo,
    targetTime: reminder.target_time,
    parsedNoticesSec: parsedNotices,
    eventId: reminder.google_event_id || undefined,
  });

  if (!eventId) {
    throw new Error('カレンダーへの予定追加に失敗しました。');
  }

  return eventId;
};

export const saveToGoogleCalendar = async (
  payload: CalendarEventPayload
): Promise<string | null> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Googleアカウントへのログインが必要です');
  }

  const { title, memo, targetTime, parsedNoticesSec = [], eventId } = payload;
  const { startIso, endIso } = toLocalIsoString(targetTime);

  const overrides: { method: string; minutes: number }[] = [
    { method: 'popup', minutes: 0 },
  ];

  for (const notice of parsedNoticesSec) {
    const mins = Math.floor(notice.sec / 60);
    if (mins > 0 && !overrides.some((o) => o.minutes === mins)) {
      overrides.push({ method: 'popup', minutes: mins });
    }
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';

  const bodyData = {
    summary: title,
    description: memo ? `${memo}\n\n[リマインダー連携アプリから送信]` : '[リマインダー連携アプリから送信]',
    start: {
      dateTime: startIso,
      timeZone,
    },
    end: {
      dateTime: endIso,
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides,
    },
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (eventId) {
    // Update existing event
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(bodyData),
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data.id;
      }
      if (res.status === 401) {
        clearAccessToken();
        throw new Error('Google連携の有効期限が切れました。右上の「カレンダー連携」から再接続してください。');
      }
    } catch (err: any) {
      if (err.message?.includes('Google連携の有効期限')) throw err;
      console.warn('Update failed, falling back to create new event', err);
    }
  }

  // Insert new event
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      clearAccessToken();
      throw new Error('Google連携の有効期限が切れました。右上の「カレンダー連携」から再接続してください。');
    }
    const errText = await res.text();
    throw new Error(`Googleカレンダーへの追加に失敗しました: ${errText}`);
  }

  const created = await res.json();
  return created.id;
};

export const deleteFromGoogleCalendar = async (eventId: string): Promise<boolean> => {
  if (!eventId) return false;
  const token = await getAccessToken();
  if (!token) {
    console.warn('No token available to delete Google Calendar event');
    return false;
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.ok || res.status === 404; // 404 means already deleted
  } catch (err) {
    console.error('Failed to delete Google Calendar event:', err);
    return false;
  }
};
