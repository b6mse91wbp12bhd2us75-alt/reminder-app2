import React from 'react';
import { ReminderItem } from '../types/reminder';
import { CheckCircle2, Edit3, Trash2, Calendar, FileText } from 'lucide-react';

interface CompletedCardProps {
  item?: ReminderItem;
  reminder?: ReminderItem;
  onEdit: (item: ReminderItem) => void;
  onDelete: (item: ReminderItem) => void;
  onRestore?: (item: ReminderItem) => void;
}

export const CompletedCard: React.FC<CompletedCardProps> = ({
  item: propItem,
  reminder: propReminder,
  onEdit,
  onDelete,
  onRestore,
}) => {
  const item = propItem || propReminder;
  if (!item) return null;

  return (
    <div className="bg-[#3a4a5e] border border-gray-600/70 rounded-2xl p-4 shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        {/* Left Section */}
        <div className="flex-1 min-w-0">
          {/* Completed badge */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/60">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>完了日時: {item.completed_time || '完了済'}</span>
            </span>

            {item.google_event_id && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-900/40 text-blue-300 border border-blue-700/40">
                <Calendar className="w-3 h-3" />
                <span>カレンダー同期済</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-base font-bold text-white line-through opacity-85 leading-snug break-words mb-1.5">
            {item.title}
          </h4>

          {/* Sub info */}
          <div className="text-xs text-gray-300 space-y-1">
            <div className="text-gray-400">
              元日時: <span className="text-gray-300 font-medium">{item.target_time}</span>
            </div>
            {item.memo && (
              <div className="flex items-start gap-1.5 text-gray-300 bg-black/15 p-2 rounded-lg">
                <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="whitespace-pre-line leading-relaxed break-words">{item.memo}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 self-center">
          {onRestore && (
            <button
              type="button"
              onClick={() => onRestore(item)}
              className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold transition cursor-pointer"
              title="予定表に戻す"
            >
              <span>↩️ 戻す</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-[#2b6cb0] hover:bg-[#2c5282] active:scale-95 text-white text-xs font-bold transition cursor-pointer"
            title="再編集"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>編集</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(item)}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-red-700 hover:bg-red-600 active:scale-95 text-white text-xs font-bold transition cursor-pointer"
            title="削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>削除</span>
          </button>
        </div>
      </div>
    </div>
  );
};
