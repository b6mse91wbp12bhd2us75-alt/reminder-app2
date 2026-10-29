import React, { useState, useEffect, useRef } from 'react';
import { ReminderItem, NoticeOption } from '../types/reminder';
import { PRESET_SOUNDS, previewSound, stopAlarmSound } from '../services/audio';
import { padZero } from '../utils/dateUtils';
import { NumberStepper } from './NumberStepper';
import { X, Volume2, Plus, Play, Square, Clock, RefreshCw, Trash2, Check } from 'lucide-react';
import { User } from 'firebase/auth';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: ReminderItem) => Promise<void>;
  targetItem: ReminderItem | null;
  user: User | null;
  onGoogleSignIn: () => Promise<void>;
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

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear().toString());
  const [month, setMonth] = useState(padZero(now.getMonth() + 1));
  const [day, setDay] = useState(padZero(now.getDate()));
  const [hour, setHour] = useState(padZero(now.getHours()));
  const [minute, setMinute] = useState(padZero(now.getMinutes()));

  const [repeatType, setRepeatType] = useState('なし');
  const [intervalDays, setIntervalDays] = useState('2');
  const [snoozeMin, setSnoozeMin] = useState('5');
  const [durationSec, setDurationSec] = useState('5');
  const [notices, setNotices] = useState<NoticeOption[]>([]);

  const [sound, setSound] = useState<string>(PRESET_SOUNDS[0].name);
  const [customSoundUrl, setCustomSoundUrl] = useState<string | undefined>(undefined);
  const [customSoundName, setCustomSoundName] = useState<string | undefined>(undefined);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [soundFeedback, setSoundFeedback] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSound(targetItem.sound || PRESET_SOUNDS[0].name);
      setCustomSoundUrl(targetItem.custom_sound_url);
      setCustomSoundName(targetItem.custom_sound_name);
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

      setNotices([{ id: 'n1', value: 1, unit: '日前' }]);
    } else {
      setTitle('');
      setMemo('');
      setSyncWithGoogle(false);
      setSound(PRESET_SOUNDS[0].name);
      setCustomSoundUrl(undefined);
      setCustomSoundName(undefined);
      setRepeatType('なし');
      setIntervalDays('2');
      setSnoozeMin('5');
      setDurationSec('5');
      setNotices([{ id: 'n1', value: 1, unit: '日前' }]);

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

  const handleTestSound = () => {
    if (isPlayingTest) {
      stopAlarmSound();
      setIsPlayingTest(false);
    } else {
      setIsPlayingTest(true);
      previewSound(sound, customSoundUrl);
      setTimeout(() => setIsPlayingTest(false), 3500);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 25 * 1024 * 1024) {
      alert(`「${file.name}」はファイルサイズが大きすぎます（最大25MB）。小さめの音源を選択してください。`);
      return;
    }

    setSoundFeedback(`「${file.name}」を取り込み中...`);
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
      alert(`「${file.name}」の読み込みに失敗しました。別の音声ファイルをお試しください。`);
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

    const reminderData: ReminderItem = {
      id: targetItem?.id || `rem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      memo: memo.trim(),
      target_time: `${year}-${month}-${day} ${hour}:${minute}`,
      repeat: repeatType === '〇日おき' ? `${intervalDays}日おき` : repeatType,
      notices: 'なし',
      sound,
      custom_sound_url: customSoundUrl,
      custom_sound_name: customSoundName,
      snooze_min: parseInt(snoozeMin, 10) || 5,
      duration: parseInt(durationSec, 10) >= 0 ? parseInt(durationSec, 10) : 5,
      google_event_id: syncWithGoogle ? targetItem?.google_event_id : null,
      sync_with_google: syncWithGoogle,
    };

    setIsSubmitting(true);
    try {
      await onSave(reminderData);
      stopAlarmSound();
      onClose();
    } catch (err: any) {
      alert(err.message || '保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-[420px] bg-[#2d3748] border border-gray-600 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white">
        <div className="bg-[#1a202c] px-5 py-3.5 flex items-center justify-between border-b border-gray-700/70 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{targetItem ? '✏️' : '🔔'}</span>
            <h3 className="font-bold text-base tracking-wide text-white">
              {targetItem ? 'リマインダー編集' : 'リマインダー作成'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="reminder-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 text-sm">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定のタイトル (例: アラームテスト)"
              required
              className="w-full bg-[#3a4a5e] border border-gray-600 focus:border-blue-400 focus:outline-none rounded-xl px-3.5 py-2 text-base font-bold text-white placeholder-gray-400 transition"
            />
          </div>

          <div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="メモ (任意)"
              rows={2}
              className="w-full bg-[#3a4a5e] border border-gray-600 focus:border-blue-400 focus:outline-none rounded-xl px-3.5 py-1.5 text-sm text-white placeholder-gray-400 transition resize-none"
            />
          </div>

          {/* Date & Time */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>通知日時</span>
            </label>
            <div className="bg-[#3a4a5e] border border-gray-600 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <select value={year} onChange={(e) => setYear(e.target.value)} className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer">
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="text-xs">年</span>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer">
                  {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="text-xs">月</span>
                <select value={day} onChange={(e) => setDay(e.target.value)} className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer">
                  {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="text-xs">日</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-bold border-t border-gray-600/50 pt-1.5">
                <select value={hour} onChange={(e) => setHour(e.target.value)} className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer">
                  {hourOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="mr-3 text-xs">時</span>
                <select value={minute} onChange={(e) => setMinute(e.target.value)} className="bg-[#2d3748] border border-gray-600 rounded-lg px-2 py-1 text-white font-bold cursor-pointer">
                  {minuteOptions.map((mi) => <option key={mi} value={mi}>{mi}</option>)}
                </select>
                <span className="text-xs">分</span>
              </div>
            </div>
          </div>

          {/* Alarm Sound Selection */}
          <div className="pb-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>アラーム音</span>
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>＋ 外部音源を取り込む</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={sound}
                onChange={(e) => {
                  const val = e.target.value;
                  setSound(val);
                  const matched = customSounds.find((cs) => cs.name === val);
                  if (matched) {
                    setCustomSoundUrl(matched.url);
                    setCustomSoundName(matched.name);
                  } else {
                    setCustomSoundUrl(undefined);
                    setCustomSoundName(undefined);
                  }
                }}
                className="flex-1 bg-[#3a4a5e] border border-gray-600 rounded-xl px-2.5 py-2 text-white font-bold text-xs cursor-pointer truncate"
              >
                <optgroup label="アプリ内蔵音源">
                  {PRESET_SOUNDS.map((ps) => (
                    <option key={ps.id} value={ps.name}>
                      {ps.name}
                    </option>
                  ))}
                </optgroup>

                {customSounds.length > 0 && (
                  <optgroup label="取り込んだ外部音源（MP3等）">
                    {customSounds.map((cs) => (
                      <option key={cs.name} value={cs.name}>
                        🎵 {cs.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                type="button"
                onClick={handleTestSound}
                className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center shrink-0 ${
                  isPlayingTest ? 'bg-amber-600 text-white border-amber-500' : 'bg-[#2d3748] hover:bg-gray-700 text-gray-200 border-gray-600'
                }`}
                title="テスト再生"
              >
                {isPlayingTest ? <Square className="w-4 h-4 fill-current text-white" /> : <Play className="w-4 h-4 fill-current text-emerald-400" />}
              </button>

              {customSounds.some((cs) => cs.name === sound) && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedCustomSound}
                  className="p-2 rounded-xl bg-red-900/70 hover:bg-red-800 border border-red-700/60 text-red-200 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {soundFeedback && (
              <div className="text-[11px] text-emerald-300 bg-emerald-950/80 border border-emerald-600/60 px-2 py-1 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{soundFeedback}</span>
              </div>
            )}
          </div>
        </form>

        <div className="px-4 py-3 bg-[#1a202c] border-t border-gray-700/80 shrink-0 shadow-lg">
          <button
            type="submit"
            form="reminder-modal-form"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-[#38a169] hover:bg-[#2f855a] active:scale-98 text-white font-bold text-base shadow-md transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isSubmitting ? '保存中...' : '保存する'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
