import React from 'react';
import { TriggeredAlarm } from '../types/reminder';
import { Bell, Clock, FileText, Check, Volume2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#2d3748] border-2 border-red-500/80 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150">
        {/* Animated header banner */}
        <div
          className={`py-4 px-5 text-center flex items-center justify-center gap-2 border-b ${
            isPreNotice
              ? 'bg-sky-950/90 border-sky-600/70 text-sky-300'
              : 'bg-red-950/90 border-red-600/70 text-red-300 animate-pulse'
          }`}
        >
          <Bell className="w-6 h-6 animate-bounce" />
          <h2 className="text-lg font-extrabold tracking-wide">
            {isPreNotice ? `📢 【事前通知】 (${preLabel})` : '⏰ 時間になりました！'}
          </h2>
        </div>

        {/* Alarm Information Body */}
        <div className="p-5 space-y-4">
          {/* Title - Extra Large font for high visibility */}
          <div className="bg-[#3a4a5e] p-4 rounded-2xl border border-gray-600 shadow-inner">
            <span className="text-xs font-semibold text-gray-400 block mb-1">【予定】</span>
            <h3 className="text-xl font-black text-white leading-tight break-words">
              {reminder.title}
            </h3>

            {reminder.memo && (
              <div className="mt-3 pt-3 border-t border-gray-600/60">
                <span className="text-xs font-semibold text-gray-400 block mb-1">【メモ】</span>
                <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed break-words">
                  {reminder.memo}
                </p>
              </div>
            )}
          </div>

          {/* Time & Snooze Info */}
          <div className="flex items-center justify-between text-xs text-gray-300 px-1 bg-black/20 p-2.5 rounded-xl border border-gray-700/60">
            <div>
              <span className="text-gray-400 block text-[11px]">【予定時刻】</span>
              <strong className="text-amber-300 text-sm font-bold">{reminder.target_time}</strong>
            </div>
            <div className="text-right">
              <span className="text-gray-400 block text-[11px]">【スヌーズ設定】</span>
              <strong className="text-purple-300 text-sm font-bold">{reminder.snooze_min || 5}分</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onStop}
                className="py-3 px-4 rounded-2xl bg-[#e53e3e] hover:bg-[#c53030] active:scale-95 text-white font-black text-base shadow-lg shadow-red-900/50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>停止</span>
              </button>

              <button
                type="button"
                onClick={() => onSnooze(alarm)}
                className="py-3 px-4 rounded-2xl bg-[#4a5568] hover:bg-[#2d3748] active:scale-95 text-white font-bold text-base border border-gray-500 shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>スヌーズ</span>
                <span className="text-xs opacity-80">({reminder.snooze_min || 5}分)</span>
              </button>
            </div>

            {/* Direct Complete Button */}
            {!isPreNotice && (
              <button
                type="button"
                onClick={() => onCompleteDirectly(alarm)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>この予定を完了にする</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
