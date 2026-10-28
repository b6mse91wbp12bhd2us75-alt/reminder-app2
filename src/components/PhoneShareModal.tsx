import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Copy,
  Check,
  X,
  BookOpen,
  Bell,
  Volume2,
  Calendar,
  ShieldCheck,
  RefreshCw,
  Plus,
  Share2,
  Sparkles,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface PhoneShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhoneShareModal: React.FC<PhoneShareModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'share'>('manual');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [timestamp, setTimestamp] = useState<number>(() => Date.now());

  const sharedUrl = 'https://ais-pre-5xj7ydgmrz6lp2zu6xyzcr-80586200008.asia-east1.run.app';
  const appUrl = `${sharedUrl}?t=${timestamp}`;

  const handleRefreshQR = () => {
    setTimestamp(Date.now());
  };

  const handleForceUpdate = async () => {
    const confirmed = window.confirm(
      'ブラウザの古いキャッシュをすべて消去して、最新版を強制再読み込みしますか？\n（※登録済みの予定や音源データは消えません）'
    );
    if (confirmed) {
      const win = window as unknown as { forceUpdateApp?: () => Promise<void> };
      if (win.forceUpdateApp) {
        await win.forceUpdateApp();
      } else {
        window.location.reload();
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(appUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#1a202c',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation failed:', err));
    }
  }, [isOpen, appUrl, timestamp]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#2d3748] border border-gray-600 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#1a202c] px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-gray-700/70 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">説明書 ＆ スマホ登録・共有</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-[#1e2530] p-1.5 flex gap-1 border-b border-gray-700/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>📖 使い方説明書（ガイド）</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'share'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>📱 スマホ登録・QR共有</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-sm">
          {activeTab === 'manual' ? (
            /* =================== TAB 1: 使い方説明書 =================== */
            <div className="space-y-4 text-xs sm:text-sm">
              {/* Introduction Banner */}
              <div className="bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/50 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-blue-300 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>リマインダー検証用クイックガイド</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">
                  本アプリは、大画面で見やすい通知・アラーム機能と、Googleカレンダーへの個別送信を備えた個人用リマインダーです。以下の手順で検証をお願いします。
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
                  右上の青い<strong>「＋追加」ボタン</strong>を押して作成します。
                </p>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside pl-7 leading-relaxed">
                  <li><strong>タイトル・メモ</strong>：予定の名称と注意点を入力します。</li>
                  <li><strong>通知日時</strong>：「今日」「明日」「今週末」ボタンで素早く日付をセットできます。</li>
                  <li><strong>リピート</strong>：「毎日」「毎週」「毎月」「〇日おき」などの繰り返し設定が可能です。</li>
                  <li><strong>スヌーズ</strong>：通知時に「後で鳴らす」時間（分）を指定できます。</li>
                  <li><strong>鳴動秒数</strong>：アラームを何秒間鳴らすかを指定できます（0秒にすると止めるまで無限連続）。</li>
                  <li><strong>事前通知</strong>：「1日前」「10分前」など、指定時刻より前に鳴らす事前通知を追加できます。</li>
                </ul>
              </div>

              {/* Step 2: アラーム音源の追加 (MP3) */}
              <div className="bg-[#1a202c] border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sky-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-sky-900 border border-sky-500 text-white flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>お好みのMP3音源の追加</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  作成画面の「アラーム音源」欄にある<strong>「＋音源を追加」</strong>ボタンから、スマホ内のMP3音声ファイルを複数まとめて登録できます！
                </p>
                <div className="ml-7 p-2.5 rounded-xl bg-black/30 border border-sky-700/50 text-[11px] text-sky-200 space-y-1">
                  <p>🎵 追加した音源はスマホ端末内に自動保存され、次回以降どの予定でもプルダウンから選べるようになります。</p>
                  <p>🗑️ 不要になった曲は、プルダウンで選択した状態で表示される「ゴミ箱」ボタンからいつでも削除できます。</p>
                </div>
              </div>

              {/* Step 3: Googleカレンダーへの送信 */}
              <div className="bg-[#1a202c] border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-amber-900 border border-amber-500 text-white flex items-center justify-center text-xs">
                    3
                  </span>
                  <span>Googleカレンダーへの送信（一方通行）</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  リマインダーで作成した予定を、ご自身のGoogleカレンダーに反映できます。
                </p>
                <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside pl-7 leading-relaxed">
                  <li><strong>作成時</strong>：「この予定をGoogleカレンダーにも送信する」にチェックを入れると同時に反映されます。</li>
                  <li><strong>作成後</strong>：予定カードの下にある「Googleカレンダーに送る」ボタンを押しても送信できます。</li>
                  <li><strong>まとめて送信</strong>：上部の「選択送信」ボタンから、複数チェックして一括送信も可能です。</li>
                  <li className="text-amber-200/90 font-medium">
                    ⚠️ <strong>安心仕様</strong>：リマインダーからカレンダーへの一方通行です。Googleカレンダー側の予定が本アプリに勝手に流れ込んでくることは一切ありません。
                  </li>
                </ul>
              </div>

              {/* Step 4: 完了とリピート */}
              <div className="bg-[#1a202c] border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-300 text-sm">
                  <span className="w-5 h-5 rounded-full bg-purple-900 border border-purple-500 text-white flex items-center justify-center text-xs">
                    4
                  </span>
                  <span>予定の完了と繰り返し</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  アラームが鳴ったとき、または予定カードの「完了」ボタンを押すと「完了」タブに移動します。
                </p>
                <p className="text-gray-300 text-xs leading-relaxed pl-7">
                  ※「毎日」や「毎週」などのリピート設定がある予定は、完了を押すと自動的に次の予定日が計算されて新しい予定が継続作成されます。
                </p>
              </div>

              {/* Crucial Notice: App Closed vs Native Android APK */}
              <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 border-2 border-emerald-500/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300 text-sm">
                  <span>📱</span>
                  <span>画面オフ・アプリ終了時でも鳴る「Android単体アプリ」について</span>
                </div>
                <div className="space-y-1.5 text-gray-200 leading-relaxed pl-1 text-[11px]">
                  <p>
                    <strong>🌐 ブラウザ版（Chrome）をご利用の場合：</strong><br />
                    スマートフォンの省電力制限により、画面を閉じている間はアラームが待機状態になります（アプリ画面に戻した瞬間に鳴動します）。
                  </p>
                  <p className="text-emerald-200 pt-1 font-semibold">
                    <strong>🌟 URLバーなし＆画面オフでも大音量で鳴る「Android専用アプリ（APK）」：</strong><br />
                    画面上部の <strong>【📱 単体アプリ (APK)】</strong> ボタンから、Android単体アプリ化プロジェクト一式（ZIP）をダウンロードしてご利用いただけます！
                  </p>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="bg-emerald-950/60 border border-emerald-600/70 rounded-2xl p-3 space-y-1 text-xs text-emerald-200">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>プライバシーとデータ保護について</span>
                </div>
                <p className="text-[11px] text-gray-300 pl-5 leading-relaxed">
                  登録された予定や音源データは、<strong>各自のスマホ端末内（ブラウザ保存領域）にのみ独立して保存</strong>されます。他の方のデータと混ざることは一切ありませんのでご安心ください。
                </p>
              </div>
            </div>
          ) : (
            /* =================== TAB 2: スマホ登録・共有 =================== */
            <div className="space-y-4 text-xs sm:text-sm">
              {/* Important Android Note */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-[#1a202c] border-2 border-indigo-500/70 rounded-2xl p-4 space-y-2.5 shadow-md">
                <div className="flex items-center gap-2 text-white font-extrabold text-sm">
                  <span>📱</span>
                  <span>スマホのホーム画面に置く手順（ショートカット作成）</span>
                </div>

                <div className="space-y-2 text-xs text-gray-200 leading-relaxed bg-black/30 p-3 rounded-xl border border-gray-700/60">
                  <p className="font-bold text-emerald-300">🤖 Android (Chrome) の場合：</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-gray-300 text-[11px]">
                    <li>画面右上のメニュー（縦の3点リーダー「︙」）をタップします。</li>
                    <li>開いたメニューから<strong>「ホーム画面に追加」</strong>をタップします。</li>
                    <li>「追加」を押すと、ホーム画面にリマインダーアイコンが作成されます。</li>
                  </ol>
                  <p className="text-[10px] text-amber-300/90 pt-1">
                    ※セキュリティ保護環境のためChromeショートカットとして起動し、画面上部にURLバーが表示されますが、正常な動作ですのでそのままご使用ください。
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-gray-200 leading-relaxed bg-black/30 p-3 rounded-xl border border-gray-700/60">
                  <p className="font-bold text-sky-300">🍏 iPhone (Safari) の場合：</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-gray-300 text-[11px]">
                    <li>Safari画面下部の「共有ボタン（四角から上矢印）」をタップします。</li>
                    <li>メニュー内の<strong>「ホーム画面に追加」</strong>をタップします。</li>
                    <li>ホーム画面からワンタップですぐに起動できます。</li>
                  </ol>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-[#3a4a5e] border border-gray-600/80 rounded-2xl p-4 text-center space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-200">
                    友人のスマホカメラでスキャンしてアクセス
                  </p>
                  <button
                    type="button"
                    onClick={handleRefreshQR}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sky-300 font-bold border border-gray-500 cursor-pointer transition flex items-center gap-1"
                    title="新しいタイムスタンプでQRを再生成"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>最新QRに更新</span>
                  </button>
                </div>

                <div className="flex justify-center">
                  {qrDataUrl ? (
                    <div className="p-3 bg-white rounded-2xl shadow-xl inline-block border-2 border-emerald-500/30">
                      <img src={qrDataUrl} alt="スマホ用QRコード" className="w-44 h-44 sm:w-48 sm:h-48 block mx-auto" />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-gray-700 animate-pulse rounded-2xl flex items-center justify-center text-xs text-gray-400">
                      QRコード生成中...
                    </div>
                  )}
                </div>

                {/* URL Copy Button */}
                <div className="flex items-center gap-2 bg-[#2d3748] p-1.5 rounded-xl border border-gray-600">
                  <input
                    type="text"
                    readOnly
                    value={appUrl}
                    className="bg-transparent text-xs text-gray-300 px-2 flex-1 focus:outline-none truncate select-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'コピー完了' : 'URLコピー'}</span>
                  </button>
                </div>
              </div>

              {/* In-app force update */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-3.5 space-y-2">
                <p className="text-xs font-bold text-gray-300">
                  💡 アプリが更新されたのに画面が変わらない時
                </p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  スマホの古いキャッシュを消去して、最新バージョンを強制再読み込みします。
                </p>
                <button
                  type="button"
                  onClick={handleForceUpdate}
                  className="w-full py-2 px-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-98 text-sky-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-gray-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>この端末のキャッシュを消去して最新版に更新</span>
                </button>
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
