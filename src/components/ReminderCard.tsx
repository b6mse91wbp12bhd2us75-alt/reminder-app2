import React from 'react';
import { ReminderItem } from '../types/reminder';
import { getJapaneseDayOfWeek, getScheduleCategory } from '../utils/dateUtils';
import { Edit3, Check, Calendar, Bell, Repeat, FileText, Send, CheckCircle2, RefreshCw, XCircle, ExternalLink } from 'lucide-react';

interface ReminderCardProps {
  reminder?: ReminderItem;
  item?: ReminderItem;
  category?: 'past' | 'today' | 'future';
  onEdit: (reminder: ReminderItem) => void;
  onComplete: (reminder: ReminderItem) => void;
  onPushToCalendar?: (reminder: ReminderItem) => void;
  onExportToCalendar?: (reminder: ReminderItem) => void;
  onUnlinkCalendar?: (reminder: ReminderItem) => void;
  onDelete?: (reminder: ReminderItem) => void;
  isPushingCalendar?: boolean;
  isPushing?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (reminder: ReminderItem) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder: propReminder,
  item: propItem,
  category: propCategory,
  onEdit,
  onComplete,
  onPushToCalendar,
  onExportToCalendar,
  onUnlinkCalendar,
  isPushingCalendar = false,
  isPushing = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const reminder = propReminder || propItem;
  if (!reminder) return null;

  const category = propCategory || getScheduleCategory(reminder.target_time || '');
  const dayOfWeek = getJapaneseDayOfWeek(reminder.target_time || '');
  const handlePush = onPushToCalendar || onExportToCalendar;
  const isBusyPushing = isPushingCalendar || isPushing;

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
              className="w-5 h-5 rounded border-gray-500 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {/* Top row: Target Time, Day of week, Category badge */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shadow-xs ${timeColorClass}`}>
              <Calendar className="w-3.5 h-3.5" />
              <span>{reminder.target_time}</span>
              <span className="font-medium text-[11px]">{dayOfWeek}</span>
            </div>

            {/* Repeat tag */}
            {reminder.repeat && reminder.repeat !== 'なし' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-purple-950/70 text-purple-300 border border-purple-700/60">
                <Repeat className="w-3 h-3" />
                <span>{reminder.repeat}</span>
              </span>
            )}

            {/* Snoozed tag */}
            {reminder.snoozed_until && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60 animate-pulse">
                <span>💤 スヌーズ中 ({reminder.snoozed_until.split(' ')[1]})</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base sm:text-lg font-bold text-white tracking-wide leading-snug break-words mb-1.5">
            {reminder.title}
          </h3>

          {/* Sub info: Sound, Notices, Memo */}
          <div className="space-y-1.5 text-xs text-gray-300">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400">
              <span className="inline-flex items-center gap-1">
                <span>🎵</span>
                <span className="text-gray-200 font-medium truncate max-w-[180px]">{reminder.sound}</span>
              </span>

              {reminder.notices && reminder.notices !== 'なし' && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <Bell className="w-3 h-3 text-emerald-400" />
                  <span>事前通知: {reminder.notices}</span>
                </span>
              )}

              <span>音量: {(reminder as any).volume !== undefined ? (reminder as any).volume : 70}%</span>
            </div>

            {/* Memo text */}
            {reminder.memo && (
              <div className="flex items-start gap-1.5 text-gray-200 bg-black/20 p-2.5 rounded-xl border border-gray-700/40 mt-1">
                <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="whitespace-pre-line leading-relaxed break-words">{reminder.memo}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        {!isSelectionMode && (
          <div className="flex flex-col gap-2 shrink-0 self-center">
            {/* Complete Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(reminder);
              }}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-bold transition shadow-sm cursor-pointer border border-emerald-400/40"
              title="予定を完了にする"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>完了</span>
            </button>

            {/* Edit Button */}
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
      {!isSelectionMode && handlePush && (
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
                    handlePush(reminder);
                  }}
                  disabled={isBusyPushing}
                  className="px-2.5 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-500/50 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title="Googleカレンダーの内容を再更新・再送信"
                >
                  <RefreshCw className={`w-3 h-3 ${isBusyPushing ? 'animate-spin' : ''}`} />
                  <span>{isBusyPushing ? '更新中...' : '再送信'}</span>
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
                  handlePush(reminder);
                }}
                disabled={isBusyPushing}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-700 hover:from-blue-600 hover:to-sky-600 active:scale-95 text-white text-xs font-bold border border-blue-400/50 transition shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                title="スマホ本体のGoogleカレンダーにこの予定を送信して追加"
              >
                <Calendar className="w-4 h-4 text-blue-200" />
                <span>{isBusyPushing ? '送信中...' : '📅 Googleカレンダーに送る'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
