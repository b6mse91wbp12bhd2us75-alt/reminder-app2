export interface NoticeOption {
  id: string;
  value: number | string;
  unit: '分前' | '時間前' | '日前' | '週間前';
}

export interface ReminderItem {
  id: string;
  title: string;
  memo: string;
  sound: string;
  duration: number; // 鳴らす秒数 (0 = 無限)
  repeat: string; // 'なし' | '毎日' | '毎週' | '毎月' | '毎年' | '〇日おき'
  notices: string; // e.g. "1日前, 30分前" or "なし"
  snooze_min: number; // スヌーズ分数 (default 5)
  target_time: string; // "YYYY-MM-DD HH:mm"
  google_event_id?: string | null;
  sync_with_google?: boolean;
  completed_time?: string;
  snoozed_until?: string | null;
  custom_sound_url?: string;
  custom_sound_name?: string;
  volume?: number; // 音量 0〜100 (0 = 消音・バイブのみ, 70 = 標準)
}

export interface TriggeredAlarm {
  reminder: ReminderItem;
  isPreNotice: boolean;
  preLabel?: string;
  alarmKey: string;
}
