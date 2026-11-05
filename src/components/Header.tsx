import React from 'react';
import { Smartphone, BookOpen } from 'lucide-react';

interface HeaderProps {
  onOpenPhoneModal: () => void;
  onOpenApkModal?: () => void;
  isFramed?: boolean;
  onToggleFrame?: () => void;
  // Backward compatibility optional props
  user?: any;
  hasCalendarToken?: boolean;
  hasToken?: boolean;
  onOpenGoogleSync?: () => void;
  onOpenSyncModal?: () => void;
  onOpenPhoneShare?: () => void;
  currentTab?: 'schedule' | 'completed';
  onSwitchTab?: (tab: 'schedule' | 'completed') => void;
  onOpenAddModal?: () => void;
  scheduleCount?: number;
  completedCount?: number;
  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  selectedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPhoneModal,
  onOpenPhoneShare,
  isFramed = true,
  onToggleFrame,
}) => {
  const handleOpenHelp = onOpenPhoneModal || onOpenPhoneShare;

  return (
    <header className="bg-[#1a202c] border-b border-gray-700/60 sticky top-0 z-30 shadow-md">
      <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
        {/* App Title */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide text-gray-100 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            ⏰ リマインダー
          </span>
        </div>

        {/* Action Buttons: 説明書 */}
        <div className="flex items-center gap-2">
          {/* User Guide modal */}
          {handleOpenHelp && (
            <button
              type="button"
              onClick={handleOpenHelp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-900/80 shadow-xs active:scale-95"
              title="使い方説明書・Android設定"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>説明書</span>
            </button>
          )}

          {/* Frame toggle for desktop test */}
          {onToggleFrame && (
            <button
              type="button"
              onClick={onToggleFrame}
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition cursor-pointer"
              title="スマホ枠表示の切り替え"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isFramed ? '全画面' : '枠'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
