/**
 * Date and time parsing and formatting utilities
 */

export function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  const h = padZero(date.getHours());
  const mi = padZero(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${mi}`;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  return `${y}-${m}-${d}`;
}

export function parseDateTime(str: string): Date | null {
  if (!str) return null;
  try {
    const [datePart, timePart] = str.split(' ');
    if (!datePart || !timePart) return null;
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, min] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, min, 0);
  } catch {
    return null;
  }
}

export type ScheduleCategory = 'past' | 'today' | 'future';

export function getScheduleCategory(targetTimeStr: string): ScheduleCategory {
  const targetDate = parseDateTime(targetTimeStr);
  if (!targetDate) return 'future';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

  if (targetDate.getTime() < todayStart.getTime()) {
    return 'past';
  } else if (targetDate.getTime() < tomorrowStart.getTime()) {
    return 'today';
  } else {
    return 'future';
  }
}

export interface ParsedNotice {
  label: string;
  sec: number;
}

export function parseNoticesString(noticesStr: string): ParsedNotice[] {
  if (!noticesStr || noticesStr === 'なし') return [];
  const parts = noticesStr.split(',').map((p) => p.trim()).filter(Boolean);
  const results: ParsedNotice[] = [];

  for (const part of parts) {
    let sec = 0;
    if (part.includes('分前')) {
      const val = parseFloat(part.replace('分前', ''));
      if (!isNaN(val)) sec = val * 60;
    } else if (part.includes('時間前')) {
      const val = parseFloat(part.replace('時間前', ''));
      if (!isNaN(val)) sec = val * 3600;
    } else if (part.includes('日前')) {
      const val = parseFloat(part.replace('日前', ''));
      if (!isNaN(val)) sec = val * 86400;
    } else if (part.includes('週間前')) {
      const val = parseFloat(part.replace('週間前', ''));
      if (!isNaN(val)) sec = val * 604800;
    }

    if (sec > 0) {
      results.push({ label: part, sec });
    }
  }

  return results;
}

/**
 * Calculates next date string for repeating items
 */
export function calculateNextOccurrence(targetTimeStr: string, repeat: string): string | null {
  const curr = parseDateTime(targetTimeStr);
  if (!curr || repeat === 'なし') return null;

  const next = new Date(curr);

  if (repeat === '毎日') {
    next.setDate(next.getDate() + 1);
  } else if (repeat === '毎週') {
    next.setDate(next.getDate() + 7);
  } else if (repeat === '毎月') {
    next.setMonth(next.getMonth() + 1);
  } else if (repeat === '毎年') {
    next.setFullYear(next.getFullYear() + 1);
  } else if (repeat.includes('日おき')) {
    const days = parseInt(repeat.replace('日おき', '').trim(), 10) || 2;
    next.setDate(next.getDate() + days);
  } else {
    return null;
  }

  return formatDateTime(next);
}

/**
 * Japanese day of week label
 */
export function getJapaneseDayOfWeek(targetTimeStr: string): string {
  const d = parseDateTime(targetTimeStr);
  if (!d) return '';
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `(${days[d.getDay()]})`;
}
