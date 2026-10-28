import React from 'react';
import { ReminderItem } from '../types/reminder';
import { getJapaneseDayOfWeek } from '../utils/dateUtils';
import { Edit3, Check, Calendar, Bell, Repeat, FileText, Send, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

interface ReminderCardProps {
  reminder: ReminderItem;
  category: 'past' | 'today' | 'future';
  onEdit: (reminder: ReminderItem) => void;
  onComplete: (reminder: ReminderItem) => void;
  onPushToCalendar?: (reminder: ReminderItem) => void;
  onUnlinkCalendar?: (reminder: ReminderItem) => void;
  isPushingCalendar?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (reminder: ReminderItem) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  category,
  onEdit,
  onComplete,
  onPushToCalendar,
  onUnlinkCalendar,
  isPushingCalendar = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const dayOfWeek = getJapaneseDayOfWeek(reminder.target_time);

  // Time text color corresponding to Python app style
  const timeColorClass =
    category === 'past'
      ? 'text-red-300 bg-red-950/60 border-red-700/60'
      : category === 'today'
      ? 'text-amber-300 bg-amber-950/60 border-amber-700/60'
      : 'text-sky-300 bg-sky-950/60 border-sky-700/60';

  const isImportedFromCalendar =
    reminder.id.startsWith('gcal-') || reminder.id.startsWith('google-');

  return (
    <div
      onClick={() => {
        if (isSelectionMode && onToggleSelect) {
          onToggleSelect(reminder);
        }
      }}
      className={`bg-[#3a4a5e] border rounded-2xl p-3.5 sm:p-4 shadow-md transition-all ${
        isSelected
          ? 'border-blue-400 bg-[#354860] ring-2 ring-blue-400/50'
          : isImportedFromCalendar
          ? 'border-amber-600/60 bg-[#3a4552]'
          : 'border-gray-600/70 hover:border-blue-400/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox (Active during selection mode) */}
        {isSelectionMode && (
          <div className="pt-1 shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect && onToggleSelect(reminder)}
              className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-400 cursor-pointer"
            />
          </div>
        )}

        {/* Left Information Section */}
        <div className="flex-1 min-w-0">
          {/* Time & Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${timeColorClass}`}
            >
              <span>⏰</span>
              <span>{reminder.target_time}</span>
              <span className="text-[11px] font-normal opacity-90">{dayOfWeek}</span>
            </span>

            {/* Google Calendar Status Badge */}
            {reminder.google_event_id ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-900/70 text-blue-200 border border-blue-400/50">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>カレンダー登録済</span>
              </span>
            ) : null}

            {isImportedFromCalendar && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-900/60 text-amber-200 border border-amber-600/50">
                <span>自動取込</span>
              </span>
            )}

            {reminder.snoozed_until && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-900/60 text-purple-200 border border-purple-500/50 animate-pulse">
                <span>💤 スヌーズ中</span>
              </span>
            )}
          </div>

          {/* Title - Large font for legibility */}
          <h4 className="text-base sm:text-lg font-bold text-white leading-snug break-words mb-1.5">
            {reminder.title}
          </h4>

          {/* Sub details: memo, repeat, notices */}
          <div className="space-y-1 text-xs text-gray-300">
            {reminder.memo && (
              <div className="flex items-start gap-1.5 text-gray-200 bg-black/15 p-2 rounded-lg">
                <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="whitespace-pre-line leading-relaxed break-words">{reminder.memo}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-300 pt-0.5">
              <span className="inline-flex items-center gap-1">
                <Repeat className="w-3 h-3 text-gray-400" />
                <span>繰返: <strong className="text-gray-100">{reminder.repeat || 'なし'}</strong></span>
              </span>

              <span className="inline-flex items-center gap-1">
                <Bell className="w-3 h-3 text-gray-400" />
                <span>通知: <strong className="text-gray-100">{reminder.notices || 'なし'}</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions Section (Edit & Complete) */}
        {!isSelectionMode && (
          <div className="flex flex-col gap-1.5 shrink-0 self-start">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(reminder);
              }}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              title="予定を完了にする"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>完了</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(reminder);
              }}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#2b6cb0] hover:bg-[#2c5282] active:scale-95 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              title="予定を編集"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>編集</span>
            </button>
          </div>
        )}
      </div>

      {/* Selective Google Calendar Export Action Bar (Per-Card) */}
      {!isSelectionMode && onPushToCalendar && (
        <div className="mt-3 pt-2.5 border-t border-gray-600/50 flex flex-wrap items-center justify-between gap-2">
          {reminder.google_event_id ? (
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="flex items-center gap-1.5 text-xs text-blue-300 font-medium">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Googleカレンダーに登録済み</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPushToCalendar(reminder);
                  }}
                  disabled={isPushingCalendar}
                  className="px-2.5 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-500/50 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title="Googleカレンダーの内容を再更新・再送信"
                >
                  <RefreshCw className={`w-3 h-3 ${isPushingCalendar ? 'animate-spin' : ''}`} />
                  <span>{isPushingCalendar ? '更新中...' : '再送信'}</span>
                </button>
                {onUnlinkCalendar && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnlinkCalendar(reminder);
                    }}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-300 hover:bg-gray-700 transition cursor-pointer"
                    title="カレンダー登録フラグを解除"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPushToCalendar(reminder);
                }}
                disabled={isPushingCalendar}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-[#2a4365] hover:bg-[#2b6cb0] active:scale-95 text-blue-100 text-xs font-bold border border-blue-500/50 transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="この予定だけをGoogleカレンダーに送信して追加"
              >
                <Send className={`w-3.5 h-3.5 text-blue-300 ${isPushingCalendar ? 'animate-spin' : ''}`} />
                <span>{isPushingCalendar ? '送信中...' : '📅 Googleカレンダーに送る'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
