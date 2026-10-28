import React, { useRef, useState } from 'react';
import { ReminderItem } from '../types/reminder';
import { X, Upload, Download, FileJson, Music, Check, AlertCircle } from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: ReminderItem[];
  completed: ReminderItem[];
  onImportData: (newReminders: ReminderItem[], newCompleted: ReminderItem[]) => void;
  onAddCustomSounds: (sounds: { name: string; url: string }[]) => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  reminders,
  completed,
  onImportData,
  onAddCustomSounds,
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [soundStatus, setSoundStatus] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const mp3InputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Import reminders.json from Python app
  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const loadedReminders: ReminderItem[] = (parsed.reminders || []).map(
          (item: any, idx: number) => ({
            id: item.id || `imported-rem-${Date.now()}-${idx}`,
            title: item.title || '無題',
            memo: item.memo || '',
            target_time: item.target_time || '',
            repeat: item.repeat || 'なし',
            notices: item.notices || 'なし',
            sound: item.sound || '🔔 デフォルト着信音 (端末)',
            snooze_min: item.snooze_min || 5,
            duration: item.duration !== undefined ? item.duration : 5,
            google_event_id: item.google_event_id || null,
          })
        );

        const loadedCompleted: ReminderItem[] = (parsed.completed || []).map(
          (item: any, idx: number) => ({
            id: item.id || `imported-comp-${Date.now()}-${idx}`,
            title: item.title || '無題',
            memo: item.memo || '',
            target_time: item.target_time || '',
            completed_time: item.completed_time || '',
            repeat: item.repeat || 'なし',
            notices: item.notices || 'なし',
            sound: item.sound || '🔔 デフォルト着信音 (端末)',
            snooze_min: item.snooze_min || 5,
            duration: item.duration !== undefined ? item.duration : 5,
            google_event_id: item.google_event_id || null,
          })
        );

        onImportData(loadedReminders, loadedCompleted);
        setImportStatus(
          `「${file.name}」から予定 ${loadedReminders.length}件、完了履歴 ${loadedCompleted.length}件を読み込みました！`
        );
      } catch (err: any) {
        setImportStatus(`読み込みに失敗しました: JSONの形式を確認してください (${err.message})`);
      }
    };
    reader.readAsText(file);
  };

  // Export current data as reminders.json
  const handleExportJson = () => {
    const exportData = {
      reminders,
      completed,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reminders.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Upload MP3 files (ウルトラセブン.mp3, ウルトラ警備隊.mp3 etc.)
  const handleMp3Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSounds: { name: string; url: string }[] = [];
    let count = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newSounds.push({
          name: file.name,
          url: reader.result as string,
        });
        count++;
        if (count === files.length) {
          onAddCustomSounds(newSounds);
          setSoundStatus(`${files.length}件の音源（${newSounds.map((s) => s.name).join(', ')}）を追加しました！`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[#2d3748] border border-gray-600 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#1a202c] px-5 py-3.5 flex items-center justify-between border-b border-gray-700/70">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">データ引継ぎ・音源管理</h3>
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
        <div className="p-5 space-y-5 text-sm">
          {/* Section 1: reminders.json import/export */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <FileJson className="w-4 h-4" />
              <span>Python版 reminders.json の引継ぎ</span>
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              PC上の「<code className="text-amber-200">reminders.json</code>」を読み込むと、登録済みの予定や完了履歴をそのまま引き継ぐことができます。
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>JSONを読み込む</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="py-2.5 px-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-95 text-gray-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-gray-600"
              >
                <Download className="w-4 h-4" />
                <span>保存・書き出し</span>
              </button>

              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleJsonUpload}
                className="hidden"
              />
            </div>

            {importStatus && (
              <div className="text-xs text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 p-2.5 rounded-xl">
                {importStatus}
              </div>
            )}
          </div>

          <hr className="border-gray-700/60" />

          {/* Section 2: MP3 Custom Sounds */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Music className="w-4 h-4" />
              <span>お好みのMP3音源の登録</span>
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              「ウルトラセブン.mp3」や「ウルトラ警備隊.mp3」などのお手持ちのMP3を選択すると、リマインダーのアラーム音として設定できるようになります。
            </p>

            <button
              type="button"
              onClick={() => mp3InputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-xl bg-[#3182ce] hover:bg-[#2b6cb0] active:scale-95 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>MP3ファイルを追加（複数選択可）</span>
            </button>

            <input
              ref={mp3InputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a"
              multiple
              onChange={handleMp3Upload}
              className="hidden"
            />

            {soundStatus && (
              <div className="text-xs text-sky-300 bg-sky-950/70 border border-sky-700/60 p-2.5 rounded-xl">
                {soundStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
