import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requireTwoStep?: boolean;
  stepOneConfirmLabel?: string;
  stepTwoTitle?: string;
  stepTwoMessage?: string;
  stepTwoCheckboxLabel?: string;
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
  requireTwoStep = false,
  stepOneConfirmLabel = '次へ進む（最終確認）',
  stepTwoTitle,
  stepTwoMessage,
  stepTwoCheckboxLabel = 'この操作が元に戻せないことを理解し、削除を実行します',
  onConfirm,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isAgreed, setIsAgreed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsAgreed(false);
    }
  }, [isOpen, title, message]);

  if (!isOpen) return null;

  const isSecondStep = requireTwoStep && step === 2;
  const displayTitle = isSecondStep && stepTwoTitle ? stepTwoTitle : title;
  const displayMessage = isSecondStep && stepTwoMessage ? stepTwoMessage : message;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl bg-[#2d3748] border border-gray-600 shadow-2xl p-6 text-white transform transition-all">
        {requireTwoStep && (
          <div className="flex items-center justify-between mb-3">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isSecondStep
                  ? 'bg-red-950/90 text-red-300 border-red-600/70'
                  : 'bg-amber-950/90 text-amber-300 border-amber-600/70'
              }`}
            >
              誤操作防止：{isSecondStep ? 'ステップ 2 / 2（最終確認）' : 'ステップ 1 / 2'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2.5 rounded-full shrink-0 ${
              isSecondStep
                ? 'bg-red-600/30 text-red-300'
                : requireTwoStep
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {isSecondStep ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-base font-bold text-white leading-snug">{displayTitle}</h3>
        </div>

        <p className="text-sm text-gray-200 mb-5 leading-relaxed whitespace-pre-line">
          {displayMessage}
        </p>

        {isSecondStep && (
          <label className="flex items-start gap-2.5 p-3 mb-5 rounded-xl bg-red-950/40 border border-red-700/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAgreed}
              onChange={(e) => setIsAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-500 rounded cursor-pointer shrink-0"
            />
            <span className="text-xs font-bold text-red-200 leading-snug">
              {stepTwoCheckboxLabel}
            </span>
          </label>
        )}

        <div className="flex gap-3">
          {isSecondStep ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setIsAgreed(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-semibold transition active:scale-95 cursor-pointer text-center text-sm"
              >
                戻る
              </button>
              <button
                type="button"
                disabled={!isAgreed}
                onClick={onConfirm}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition text-center text-sm ${
                  isAgreed
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 active:scale-95 cursor-pointer'
                    : 'bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed opacity-60'
                }`}
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-semibold transition active:scale-95 cursor-pointer text-center text-sm"
              >
                {cancelLabel}
              </button>
              {requireTwoStep ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAgreed(false);
                    setStep(2);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-900/30 transition active:scale-95 cursor-pointer text-center text-sm"
                >
                  {stepOneConfirmLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConfirm}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold transition active:scale-95 cursor-pointer text-center text-sm ${
                    isDestructive
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {confirmLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
