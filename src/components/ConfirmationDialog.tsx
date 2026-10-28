import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-[#2d3748] border border-gray-600 shadow-2xl p-6 text-white transform transition-all">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>

        <p className="text-sm text-gray-300 mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-semibold transition active:scale-95 cursor-pointer text-center"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition active:scale-95 cursor-pointer text-center ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
