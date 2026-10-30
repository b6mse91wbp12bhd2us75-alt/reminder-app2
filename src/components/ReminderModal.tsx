import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  Volume1,
  VolumeX,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  Bell,
  Upload,
  Play,
  Square,
  Sparkles,
  Info,
  Trash2,
} from 'lucide-react';
import { ReminderItem } from '../types/reminder';
import { User } from 'firebase/auth';
import { playCustomAudio, stopCustomAudio } from '../services/audio';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: ReminderItem) => void;
  targetItem: ReminderItem | null;
  user: User | null;
  onGoogleSignIn: () => void;
  customSounds?: { name: string; url: string }[];
  onAddCustomSounds?: (newSounds: { name: string; url: string }[]) => void;
  onDeleteCustomSound?: (name: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  targetItem,
  user,
  onGoogleSignIn,
  customSounds = [],
  onAddCustomSounds,
  onDeleteCustomSound,
}) => {
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetTimeStr, setTargetTimeStr] = useState('');
  const [sound, setSound] = useState('強力ベル');
  const [duration, setDuration] = useState(30);
  const [repeat, setRepeat] = useState('なし');
  const [customRepeatDays, setCustomRepeatDays] = useState(3);
  const [selectedNotices, setSelectedNotices] = useState<string[]>(['なし']);
  const [snoozeMin, setSnoozeMin] = useState(5);
  const [syncWithGoogle, setSyncWithGoogle] = useState(false);
  const [volume, setVolume] = useState(70);

  // Audio preview state
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewSoundName, setPreviewSoundName] = useState<string | null>(null);

  // Initial populate
  useEffect(() => {
    if (targetItem) {
      setTitle(targetItem.title);
      setMemo(targetItem.memo || '');
      const [d, t] = targetItem.target_time.split(' ');
      setTargetDate(d || '');
      setTargetTimeStr(t || '');
      setSound(targetItem.sound || '強力ベル');
      setDuration(targetItem.duration !== undefined ? targetItem.duration : 30);
      setSnoozeMin(targetItem.snooze_min || 5);
      setSyncWithGoogle(!!targetItem.sync_with_google);
      setVolume(targetItem.volume !== undefined ? targetItem.volume : 70);

      // Repeat
      if (targetItem.repeat.includes('日おき')) {
        const m = targetItem.repeat.match(/(\d+)日おき/);
        if (m) {
          setRepeat('〇日おき');
          setCustomRepeatDays(parseInt(m[1], 10));
        } else {
          setRepeat(targetItem.repeat);
        }
      } else {
        setRepeat(targetItem.repeat || 'なし');
      }

      // Notices
      if (targetItem.notices && targetItem.notices !== 'なし') {
        setSelectedNotices(targetItem.notices.split(',').map((s) => s.trim()));
      } else {
        setSelectedNotices(['なし']);
      }
    } else {
      // Default to 10 minutes later
      const now = new Date(Date.now() + 10 * 60 * 1000);
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');

      setTitle('');
      setMemo('');
      setTargetDate(`${yyyy}-${mm}-${dd}`);
      setTargetTimeStr(`${hh}:${min}`);
      setSound('強力ベル');
      setDuration(30);
      setRepeat('なし');
      setCustomRepeatDays(3);
      setSelectedNotices(['なし']);
      setSnoozeMin(5);
      setSyncWithGoogle(false);
      setVolume(70);
    }
    stopPreview();
  }, [targetItem, isOpen]);

  const stopPreview = () => {
    stopCustomAudio();
    setIsPlayingPreview(false);
    setPreviewSoundName(null);
  };

  const handleTogglePreview = (targetSound: string) => {
    if (isPlayingPreview && previewSoundName === targetSound) {
      stopPreview();
      return;
    }
    stopPreview();
    setIsPlayingPreview(true);
    setPreviewSoundName(targetSound);

    // Look for custom sound url
    const cSound = customSounds.find((s) => s.name === targetSound);
    playCustomAudio(targetSound, cSound?.url, (vol) => {
      // preview playback volume
    });

    // Auto stop preview after 5s
    setTimeout(() => {
      setIsPlayingPreview(false);
      setPreviewSoundName(null);
      stopCustomAudio();
    }, 5000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newSounds: { name: string; url: string }[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const url = uploadEvent.target?.result as string;
        if (url) {
          const soundName = file.name.replace(/\.[^/.]+$/, '');
          newSounds.push({ name: soundName, url });
          if (newSounds.length === files.length) {
            if (onAddCustomSounds) {
              onAddCustomSounds(newSounds);
            }
            setSound(newSounds[0].name);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleNoticeToggle = (val: string) => {
    if (val === 'なし') {
      setSelectedNotices(['なし']);
      return;
    }
    let updated = selectedNotices.filter((n) => n !== 'なし');
    if (updated.includes(val)) {
      updated = updated.filter((n) => n !== val);
      if (updated.length === 0) updated = ['なし'];
    } else {
      updated.push(val);
    }
    setSelectedNotices(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalRepeat = repeat;
    if (repeat === '〇日おき') {
      finalRepeat = `${customRepeatDays}日おき`;
    }

    const cSound = customSounds.find((s) => s.name === sound);

    const item: ReminderItem = {
      id: targetItem ? targetItem.id : `rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      memo: memo.trim(),
      target_time: `${targetDate} ${targetTimeStr}`,
      sound,
      duration,
      repeat: finalRepeat,
      notices: selectedNotices.join(', '),
      snooze_min: snoozeMin,
      sync_with_google: syncWithGoogle,
      google_event_id: targetItem?.google_event_id,
      completed_time: targetItem?.completed_time,
      custom_sound_url: cSound ? cSound.url : undefined,
      custom_sound_name: cSound ? cSound.name : undefined,
      volume,
    };

    stopPreview();
    onSave(item);
    onClose();
  };

  if (!isOpen) return null;

  const noticeOptions = [
    'なし',
    '5分前',
    '10分前',
    '15分前',
    '30分前',
    '1時間前',
    '2時間前',
    '1日前',
    '2日前',
    '1週間前',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-[#1a2330] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-gray-700/80 shadow-2xl flex flex-col max-h-[92vh] text-white animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/80 bg-[#161d27] rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <h2 className="text-lg font-bold text-gray-100">
              {targetItem ? '予定を編集' : '新しい予定を作成'}
            </h2>
          </div>
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              タイトル <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="予定のタイトル (例: 会議、薬を飲む、収穫作業)"
              className="w-full bg-[#242e3d] border border-gray-600 rounded-xl px-3.5 py-2.5 text-white placeholder-gray-400 text-base focus:outline-hidden focus:border-emerald-500 font-medium"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" /> 日付
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-[#242e3d] border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> 時刻
              </label>
              <input
                type="time"
                required
                value={targetTimeStr}
                onChange={(e) => setTargetTimeStr(e.target.value)}
                className="w-full bg-[#242e3d] border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Repeat */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-emerald-400" /> 繰り返し
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {['なし', '毎日', '毎週', '毎月', '毎年', '〇日おき'].map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => setRepeat(rep)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    repeat === rep
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                      : 'bg-[#242e3d] text-gray-300 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {rep}
                </button>
              ))}
            </div>
            {repeat === '〇日おき' && (
              <div className="mt-2 flex items-center gap-2 bg-[#242e3d] p-2 rounded-xl border border-gray-700">
                <span className="text-xs text-gray-300">間隔:</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customRepeatDays}
                  onChange={(e) => setCustomRepeatDays(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-[#161d27] border border-gray-600 rounded-lg px-2 py-1 text-center text-white text-sm font-bold"
                />
                <span className="text-xs text-gray-300 font-bold">日おきに通知</span>
              </div>
            )}
          </div>

          {/* Pre-Notices */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 text-amber-400" /> 事前通知（複数選択可）
            </label>
            <div className="flex flex-wrap gap-1.5">
              {noticeOptions.map((n) => {
                const active = selectedNotices.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleNoticeToggle(n)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      active
                        ? 'bg-amber-600 text-white border-amber-400 shadow-xs'
                        : 'bg-[#242e3d] text-gray-300 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration & Snooze */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                アラーム鳴動 (0=連続)
              </label>
              <div className="flex items-center gap-1.5 bg-[#242e3d] p-1.5 rounded-xl border border-gray-700">
                {[10, 30, 60, 0].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDuration(sec)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      duration === sec
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {sec === 0 ? '無限' : `${sec}秒`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">スヌーズ間隔</label>
              <div className="flex items-center gap-1.5 bg-[#242e3d] p-1.5 rounded-xl border border-gray-700">
                {[3, 5, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSnoozeMin(m)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      snoozeMin === m
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {m}分
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sound Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-300 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>アラーム音</span>
              </label>
              <label className="cursor-pointer bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-600/80 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition shadow-xs">
                <Upload className="w-3 h-3" />
                <span>＋ 音源を追加 (MP3)</span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {['強力ベル', '優しいチャイム', '注意喚起', '短音ピピピ'].map((snd) => {
                const isSelected = sound === snd;
                const isPlaying = isPlayingPreview && previewSoundName === snd;
                return (
                  <div
                    key={snd}
                    onClick={() => setSound(snd)}
                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-950/70 border-emerald-500 text-white'
                        : 'bg-[#242e3d] border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <span className="text-xs font-bold truncate">{snd}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePreview(snd);
                      }}
                      className="p-1 rounded-full hover:bg-gray-700 text-emerald-400 transition"
                    >
                      {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}

              {/* Custom Uploaded Sounds */}
              {customSounds.map((c) => {
                const isSelected = sound === c.name;
                const isPlaying = isPlayingPreview && previewSoundName === c.name;
                return (
                  <div
                    key={c.name}
                    onClick={() => setSound(c.name)}
                    className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-950/70 border-emerald-500 text-white'
                        : 'bg-[#242e3d] border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-1 truncate max-w-[110px]">
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="text-xs font-bold truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePreview(c.name);
                        }}
                        className="p-1 rounded-full hover:bg-gray-700 text-emerald-400 transition"
                      >
                        {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      {onDeleteCustomSound && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`音源「${c.name}」を削除しますか？`)) {
                              onDeleteCustomSound(c.name);
                            }
                          }}
                          className="p-1 rounded-full hover:bg-gray-700 text-red-400 hover:text-red-300 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume Control Section */}
          <div className="bg-[#242e3d] p-3 rounded-2xl border border-gray-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                {volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume <= 35 ? (
                  <Volume1 className="w-4 h-4 text-amber-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>アラーム音量設定</span>
              </label>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  volume === 0
                    ? 'bg-red-950/90 text-red-300 border border-red-700/60'
                    : volume <= 35
                    ? 'bg-amber-950/90 text-amber-300 border border-amber-700/60'
                    : 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60'
                }`}
              >
                {volume === 0 ? '消音（バイブのみ）' : `${volume}%`}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-gray-400 shrink-0 font-medium">0%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 h-2 bg-gray-700 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] text-gray-400 shrink-0 font-medium">100%</span>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setVolume(0)}
                className={`py-1 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer border text-center ${
                  volume === 0
                    ? 'bg-red-800 text-white border-red-600 shadow-xs'
                    : 'bg-[#1c2430] text-gray-400 hover:text-white border-gray-700'
                }`}
              >
                🔇 消音
              </button>
              <button
                type="button"
                onClick={() => setVolume(30)}
                className={`py-1 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer border text-center ${
                  volume === 30
                    ? 'bg-amber-700 text-white border-amber-500 shadow-xs'
                    : 'bg-[#1c2430] text-gray-400 hover:text-white border-gray-700'
                }`}
              >
                🔈 30%
              </button>
              <button
                type="button"
                onClick={() => setVolume(70)}
                className={`py-1 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer border text-center ${
                  volume === 70
                    ? 'bg-emerald-700 text-white border-emerald-500 shadow-xs'
                    : 'bg-[#1c2430] text-gray-400 hover:text-white border-gray-700'
                }`}
              >
                🔉 70%
              </button>
              <button
                type="button"
                onClick={() => setVolume(100)}
                className={`py-1 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer border text-center ${
                  volume === 100
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                    : 'bg-[#1c2430] text-gray-400 hover:text-white border-gray-700'
                }`}
              >
                🔊 最大
              </button>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              ※電車やバス、静かな場所では「消音」または「30%」をお選びください。
            </p>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">メモ (任意)</label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="作業メモや持ち物など"
              className="w-full bg-[#242e3d] border border-gray-600 rounded-xl px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Google Calendar Sync */}
          <div className="bg-[#242e3d] p-3 rounded-2xl border border-gray-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <div>
                <div className="text-xs font-bold text-gray-200">Googleカレンダーに登録</div>
                <div className="text-[10px] text-gray-400">作成時にカレンダーへ自動送信</div>
              </div>
            </div>
            {user ? (
              <input
                type="checkbox"
                checked={syncWithGoogle}
                onChange={(e) => setSyncWithGoogle(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            ) : (
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-1 rounded-lg transition cursor-pointer"
              >
                ログインして有効化
              </button>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-2 pt-2 pb-4">
            <button
              type="button"
              onClick={() => {
                stopPreview();
                onClose();
              }}
              className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              {targetItem ? '更新する' : '予定を作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
