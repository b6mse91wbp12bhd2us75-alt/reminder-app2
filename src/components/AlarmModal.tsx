import React from 'react';
import { TriggeredAlarm } from '../types/reminder';
import { Clock, Check, BellRing } from 'lucide-react';

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
      }}
      className="bg-gradient-to-b from-[#2e4a3e] via-[#243b32] to-[#1a2c25] text-white flex flex-col justify-between items-center px-6 py-10 sm:py-14 select-none overflow-y-auto animate-in fade-in duration-200"
    >
      {/* 上部ヘッダー（控えめで落ち着いた表示） */}
      <div className="flex flex-col items-center justify-center pt-2 sm:pt-4 shrink-0">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#3d5e50]/60 border border-[#5a8773]/60 backdrop-blur-xs">
          <BellRing className="w-5 h-5 text-emerald-300 animate-bounce" />
          <span className="text-sm sm:text-base font-bold tracking-wider text-emerald-100">
            リマインダー通知
          </span>
        </div>

        {isPreNotice ? (
          <span className="mt-3 px-3 py-1 rounded-full bg-amber-900/60 text-amber-200 border border-amber-600/60 text-xs font-bold tracking-wide">
            📢 事前通知 ({preLabel})
          </span>
        ) : (
          <span className="mt-3 text-xs sm:text-sm text-emerald-200/80 font-medium">
            時間になりました
          </span>
        )}
      </div>

      {/* 中央：予定タイトル＆メモ（大きく見やすい白文字、落ち着いたカード） */}
      <div className="my-auto w-full max-w-lg text-center px-4 py-6 flex flex-col items-center justify-center">
        <div className="w-full bg-[#1b2f27]/80 border border-[#3b5c4e] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <span className="text-xs font-bold text-emerald-300/80 tracking-widest uppercase block mb-2">
            予定内容
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-wide leading-snug break-words">
            {reminder.title}
          </h2>

          {/* メモ */}
          {reminder.memo && (
            <div className="mt-4 pt-4 border-t border-[#314f42]">
              <p className="text-sm sm:text-base text-emerald-100/90 whitespace-pre-line leading-relaxed break-words font-medium">
                {reminder.memo}
              </p>
            </div>
          )}

          {/* 予定時刻 */}
          <div className="mt-4 pt-3 border-t border-[#314f42]/60 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-emerald-300 font-mono">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>予定時刻: {reminder.target_time}</span>
          </div>
        </div>
      </div>

      {/* 下部：大きめ横長の「停止」ボタン ＆ スヌーズ・完了 */}
      <div className="w-full max-w-md flex flex-col items-center gap-3.5 pb-4 sm:pb-8 shrink-0">
        {/* 大きめ横長の「停止」ボタン */}
        <button
          type="button"
          onClick={onStop}
          className="w-full py-4 sm:py-5 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black text-2xl sm:text-3xl shadow-2xl shadow-black/60 border-2 border-emerald-300/80 transition-all cursor-pointer flex items-center justify-center tracking-widest ring-4 ring-emerald-500/30"
        >
          停止
        </button>

        {/* 補助操作：スヌーズ & 予定完了 */}
        <div className="w-full grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onSnooze(alarm)}
            className="py-3 px-3 rounded-xl bg-[#263e34] hover:bg-[#324f43] active:scale-95 text-emerald-100 font-bold text-xs sm:text-sm border border-[#446d5b] shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>💤 スヌーズ ({reminder.snooze_min || 5}分)</span>
          </button>

          {!isPreNotice && (
            <button
              type="button"
              onClick={() => onCompleteDirectly(alarm)}
              className="py-3 px-3 rounded-xl bg-[#1c4b38] hover:bg-[#236048] active:scale-95 text-white font-bold text-xs sm:text-sm border border-emerald-500/60 shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3] text-emerald-300" />
              <span>予定を完了</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
