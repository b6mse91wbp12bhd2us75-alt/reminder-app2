import React, { useState } from 'react';
import {
  Smartphone,
  X,
  BookOpen,
  Volume2,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Music,
  BellRing,
  CheckCircle2,
  Settings,
  BatteryCharging,
  Layers,
} from 'lucide-react';

interface PhoneShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhoneShareModal: React.FC<PhoneShareModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'settings'>('manual');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#232b38] border border-gray-600 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#1a202c] px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-gray-700/70 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">リマインダー使い方 ＆ 初期設定ガイド</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-[#181f2a] p-1.5 grid grid-cols-2 gap-1.5 border-b border-gray-700/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📖 使い方ガイド</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>⚙️ スマホ初期設定ガイド</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
          {activeTab === 'manual' && (
            <div className="space-y-4 text-xs sm:text-sm">
              {/* Introduction Banner */}
              <div className="bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/50 rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-300 font-bold text-sm">
                  <BellRing className="w-4 h-4 text-amber-400" />
                  <span>リマインダーアプリ基本機能</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">
                  指定時刻に好みのMP3音源やバイブレーションで確実に知らせるリマインダーです。個別の音量調整や事前通知、Googleカレンダー送信にも対応しています。
                </p>
              </div>

              {/* Step 1: 予定の追加 */}
              <div className="bg-[#1a202c] border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 border border-emerald-500 text-white flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>予定の作成・タイマー設定</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  画面下の青い<strong>「＋ 予定を追加する」ボタン</strong>を押して予定を作成します。
                </p>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside pl-7 leading-relaxed">
                  <li><strong>タイトル・メモ</strong>：用件や注意点を自由に入力できます。</li>
                  <li><strong>通知日時</strong>：「今日」「明日」「今週末」「+5分」「+10分」などのボタンで素早く日付・時刻をセットできます。</li>
                  <li><strong>事前通知</strong>：「1日前」「10分前」「5分前」など、本番より前に鳴らす事前通知を追加できます。本番と同様に画面が消えていてもアラーム音とバイブレーションでお知らせします。</li>
                  <li><strong>リピート設定</strong>：「毎日」「毎週」「毎月」「〇日おき」などの繰り返し設定が可能です（不要な場合は「なし」）。</li>
                  <li><strong>スヌーズ</strong>：通知時に「後で鳴らす」時間（分）を指定できます。</li>
                  <li><strong>鳴動秒数</strong>：アラームを何秒間鳴らすかを指定できます（0秒にすると止めるまで連続）。</li>
                </ul>
              </div>

              {/* Step 2: 音量調節機能 */}
              <div className="bg-[#1a202c] border border-emerald-500/50 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-900 border border-emerald-500 text-white flex items-center justify-center text-xs">
                    2
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span>予定ごとの音量調節設定</span>
                  </div>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  予定作成画面のスライダーで、<strong>0%（無音・バイブ通知のみ）から100%（最大）まで</strong>予定ごとに個別の音量を設定できます。
                </p>
                <div className="ml-7 p-2.5 rounded-xl bg-black/30 border border-emerald-700/50 text-[11px] text-gray-200 space-y-1.5 leading-relaxed">
                  <p>
                    🚇 <strong>電車・バス・街中での利用</strong>：音量を小さめ（20〜40%）に設定したり、0%にして振動（バイブレーション）と全画面表示のみで周囲に迷惑をかけず気づくことができます。
                  </p>
                  <p>
                    🏠 <strong>自宅で確実に気づきたい時</strong>：音量を80〜100%に上げておけば、別室にいても聞き逃しません。
                  </p>
                  <p className="text-amber-300/90 text-[10px]">
                    ※スマホ本体のメディア音量（側面の音量ボタン）が極小やミュートになっていると全体が小さくなりますのでご注意ください。
                  </p>
                </div>
              </div>

              {/* Step 3: アラーム音源の追加 (MP3) */}
              <div className="bg-[#1a202c] border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-sky-900 border border-sky-500 text-white flex items-center justify-center text-xs">
                    3
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-sky-400" />
                    <span>お好みのMP3音源の追加</span>
                  </div>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  作成画面の「アラーム音」欄にある<strong>「外部音源を取り込む」</strong>ボタンから、スマホ内のMP3音声ファイルを複数登録できます。
                </p>
                <div className="ml-7 p-2.5 rounded-xl bg-black/30 border border-sky-700/50 text-[11px] text-sky-200 space-y-1">
                  <p>🎵 追加した音源はスマホ端末内に保存され、次回以降どの予定でもプルダウンから選べるようになります。</p>
                  <p>🗑️ 不要になった曲は、選択した状態で表示される「ゴミ箱」ボタンからいつでも削除できます。</p>
                </div>
              </div>

              {/* Step 4: Googleカレンダーへの送信 */}
              <div className="bg-[#1a202c] border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-amber-900 border border-amber-500 text-white flex items-center justify-center text-xs">
                    4
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>Googleカレンダーへの送信（一方通行）</span>
                  </div>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  リマインダーで作成した予定を、スマートフォンのGoogleカレンダーアプリに直接送ることができます。
                </p>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside pl-7 leading-relaxed">
                  <li><strong>個別送信</strong>：各予定カードの下にある<strong>「📅 Googleカレンダーに送る」</strong>ボタンを押すと、スマホのGoogleカレンダーアプリが自動で開き、予定が入力された状態で登録画面が表示されます（ブラウザログインや連携設定は一切不要です）。</li>
                  <li><strong>一括送信</strong>：上部の「選択して一括送信」ボタンを押すと、複数の予定にチェックを入れてまとめてカレンダーアプリに送ることができます。</li>
                  <li className="text-amber-200/90 font-medium">
                    ⚠️ <strong>安心の一方通行仕様</strong>：リマインダーからカレンダーへ送信するだけであり、Googleカレンダー側の既存予定が本アプリに勝手に流れ込んでくることは一切ありません。
                  </li>
                </ul>
              </div>

              {/* Step 5: プライバシーとデータ保存 */}
              <div className="bg-emerald-950/60 border border-emerald-600/70 rounded-2xl p-3.5 space-y-1 text-xs text-emerald-200">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300 text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>データの保存とプライバシーについて</span>
                </div>
                <p className="text-[11px] text-gray-300 pl-5 leading-relaxed">
                  登録された予定や音源データは、<strong>各スマホ端末内（ローカルストレージ・端末内部ストレージ）にのみ独立して保存</strong>されます。クラウドサーバーに送信されたり他人の端末と混ざることは一切ありませんのでご安心ください。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-[#1a202c] border-2 border-emerald-500/80 rounded-2xl p-4 space-y-2 shadow-md">
                <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>テスター様へ：最初に必ず行ってほしいスマホ本体設定</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Androidスマホには強力な「バッテリー節電（最適化）」機能が備わっており、<strong>初期設定のままだと画面ロック（スリープ）時にアプリが眠らされ、時間になってもアラームが鳴らない原因</strong>になります。
                </p>
                <p className="text-[11px] text-emerald-300">
                  アプリをインストールしたら、まず以下の<strong>3つの項目</strong>を設定してください。
                </p>
              </div>

              <div className="space-y-3">
                {/* 1: Battery Optimization */}
                <div className="bg-[#1a202c] border border-emerald-500/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    <span>① バッテリー使用量：『制限なし（最適化しない）』</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed pl-6">
                    画面が消えていても時間通りにアラームを起動させるための最も重要な設定です。
                  </p>
                  <div className="ml-6 p-2.5 rounded-xl bg-black/40 border border-gray-700 text-[11px] text-gray-200 space-y-1">
                    <p className="font-semibold text-emerald-200">設定手順：</p>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-gray-300">
                      <li>スマホの<strong>「設定」</strong>アイコンを開きます。</li>
                      <li><strong>「アプリ」</strong>（または「アプリと通知」）→<strong>「リマインダー」</strong>を選択。</li>
                      <li><strong>「バッテリー」</strong>（または「バッテリー使用量」）をタップ。</li>
                      <li><strong>「制限なし」</strong>（最適化しない / バックグラウンド実行を許可）にチェックを入れます。</li>
                    </ol>
                  </div>
                </div>

                {/* 2: Exact Alarms & Reminders */}
                <div className="bg-[#1a202c] border border-sky-500/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sky-300 text-sm">
                    <BellRing className="w-4 h-4 text-sky-400" />
                    <span>② 通知設定：『アラームとリマインダー』を許可</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed pl-6">
                    秒単位の正確な時刻でアラームを動作させるための権限です。
                  </p>
                  <div className="ml-6 p-2.5 rounded-xl bg-black/40 border border-gray-700 text-[11px] text-gray-200 space-y-1">
                    <p className="font-semibold text-sky-200">設定手順：</p>
                    <p className="text-gray-300 leading-relaxed">
                      スマホの「設定」→「アプリ」→「特別なアプリアクセス」→<strong>「アラームとリマインダー」</strong>で「リマインダー」が<strong>ON（許可）</strong>になっていることを確認します。
                    </p>
                  </div>
                </div>

                {/* 3: Display over other apps */}
                <div className="bg-[#1a202c] border border-purple-500/60 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>③ 他のアプリの上に重ねて表示：『許可』</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed pl-6">
                    画面ロック時や他のアプリ（LINEやブラウザ等）を見ている最中でも、時間になったらアラーム画面を最前面にポップアップ表示させる設定です。
                  </p>
                  <div className="ml-6 p-2.5 rounded-xl bg-black/40 border border-gray-700 text-[11px] text-gray-200 space-y-1">
                    <p className="font-semibold text-purple-200">設定手順：</p>
                    <p className="text-gray-300 leading-relaxed">
                      「設定」→「アプリ」→「リマインダー」→<strong>「他のアプリの上に重ねて表示」</strong>を<strong>許可</strong>にします。
                    </p>
                  </div>
                </div>
              </div>

              {/* Manufacturer Specific Tips */}
              <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-3.5 space-y-1.5 text-xs text-gray-300">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>機種別の節電機能について（Galaxy, AQUOS, Xperia, Pixelなど）</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Galaxyの「自動スリープにするアプリ」や、AQUOSの「長エネスイッチ」など、メーカー独自の節電機能が有効になっている場合、本アプリが除外対象（常に動作を許可）になっているかあわせてご確認ください。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#1a202c] border-t border-gray-700/80 text-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-98 text-white font-bold text-xs transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
