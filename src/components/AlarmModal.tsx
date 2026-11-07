import React from 'react';
import { TriggeredAlarm } from '../types/reminder';
import { CheckCircle2, Clock, Check } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 w-screen h-screen min-h-screen bg-gradient-to-b from-[#606bf0] via-[#5b63ea] to-[#515ae0] text-white flex flex-col justify-between items-center px-6 py-12 sm:py-16 overflow-y-auto select-none animate-in fade-in duration-200">
      {/* Top Branding Section matching Reminder FLEX */}
      <div className="flex flex-col items-center justify-center pt-2 sm:pt-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2 drop-shadow-sm">
          Reminder FLEX
        </h1>
        <div className="w-10 h-10 rounded-full border-2 border-white/90 flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-8 h-8 text-white stroke-[2.5]" />
        </div>
        {isPreNotice && (
          <span className="mt-3 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wide backdrop-blur-xs">
            📢 事前通知 ({preLabel})
          </span>
        )}
      </div>

      {/* Center Reminder Title Section */}
      <div className="my-auto w-full max-w-lg text-center px-4 py-8 flex flex-col items-center justify-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-wide leading-tight break-words drop-shadow-md">
          {reminder.title}
        </h2>

        {/* Memo (if available) */}
        {reminder.memo && (
          <p className="mt-4 text-base sm:text-lg text-white/90 font-medium whitespace-pre-line leading-relaxed max-w-md bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-xs">
            {reminder.memo}
          </p>
        )}

        {/* Target Time Info */}
        <div className="mt-4 flex items-center gap-1.5 text-xs sm:text-sm text-white/80 font-medium">
          <Clock className="w-4 h-4 text-white/90" />
          <span>予定時刻: {reminder.target_time}</span>
        </div>
      </div>

      {/* Bottom Action Section: Prominent STOP Button */}
      <div className="w-full max-w-xs flex flex-col items-center gap-4 pb-4 sm:pb-8">
        <button
          type="button"
          onClick={onStop}
          className="w-44 sm:w-48 py-4 sm:py-5 px-6 rounded-2xl bg-[#6100ed] hover:bg-[#5200c7] active:scale-95 text-white font-extrabold text-2xl sm:text-3xl shadow-2xl shadow-indigo-950/50 transition-all cursor-pointer flex items-center justify-center tracking-widest border border-white/20"
        >
          停止
        </button>

        {/* Auxiliary actions: Snooze & Complete */}
        <div className="w-full flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSnooze(alarm)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs sm:text-sm backdrop-blur-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-white/20"
          >
            <span>💤 スヌーズ ({reminder.snooze_min || 5}分)</span>
          </button>

          {!isPreNotice && (
            <button
              type="button"
              onClick={() => onCompleteDirectly(alarm)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm backdrop-blur-xs transition cursor-pointer flex items-center justify-center gap-1 border border-white/20 shadow-sm"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>予定を完了</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
