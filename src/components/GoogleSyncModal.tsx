import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Calendar, CheckCircle2, LogOut, AlertTriangle, Trash2, Send, CheckSquare, X } from 'lucide-react';

interface GoogleSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  hasToken: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  importedCount?: number;
  onPurgeImported?: () => void;
  onStartBatchExport?: () => void;
}

export const GoogleSyncModal: React.FC<GoogleSyncModalProps> = ({
  isOpen,
  onClose,
  user,
  hasToken,
  onSignIn,
  onSignOut,
  importedCount = 0,
  onPurgeImported,
  onStartBatchExport,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDisconnect = async () => {
    setIsProcessing(true);
    try {
      await onSignOut();
      setMessage('Google連携を解除しました。');
    } catch (err: any) {
      setMessage(`解除エラー: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#2d3748] border border-gray-600 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1a202c] px-5 py-3.5 flex items-center justify-between border-b border-gray-700/70 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base text-white">Googleカレンダー送信連携</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Explanation Box */}
          <div className="bg-[#1f2837] border border-blue-500/40 p-3 rounded-2xl text-xs text-blue-200 leading-relaxed space-y-1">
            <div className="font-bold text-blue-300 flex items-center gap-1.5 text-xs">
              <span>📤</span>
              <span>リマインダーからの「選択式送信」専用です</span>
            </div>
            <p className="text-[11px] text-gray-300">
              本アプリから選んだ予定だけをGoogleカレンダーへ一方送信（エクスポート）します。
              カレンダー側の既存予定が本アプリに自動で入ることは一切ありません。
            </p>
          </div>

          {/* Connected state */}
          {user && hasToken ? (
            <div className="space-y-4">
              <div className="bg-[#3a4a5e] p-3.5 rounded-2xl border border-emerald-500/40 flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-10 h-10 rounded-full border border-gray-500 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shrink-0">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Google接続中</span>
                  </div>
                  <div className="font-bold text-sm text-white truncate">
                    {user.displayName || 'Googleアカウント'}
                  </div>
                  <div className="text-xs text-gray-300 truncate">{user.email}</div>
                </div>
              </div>

              {/* Action 1: Multi-selection batch export */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onStartBatchExport) {
                      onStartBatchExport();
                    }
                  }}
                  className="w-full py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>予定一覧で選んでカレンダーに送信</span>
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  ※ 各予定カードの「📅 カレンダーに送る」ボタンからも直接送信できます。
                </p>
              </div>

              {/* Cleanup Banner if imported items exist */}
              {importedCount > 0 && onPurgeImported && (
                <div className="bg-amber-950/70 border border-amber-600/60 p-3 rounded-2xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200">
                      過去に自動取込されたカレンダー予定が <strong>{importedCount}件</strong> あります。
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onPurgeImported();
                      setMessage('自動取込された予定を削除しました。');
                    }}
                    className="w-full py-2 px-2.5 rounded-xl bg-red-800 hover:bg-red-700 active:scale-98 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>取込予定（{importedCount}件）を一括削除する</span>
                  </button>
                </div>
              )}

              {/* Instant Disconnect Button (Prominent) */}
              <div className="pt-2 border-t border-gray-700/60 space-y-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Google連携を解除する（切断）</span>
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  連携を解除するとGoogleカレンダーとの接続が即座に切断されます。
                </p>
              </div>
            </div>
          ) : (
            /* Not connected state */
            <div className="space-y-4 text-center">
              <div className="p-3 bg-gray-800/80 border border-gray-700 rounded-2xl text-left text-xs text-gray-300 leading-relaxed">
                Googleアカウントでログインすると、登録した農園や病院などのリマインダーを、ご自身のGoogleカレンダーへボタン一つで送信・登録できるようになります。
              </div>

              {/* Sign in button */}
              <button
                type="button"
                onClick={async () => {
                  setIsProcessing(true);
                  setMessage(null);
                  try {
                    await onSignIn();
                    setMessage('Googleアカウントに接続しました！');
                  } catch (e: any) {
                    setMessage(`接続に失敗しました: ${e.message}`);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2.5 shadow-md disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Googleでログインしてカレンダー送信を有効化</span>
              </button>
            </div>
          )}

          {message && (
            <p className="text-xs text-center text-blue-200 bg-blue-950/60 p-2 rounded-lg border border-blue-800">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
