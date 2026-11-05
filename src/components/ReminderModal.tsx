import React, { useState, useEffect, useRef } from 'react';
import { ReminderItem, NoticeOption } from '../types/reminder';
import { PRESET_SOUNDS, previewSound, stopAlarmSound } from '../services/audio';
import { padZero } from '../utils/dateUtils';
import { NumberStepper } from './NumberStepper';
import { X, Volume2, Plus, Play, Square, Clock, RefreshCw, Trash2, Check, Bell } from 'lucide-react';
import { User } from 'firebase/auth';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: ReminderItem) => Promise<void>;
  targetItem: ReminderItem | null;
  user?: User | null;
  onGoogleSignIn?: () => Promise<any>;
  customSounds?: { name: string; url: string }[];
  onAddCustomSounds?: (sounds: { name: string; url: string; size?: number; mimeType?: string }[]) => void;
  onDeleteCustomSound?: (name: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  targetItem,
  customSounds = [],
  onAddCustomSounds,
  onDeleteCustomSound,
}) => {
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [syncWithGoogle, setSyncWithGoogle] = useState(false);

  // Date/Time
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState(padZero(now.getMonth() + 1));
  const [day, setDay] = useState(padZero(now.getDate()));
  const [hour, setHour] = useState(padZero(now.getHours()));
  const [minute, setMinute] = useState(padZero(now.getMinutes()));

  // Repeat
  const [repeatType, setRepeatType] = useState('なし');
  const [intervalDays, setIntervalDays] = useState('2');

  // Snooze and Duration
  const [snoozeMin, setSnoozeMin] = useState('5');
  const [durationSec, setDurationSec] = useState('5');

  // Advance notices
  const [notices, setNotices] = useState<NoticeOption[]>([]);

  // Sound
  const [sound, setSound] = useState<string>(PRESET_SOUNDS[0].name);
  const [customSoundUrl, setCustomSoundUrl] = useState<string | undefined>(undefined);
  const [customSoundName, setCustomSoundName] = useState<string | undefined>(undefined);
  const [volume, setVolume] = useState<number>(70);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [soundFeedback, setSoundFeedback] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form
  useEffect(() => {
    if (!isOpen) {
      stopAlarmSound();
      setIsPlayingTest(false);
      return;
    }

    const currentNow = new Date();

    if (targetItem) {
      setTitle(targetItem.title || '');
      setMemo(targetItem.memo || '');
      setSyncWithGoogle(!!targetItem.google_event_id);
      const currentSound = targetItem.sound || PRESET_SOUNDS[0].name;
      setSound(currentSound);
      const matched = customSounds.find((cs) => cs.name === currentSound);
      setCustomSoundUrl(matched ? matched.url : targetItem.custom_sound_url);
      setCustomSoundName(matched ? matched.name : targetItem.custom_sound_name);
      setVolume((targetItem as any)?.volume !== undefined ? (targetItem as any).volume : 70);
      setSnoozeMin(targetItem.snooze_min ? targetItem.snooze_min.toString() : '5');
      setDurationSec(targetItem.duration !== undefined ? targetItem.duration.toString() : '5');

      if (targetItem.target_time) {
        const [dPart, tPart] = targetItem.target_time.split(' ');
        if (dPart && tPart) {
          const [y, m, d] = dPart.split('-');
          const [h, mi] = tPart.split(':');
          setYear(y);
          setMonth(m);
          setDay(d);
          setHour(h);
          setMinute(mi);
        }
      }

      if (targetItem.repeat) {
        if (targetItem.repeat.includes('日おき')) {
          setRepeatType('〇日おき');
          setIntervalDays(targetItem.repeat.replace('日おき', '').trim() || '2');
        } else {
          setRepeatType(targetItem.repeat);
        }
      } else {
        setRepeatType('なし');
      }

      // Parse notices: if empty or 'なし', keep it completely EMPTY! (No resurrection of 1日前)
      if (targetItem.notices && targetItem.notices !== 'なし' && targetItem.notices.trim() !== '') {
        const parsedList: NoticeOption[] = [];
        const parts = targetItem.notices.split(',');
        parts.forEach((p, idx) => {
          const trimmed = p.trim();
          for (const u of ['分前', '時間前', '日前', '週間前'] as const) {
            if (trimmed.includes(u)) {
              const val = parseFloat(trimmed.replace(u, '')) || 1;
              parsedList.push({
                id: `notice-${idx}-${Date.now()}`,
                value: val,
                unit: u,
              });
              break;
            }
          }
        });
        setNotices(parsedList);
      } else {
        setNotices([]);
      }
    } else {
      // New reminder defaults: Default to NO advance notice!
      setTitle('');
      setMemo('');
      setSyncWithGoogle(false);
      setSound(PRESET_SOUNDS[0].name);
      setCustomSoundUrl(undefined);
      setCustomSoundName(undefined);
      setVolume(70);
      setRepeatType('なし');
      setIntervalDays('2');
      setSnoozeMin('5');
      setDurationSec('5');
      setNotices([]);

      // Current Time
      setYear(currentNow.getFullYear().toString());
      setMonth(padZero(currentNow.getMonth() + 1));
      setDay(padZero(currentNow.getDate()));
      setHour(padZero(currentNow.getHours()));
      setMinute(padZero(currentNow.getMinutes()));
    }
  }, [isOpen, targetItem]);

  if (!isOpen) return null;

  const currentYearNum = now.getFullYear();
  const yearOptions = Array.from({ length: 7 }, (_, i) => (currentYearNum + i).toString());
  const monthOptions = Array.from({ length: 12 }, (_, i) => padZero(i + 1));
  const dayOptions = Array.from({ length: 31 }, (_, i) => padZero(i + 1));
  const hourOptions = Array.from({ length: 24 }, (_, i) => padZero(i));
  const minuteOptions = Array.from({ length: 60 }, (_, i) => padZero(i));

  const setQuickTimer = (offsetMinutes: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + offsetMinutes);
    setYear(d.getFullYear().toString());
    setMonth(padZero(d.getMonth() + 1));
    setDay(padZero(d.getDate()));
    setHour(padZero(d.getHours()));
    setMinute(padZero(d.getMinutes()));
  };

  const handleAddNotice = () => {
    setNotices((prev) => [
      ...prev,
      {
        id: `notice-${Date.now()}-${Math.random()}`,
        value: 10,
        unit: '分前',
      },
    ]);
  };

  const handleRemoveNotice = (id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNoticeChange = (id: string, field: 'value' | 'unit', val: any) => {
    setNotices((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: val } : n))
    );
  };

  const handleTestSound = () => {
    if (isPlayingTest) {
      stopAlarmSound();
      setIsPlayingTest(false);
    } else {
      setIsPlayingTest(true);
      const matched = customSounds.find((cs) => cs.name === sound);
      const urlToPlay = matched ? matched.url : customSoundUrl;
      previewSound(sound, urlToPlay, volume);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.mp3') && !file.type.includes('audio')) {
      alert('MP3形式の音声ファイルを選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (onAddCustomSounds) {
        onAddCustomSounds([{
          name: file.name,
          url: base64,
          size: file.size,
          mimeType: file.type || 'audio/mpeg',
        }]);
      }
      setSound(file.name);
      setCustomSoundUrl(base64);
      setCustomSoundName(file.name);
      setSoundFeedback(`🎵 音源「${file.name}」を取り込みました！`);
      setTimeout(() => setSoundFeedback(null), 4000);
    };

    reader.onerror = () => {
      alert(`「${file.name}」の読み込みに失敗しました。`);
      setSoundFeedback(null);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteSelectedCustomSound = () => {
    if (!onDeleteCustomSound) return;
    if (window.confirm(`登録音源「${sound}」を削除しますか？`)) {
      onDeleteCustomSound(sound);
      setSound(PRESET_SOUNDS[0].name);
      setCustomSoundUrl(undefined);
      setCustomSoundName(undefined);
      setSoundFeedback(`「${sound}」を削除しました。`);
      setTimeout(() => setSoundFeedback(null), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('予定のタイトルを入力してください。');
      return;
    }

    let finalRepeat = repeatType;
    if (repeatType === '〇日おき') {
      const days = parseInt(intervalDays.trim(), 10);
      if (isNaN(days) || days <= 0) {
        alert('〇日おきの間隔には1以上の正の整数を入力してください。');
        return;
      }
      finalRepeat = `${days}日おき`;
    }

    const validNotices = notices
      .filter((n) => Number(n.value) > 0)
      .map((n) => `${Number(n.value)}${n.unit}`);
    const noticesStr = validNotices.length > 0 ? validNotices.join(', ') : 'なし';

    const matchedSound = customSounds.find((cs) => cs.name === sound);
    const soundUrl = matchedSound ? matchedSound.url : customSoundUrl;

    const reminderData: ReminderItem = {
      id: targetItem?.id || `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      memo: memo.trim(),
      target_time: `${year}-${month}-${day} ${hour}:${minute}`,
      repeat: finalRepeat,
      notices: noticesStr,
      sound,
      custom_sound_url: soundUrl,
      custom_sound_name: customSoundName || (matchedSound ? matchedSound.name : undefined),
      volume,
      snooze_min: parseInt(snoozeMin, 10) || 5,
      duration: parseInt(durationSec, 10) >= 0 ? parseInt(durationSec, 10) : 5,
      google_event_id: syncWithGoogle ? targetItem?.google_event_id : null,
      sync_with_google: syncWithGoogle,
      completed_time: targetItem?.completed_time,
    } as any;

    setIsSubmitting(true);
    try {
      await onSave(reminderData);
      stopAlarmSound();
      setIsPlayingTest(false);
      onClose();
    } catch (err) {
      console.error(err);
      alert('保存中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-[#242e3d] border border-gray-600 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#1a202c] border-b border-gray-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold tracking-wide">
              {targetItem ? '予定を編集' : '新しい予定を作成'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAlarmSound();
              setIsPlayingTest(false);
              onClose();
            }}
            className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              タイトル <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: トマトの芽かき、朝礼、薬の服用"
              className="w-full bg-[#3a4a5e] border border-gray-600 rounded-xl px-3 py-2 text-white placeholder-gray-400 font-bold focus:border-blue-400 focus:outline-none"
              required
            />
          </div>

          {/* Memo */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              メモ・留意事項（省略可）
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="作業手順や注意点などを入力"
              rows={2}
              className="w-full bg-[#3a4a5e] border border-gray-600 rounded-xl px-3 py-2 text-white placeholder-gray-400 font-medium focus:border-blue-400 focus:outline-none resize-none"
            />
          </div>

          {/* Date & Time Picker */}
          <div className="bg-[#354356] p-3 rounded-2xl border border-gray-600 space-y-2">
            <label className="block text-xs font-bold text-gray-200">
              予定日時の設定
            </label>
            <div className="flex flex-col gap-2">
              {/* Date Row */}
              <div className="flex items-center gap-1.5 text-sm font-bold flex-wrap">
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span className="text-xs">年</span>

                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer"
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="text-xs">月</span>

                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer"
                >
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="text-xs">日</span>
              </div>

              {/* Time Row */}
              <div className="flex items-center gap-1.5 text-sm font-bold border-t border-gray-600/50 pt-1.5">
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-center"
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="mr-3 text-xs">時</span>

                <select
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-center"
                >
                  {minuteOptions.map((mi) => (
                    <option key={mi} value={mi}>{mi}</option>
                  ))}
                </select>
                <span className="text-xs">分</span>
              </div>

              {/* Quick Timer Presets */}
              <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-gray-600/40 text-xs">
                <span className="text-[10px] text-gray-400 font-bold">設定補助:</span>
                <button
                  type="button"
                  onClick={() => setQuickTimer(0)}
                  className="px-2 py-0.5 rounded-md bg-blue-900/60 hover:bg-blue-800 text-blue-200 font-bold text-[11px] cursor-pointer transition border border-blue-500/40"
                  title="現在時刻にリセット"
                >
                  現在時刻
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTimer(5)}
                  className="px-1.5 py-0.5 rounded-md bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold text-[11px] cursor-pointer transition border border-emerald-600/40"
                >
                  +5分
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTimer(10)}
                  className="px-1.5 py-0.5 rounded-md bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold text-[11px] cursor-pointer transition border border-emerald-600/40"
                >
                  +10分
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTimer(15)}
                  className="px-1.5 py-0.5 rounded-md bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 font-bold text-[11px] cursor-pointer transition border border-emerald-600/40"
                >
                  +15分
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTimer(30)}
                  className="px-1.5 py-0.5 rounded-md bg-amber-950/70 hover:bg-amber-900 text-amber-300 font-bold text-[11px] cursor-pointer transition border border-amber-600/40"
                >
                  +30分
                </button>
                <button
                  type="button"
                  onClick={() => setQuickTimer(60)}
                  className="px-1.5 py-0.5 rounded-md bg-amber-950/70 hover:bg-amber-900 text-amber-300 font-bold text-[11px] cursor-pointer transition border border-amber-600/40"
                >
                  +1時間
                </button>
              </div>
            </div>
          </div>

          {/* Repeat Setting */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              <span>リピート設定</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={repeatType}
                onChange={(e) => setRepeatType(e.target.value)}
                className="bg-[#3a4a5e] border border-gray-600 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs cursor-pointer"
              >
                <option value="なし">なし</option>
                <option value="毎日">毎日</option>
                <option value="毎週">毎週</option>
                <option value="毎月">毎月</option>
                <option value="毎年">毎年</option>
                <option value="〇日おき">〇日おき</option>
              </select>

              {repeatType === '〇日おき' && (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <NumberStepper
                    value={parseInt(intervalDays, 10) || 2}
                    min={1}
                    max={365}
                    onChange={(v) => setIntervalDays(v.toString())}
                    suffix="日おき"
                    compact
                  />
                </div>
              )}
            </div>
          </div>

          {/* Snooze & Duration */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">スヌーズ時間</label>
              <NumberStepper
                value={parseInt(snoozeMin, 10) || 5}
                min={1}
                max={120}
                onChange={(v) => setSnoozeMin(v.toString())}
                suffix="分"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">アラーム鳴動 (0=連続)</label>
              <NumberStepper
                value={parseInt(durationSec, 10) >= 0 ? parseInt(durationSec, 10) : 5}
                min={0}
                max={300}
                onChange={(v) => setDurationSec(v.toString())}
                suffix="秒"
              />
            </div>
          </div>

          {/* Advance Notices (事前通知) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-blue-400" />
                <span>事前通知のカスタム設定</span>
              </label>
              <button
                type="button"
                onClick={handleAddNotice}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>通知を追加</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {notices.map((n) => (
                <div key={n.id} className="flex items-center gap-1.5 bg-[#3a4a5e] p-1.5 rounded-xl border border-gray-600/60">
                  <NumberStepper
                    value={n.value}
                    min={1}
                    max={999}
                    onChange={(v) => handleNoticeChange(n.id, 'value', v)}
                    compact
                  />
                  <select
                    value={n.unit}
                    onChange={(e) => handleNoticeChange(n.id, 'unit', e.target.value)}
                    className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold text-xs cursor-pointer h-8"
                  >
                    <option value="分前">分前</option>
                    <option value="時間前">時間前</option>
                    <option value="日前">日前</option>
                    <option value="週間前">週間前</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveNotice(n.id)}
                    className="p-1.5 rounded-lg bg-red-800/80 hover:bg-red-700 text-red-200 ml-auto cursor-pointer"
                    title="削除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {notices.length === 0 && (
                <p className="text-[11px] text-gray-400 italic">事前通知なし（時刻ちょうどのみ通知）</p>
              )}
            </div>
          </div>

          {/* Sound & Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>音源・音量設定</span>
              </label>
              <div className="text-xs text-amber-300 font-bold">
                音量: {volume}% {volume === 0 ? '(消音・バイブのみ)' : ''}
              </div>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sound Selector + Test / Stop button */}
            <div className="flex items-center gap-2">
              <select
                value={sound}
                onChange={(e) => {
                  setSound(e.target.value);
                  const matched = customSounds.find((cs) => cs.name === e.target.value);
                  if (matched) {
                    setCustomSoundUrl(matched.url);
                    setCustomSoundName(matched.name);
                  } else {
                    setCustomSoundUrl(undefined);
                    setCustomSoundName(undefined);
                  }
                  stopAlarmSound();
                  setIsPlayingTest(false);
                }}
                className="flex-1 bg-[#3a4a5e] border border-gray-600 rounded-xl px-2.5 py-2 text-white font-bold text-xs cursor-pointer truncate"
              >
                <optgroup label="内蔵プリセット音">
                  {PRESET_SOUNDS.map((ps) => (
                    <option key={ps.id} value={ps.name}>{ps.name}</option>
                  ))}
                </optgroup>
                {customSounds.length > 0 && (
                  <optgroup label="取り込み済み外部音源 (保存済)">
                    {customSounds.map((cs) => (
                      <option key={cs.name} value={cs.name}>🎵 {cs.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Sound Test / Stop Button */}
              <button
                type="button"
                onClick={handleTestSound}
                className={`px-3 py-2 rounded-xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                  isPlayingTest
                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-md animate-pulse'
                    : 'bg-[#2d3748] hover:bg-gray-700 text-gray-200 border-gray-600'
                }`}
                title={isPlayingTest ? '試聴を停止' : 'テスト試聴'}
              >
                {isPlayingTest ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current text-white" />
                    <span>停止</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                    <span>試聴</span>
                  </>
                )}
              </button>

              {customSounds.some((cs) => cs.name === sound) && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedCustomSound}
                  className="p-2 rounded-xl bg-red-900/70 hover:bg-red-800 border border-red-700/60 text-red-200 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="音源を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Upload MP3 */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mp3,audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 border border-dashed border-gray-500 hover:border-blue-400 rounded-xl text-xs text-gray-300 hover:text-blue-300 bg-[#354356]/60 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>お好みのMP3音源を取り込む（アプリに永続保存）</span>
              </button>
            </div>

            {soundFeedback && (
              <div className="text-xs text-emerald-300 font-bold bg-emerald-950/80 border border-emerald-600/70 p-2 rounded-xl animate-in fade-in">
                {soundFeedback}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 active:scale-98 text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition cursor-pointer border border-blue-400/40 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? '保存中...' : targetItem ? '予定を更新して保存' : '予定を作成して保存'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
