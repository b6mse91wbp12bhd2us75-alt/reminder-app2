import React from 'react';
import { Plus, Calendar, CheckCircle2, ListTodo, Smartphone, QrCode, RefreshCw, CheckSquare, BookOpen } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  currentTab: 'schedule' | 'completed';
  onSwitchTab: (tab: 'schedule' | 'completed') => void;
  onOpenAddModal: () => void;
  onOpenSyncModal: () => void;
  onOpenDataModal?: () => void;
  onOpenPhoneModal: () => void;
  onOpenApkModal?: () => void;
  user: User | null;
  hasToken: boolean;
  scheduleCount: number;
  completedCount: number;
  isFramed: boolean;
  onToggleFrame: () => void;
  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  selectedCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSwitchTab,
  onOpenAddModal,
  onOpenSyncModal,
  onOpenDataModal,
  onOpenPhoneModal,
  onOpenApkModal,
  user,
  hasToken,
  scheduleCount,
  completedCount,
  isFramed,
  onToggleFrame,
  isSelectionMode = false,
  onToggleSelectionMode,
  selectedCount = 0,
}) => {
  return (
    <header className="bg-[#1a202c] border-b border-gray-700/60 sticky top-0 z-30 shadow-md">
      {/* Top Status & Brand Row */}
      <div className="px-3.5 py-2 flex items-center justify-between border-b border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-wide text-gray-200 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            リマインダー
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Force App Update / Cache clear button */}
          <button
            type="button"
            onClick={async () => {
              const confirmed = window.confirm(
                'アプリを最新版に強制再読み込みしますか？\n（ブラウザの古いキャッシュを消去して最新バージョンを読み込みます。予定データは消えません）'
              );
              if (confirmed) {
                const win = window as unknown as { forceUpdateApp?: () => Promise<void> };
                if (win.forceUpdateApp) {
                  await win.forceUpdateApp();
                } else {
                  window.location.reload();
                }
              }
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition cursor-pointer bg-gray-800 border border-gray-700 text-sky-300 hover:bg-gray-700 hover:text-sky-200"
            title="アプリを最新版に強制更新（キャッシュ削除）"
          >
            <RefreshCw className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">最新化</span>
          </button>

          {/* Android APK standalone preparation button */}
          {onOpenApkModal && (
            <button
              type="button"
              onClick={onOpenApkModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs border border-emerald-400/60"
              title="Android単体アプリ（APK）化プロジェクト"
            >
              <Smartphone className="w-3.5 h-3.5 text-white" />
              <span>📱 単体アプリ (APK)</span>
            </button>
          )}

          {/* Smartphone QR / User Manual instruction button */}
          <button
            type="button"
            onClick={onOpenPhoneModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-900/80 shadow-xs"
            title="使い方説明書・スマホ共有（QRコード）"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>説明書</span>
          </button>

          {/* Google Calendar status & settings button */}
          <button
            type="button"
            onClick={onOpenSyncModal}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer select-none ${
              user && hasToken
                ? 'bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 hover:bg-emerald-900 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
            }`}
            title="Googleカレンダー送信設定・アカウント切替"
          >
            {user && hasToken ? (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="sm:hidden font-bold text-emerald-300">連携中</span>
                <span className="hidden sm:inline font-bold text-emerald-200">カレンダー連携中</span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full border border-gray-500 bg-gray-600/50 shrink-0"></span>
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="sm:hidden text-gray-400">未連携</span>
                <span className="hidden sm:inline text-gray-400">カレンダー未連携</span>
              </>
            )}
          </button>

          {/* Desktop mobile frame toggle button */}
          <button
            type="button"
            onClick={onToggleFrame}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition cursor-pointer"
            title="スマホ枠表示の切り替え"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isFramed ? '全画面' : 'スマホ枠'}</span>
          </button>
        </div>
      </div>

      {/* Main Tabs and Action Row */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        {/* Navigation Tabs */}
        <div className="flex bg-[#2d3748] p-1 rounded-xl border border-gray-700/50">
          <button
            type="button"
            onClick={() => onSwitchTab('schedule')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              currentTab === 'schedule'
                ? 'bg-[#3182ce] text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>予定</span>
            {scheduleCount > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'schedule'
                    ? 'bg-blue-800 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {scheduleCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSwitchTab('completed')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              currentTab === 'completed'
                ? 'bg-[#38a169] text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>完了</span>
            {completedCount > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  currentTab === 'completed'
                    ? 'bg-emerald-900 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {completedCount}
              </span>
            )}
          </button>
        </div>

        {/* Right buttons: Multi-select export toggle + Add Reminder */}
        <div className="flex items-center gap-1.5">
          {currentTab === 'schedule' && onToggleSelectionMode && scheduleCount > 0 && (
            <button
              type="button"
              onClick={onToggleSelectionMode}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                isSelectionMode
                  ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-400'
                  : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-blue-200'
              }`}
              title="複数の予定を選んでGoogleカレンダーにまとめて送信"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSelectionMode ? `終了 (${selectedCount})` : '選択送信'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-blue-900/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>追加</span>
          </button>
        </div>
      </div>
    </header>
  );
};
