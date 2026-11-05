import React from 'react';
import { TriggeredAlarm } from '../types/reminder';
import { Bell, Clock, FileText, Check, Square } from 'lucide-react';

interface AlarmModalProps {
  alarm: TriggeredAlarm | null;
  onStop: () => void;
  onSnooze: (reminder: TriggeredAlarm) => void;
  onCompleteDirectly: (reminder: TriggeredAlarm) => void;
}

export const AlarmModal: React.FC<AlarmModalProps> = ({
  alarm,
  onStop,
  onSnooze,
  onCompleteDirectly,
}) => {
  if (!alarm) return null;

  const { reminder, isPreNotice, preLabel } = alarm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm sm:max-w-md bg-[#252f3e] border-2 border-red-500/90 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150">
        {/* Animated header banner */}
        <div
          className={`py-4 px-5 text-center flex items-center justify-center gap-2 border-b ${
            isPreNotice
              ? 'bg-sky-950/90 border-sky-600/70 text-sky-300'
              : 'bg-red-950/90 border-red-600/70 text-red-300 animate-pulse'
          }`}
        >
          <Bell className="w-6 h-6 animate-bounce text-red-400" />
          <h2 className="text-lg sm:text-xl font-extrabold tracking-wide">
            {isPreNotice ? `📢 【事前通知】 (${preLabel})` : '⏰ 時間になりました！'}
          </h2>
        </div>

        {/* Alarm Information Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Title - Extra Large font for instant readability */}
          <div className="bg-[#354356] p-4 sm:p-5 rounded-2xl border border-gray-600 shadow-inner">
            <span className="text-xs font-bold text-gray-400 block mb-1">【予定】</span>
            <h3 className="text-xl sm:text-2xl font-black text-white leading-snug break-words">
              {reminder.title}
            </h3>

            {reminder.memo && (
              <div className="mt-3 pt-3 border-t border-gray-600/60">
                <span className="text-xs font-bold text-gray-400 block mb-1">【メモ】</span>
                <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed break-words">
                  {reminder.memo}
                </p>
              </div>
            )}
          </div>

          {/* Time & Snooze Info */}
          <div className="flex items-center justify-between text-xs text-gray-300 px-3 py-2.5 bg-black/25 rounded-xl border border-gray-700/60">
            <div>
              <span className="text-gray-400 block text-[11px]">【予定時刻】</span>
              <strong className="text-amber-300 text-sm font-bold">{reminder.target_time}</strong>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block text-[11px]">【スヌーズ設定】</span>
              <strong className="text-purple-300 text-sm font-bold">{reminder.snooze_min || 5}分</strong>
            </div>
          </div>

          {/* Action Buttons: Prominent Giant STOP Button First! */}
          <div className="pt-2 space-y-3">
            {/* Giant Prominent STOP Button */}
            <button
              type="button"
              onClick={onStop}
              className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white font-black shadow-2xl shadow-red-950 border-2 border-red-300/80 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ring-4 ring-red-500/40 animate-pulse"
            >
              <div className="flex items-center gap-2.5">
                <Square className="w-7 h-7 sm:w-8 sm:h-8 fill-white text-white shrink-0" />
                <span className="text-2xl sm:text-3xl font-black tracking-wider drop-shadow-md">
                  STOP 停止
                </span>
              </div>
              <span className="text-xs font-bold text-red-100 opacity-95">
                ここをタップして音とバイブを止める
              </span>
            </button>

            {/* Sub actions: スヌーズ & 完了 */}
            <div className={`grid ${isPreNotice ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5 pt-1`}>
              <button
                type="button"
                onClick={() => onSnooze(alarm)}
                className="py-3 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-100 font-bold text-xs sm:text-sm border border-slate-500 shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>💤 スヌーズ</span>
                <span className="text-[11px] text-purple-300 font-mono">({reminder.snooze_min || 5}分)</span>
              </button>

              {!isPreNotice && (
                <button
                  type="button"
                  onClick={() => onCompleteDirectly(alarm)}
                  className="py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-bold text-xs sm:text-sm border border-emerald-500/60 shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>予定を完了にする</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
