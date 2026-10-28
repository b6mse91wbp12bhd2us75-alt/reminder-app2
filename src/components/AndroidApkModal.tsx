import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Download,
  CheckCircle2,
  ExternalLink,
  Github,
  Laptop,
  X,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  FileArchive,
  QrCode,
  FolderArchive,
  ArrowRight
} from 'lucide-react';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'success' | 'error'>('idle');
  const [downloadedSize, setDownloadedSize] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'github' | 'studio' | 'install'>('github');

  const directZipUrl = 'https://ais-pre-5xj7ydgmrz6lp2zu6xyzcr-80586200008.asia-east1.run.app/downloads/reminder-android-project.zip';

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(directZipUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [isOpen, directZipUrl]);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setDownloadState('downloading');
    setErrorMessage(null);
    try {
      // Fetch entire file into memory blob to guarantee it is not 0 bytes
      const res = await fetch('/downloads/reminder-android-project.zip', {
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error(`ダウンロード通信に失敗しました (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      if (blob.size < 50000) {
        throw new Error(`ファイルが不完全です (${blob.size} バイト)。「新しいタブで開く」をお試しください。`);
      }
      const mb = Math.round((blob.size / 1024 / 1024) * 10) / 10;
      setDownloadedSize(mb);

      // Trigger standard save
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'reminder-android-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);

      setDownloadState('success');
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadState('error');
      setErrorMessage(err instanceof Error ? err.message : 'ダウンロードに失敗しました');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(directZipUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#1e2530] border border-gray-600 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#141a23] px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-gray-700/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Android単体アプリ（APK）化
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  STEP 1 & 2
                </span>
              </h3>
              <p className="text-xs text-gray-400">ブラウザ枠・URLバーなし ＆ 画面オフ完全アラーム対応</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-gray-300">

          {/* Alert explaining empty file fix */}
          <div className="bg-amber-950/40 border border-amber-600/60 rounded-2xl p-3.5 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>「ファイルが空で解凍できない」問題への対策済み</span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-200/90">
              前回のZIPは約64MBと重く、プレビュー枠内からのダウンロード時にブラウザの制限で0バイト（空）として中断される場合がありました。
              不要なテスト動画を完全削除し、<strong>2.2 MB（正常・解凍可能）</strong>に大幅軽量化しました。確実に中身が詰まったZIPを取得いただけます。
            </p>
          </div>

          {/* Main Action Banner: ZIP Download */}
          <div className="bg-gradient-to-br from-emerald-950/70 to-teal-950/50 border-2 border-emerald-500/70 rounded-2xl p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <h4 className="font-bold text-white text-base">
                  軽量Androidプロジェクト（完全版）
                </h4>
              </div>
              <span className="text-xs bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/50 font-bold shrink-0">
                実容量 2.2 MB
              </span>
            </div>

            <p className="text-xs text-emerald-200/90 leading-relaxed mb-3.5">
              画面オフでも端末を叩き起こして鳴る<strong>「ネイティブ大音量アラーム」</strong>と、
              全デザイン・MP3音源選択ロジックを同梱したAndroidアプリ一式です。
            </p>

            {/* Primary Download Button */}
            <button
              type="button"
              disabled={downloadState === 'downloading'}
              onClick={handleDownloadZip}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-70 transition shadow-md cursor-pointer border border-emerald-400/50"
            >
              {downloadState === 'downloading' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ファイルを安全に取得中... (2.2 MB)</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>【STEP 1】正常版ZIP（2.2 MB）をダウンロード</span>
                </>
              )}
            </button>

            {/* Status Messages */}
            {downloadState === 'success' && (
              <div className="bg-emerald-900/50 border border-emerald-500/50 rounded-xl p-2.5 mt-2.5 text-[11px] text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  ダウンロード完了！({downloadedSize || 2.2} MB 受信済）解凍して中身をご確認ください。
                </span>
              </div>
            )}

            {downloadState === 'error' && (
              <div className="bg-red-900/50 border border-red-500/50 rounded-xl p-2.5 mt-2.5 text-[11px] text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage || 'ダウンロードエラー'} 下記の「新しいタブで開く」をお試しください。</span>
              </div>
            )}

            {/* Alternative Direct Download Links */}
            <div className="mt-3 pt-3 border-t border-emerald-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[11px] text-emerald-300/80">
                枠内でダウンロードできない場合：
              </span>
              <div className="flex items-center gap-1.5">
                <a
                  href={directZipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-800/60 hover:bg-emerald-700/80 text-emerald-200 text-[11px] font-medium border border-emerald-600/40 inline-flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  新しいタブで直接開く
                </a>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-medium border border-gray-600/60 inline-flex items-center gap-1 cursor-pointer transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'URLコピー済' : 'URLをコピー'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-medium border border-gray-600/60 inline-flex items-center gap-1 cursor-pointer transition"
                >
                  <QrCode className="w-3 h-3 text-sky-400" />
                  {showQr ? 'QR非表示' : 'スマホ用QR'}
                </button>
              </div>
            </div>

            {/* Optional QR Code for Phone Direct Download */}
            {showQr && qrDataUrl && (
              <div className="mt-3 p-3 bg-white/10 rounded-xl border border-white/20 flex flex-col items-center justify-center gap-2">
                <p className="text-[11px] text-gray-300 text-center font-bold">
                  スマホのカメラでスキャンして直接ダウンロード
                </p>
                <img
                  src={qrDataUrl}
                  alt="ZIPダウンロード用QRコード"
                  className="w-36 h-36 rounded-lg bg-white p-2 shadow-md"
                />
              </div>
            )}
          </div>

          {/* What's inside the ZIP box */}
          <div className="bg-[#141a23] border border-gray-700/70 rounded-2xl p-3.5 text-xs">
            <h4 className="font-bold text-gray-200 text-xs flex items-center gap-1.5 mb-2">
              <FolderArchive className="w-4 h-4 text-emerald-400" />
              <span>解凍すると入っているもの（確認用）</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-300">
              <div className="bg-gray-800/60 p-2 rounded-xl border border-gray-700/60">
                <div className="font-bold text-emerald-300">📁 android/</div>
                <div className="text-gray-400 mt-0.5">
                  Android Studio / Gradle用ネイティブプロジェクト一式
                </div>
              </div>
              <div className="bg-gray-800/60 p-2 rounded-xl border border-gray-700/60">
                <div className="font-bold text-emerald-300">📁 .github/workflows/</div>
                <div className="text-gray-400 mt-0.5">
                  GitHub Actions用の自動APKビルド定義ファイル
                </div>
              </div>
              <div className="bg-gray-800/60 p-2 rounded-xl border border-gray-700/60">
                <div className="font-bold text-emerald-300">📁 src/ & public/</div>
                <div className="text-gray-400 mt-0.5">
                  リマインダー画面・アラーム設定の全Webソースコード
                </div>
              </div>
              <div className="bg-gray-800/60 p-2 rounded-xl border border-gray-700/60">
                <div className="font-bold text-emerald-300">📄 README-ANDROID-BUILD.md</div>
                <div className="text-gray-400 mt-0.5">
                  詳しいビルド・インストール手順解説書
                </div>
              </div>
            </div>
          </div>

          {/* Guide Section for Step 2 */}
          <div className="bg-[#141a23] border border-gray-700/70 rounded-2xl p-3.5">
            <div className="flex items-center justify-between border-b border-gray-700/60 pb-2 mb-3">
              <h4 className="font-bold text-gray-200 text-xs flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                <span>【STEP 2】解凍後の作業：APK（スマホ用アプリ）を作成する手順</span>
              </h4>
            </div>

            {/* Sub Tabs */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 text-xs">
              <button
                type="button"
                onClick={() => setActiveGuideTab('github')}
                className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeGuideTab === 'github'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub自動作成 (おすすめ)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('studio')}
                className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeGuideTab === 'studio'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>PC・Android Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('install')}
                className={`py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeGuideTab === 'install'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>スマホへインストール</span>
              </button>
            </div>

            {/* Tab 1: GitHub Actions (Easiest, automated, free) */}
            {activeGuideTab === 'github' && (
              <div className="space-y-2.5 text-xs text-gray-300">
                <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-2.5 text-sky-200 text-[11px] leading-relaxed">
                  💡 <strong>開発用ソフト不要！GitHubに解凍した中身を置くだけで自動生成されます</strong>
                  <br />
                  GitHubのクラウドマシンが約2分でビルドを実行し、完成した <code className="text-emerald-300">app-debug.apk</code> を渡してくれます。
                </div>

                <ol className="list-decimal list-inside space-y-2 text-gray-300 text-[11px] leading-relaxed">
                  <li>
                    ダウンロードした <code className="text-emerald-300">reminder-android-project.zip</code> を右クリックして <strong>「すべて展開（解凍）」</strong> します。
                  </li>
                  <li>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 underline font-bold inline-flex items-center gap-0.5"
                    >
                      GitHub (github.com)
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>
                    に無料ログイン（Googleアカウントですぐ連携可能）し、右上の「+」➔ <strong>「New repository」</strong> をクリック。
                  </li>
                  <li>
                    リポジトリ名（例: <code className="text-emerald-300">my-reminder-app</code>）を入れて「Create repository」を押す。
                  </li>
                  <li>
                    画面内の <strong>「uploading an existing file」</strong>（ファイルアップロード）をクリックし、解凍したフォルダの中身をすべてドラッグ＆ドロップして <strong>「Commit changes」</strong>。
                  </li>
                  <li>
                    画面上部の <strong>「Actions」タブ</strong> を開くと、ビルド（Build Android APK）が自動で走り始めます。
                  </li>
                  <li>
                    約2分で緑色のチェックマークが付き、クリックした先にある <strong>「reminder-app-debug-apk」</strong> をタップするとスマホ用APKが手に入ります！
                  </li>
                </ol>
              </div>
            )}

            {/* Tab 2: Android Studio */}
            {activeGuideTab === 'studio' && (
              <div className="space-y-2.5 text-xs text-gray-300">
                <p className="text-[11px] text-gray-400">
                  PCに Android Studio がインストールされている場合は、1分で直接ビルドできます。
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 text-[11px]">
                  <li>ダウンロードしたZIPを右クリックして解凍します。</li>
                  <li>Android Studioを起動し、<strong>「Open」</strong> から解凍フォルダの中にある <strong>「android」</strong> フォルダを開きます。</li>
                  <li>
                    上部メニューの <strong>Build</strong> ➔ <strong>Build Bundle(s) / APK(s)</strong> ➔ <strong>Build APK(s)</strong> をクリック。
                  </li>
                  <li>
                    完了すると画面右下に <strong>「locate」</strong> という青い文字が出るので、クリックすると完成した <code className="text-emerald-400">app-debug.apk</code> が表示されます！
                  </li>
                </ol>
              </div>
            )}

            {/* Tab 3: Install Guide */}
            {activeGuideTab === 'install' && (
              <div className="space-y-2.5 text-xs text-gray-300">
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-2.5 text-amber-200 text-[11px]">
                  ⚠️ <strong>Androidの通常セキュリティ確認について</strong>
                  <br />
                  Google Playストア外からの直接インストールの際、端末が「提供元不明のアプリの許可」を求めますが、自作アプリを直接入れる際の標準の確認です。「許可」を選択して進めてください。
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-300 text-[11px]">
                  <li>完成した <code className="text-emerald-400">app-debug.apk</code> をスマホに送信（Googleドライブ、LINE、メール、USB等）。</li>
                  <li>スマホの「ファイル」アプリでAPKをタップ。</li>
                  <li>「この提供元からのアプリを許可」にチェックを入れて <strong>「インストール」</strong> をタップ。</li>
                  <li>
                    ホーム画面に <strong>「リマインダー」</strong> アプリが追加されます！
                    <br />
                    （ブラウザ枠やURLバーが一切なく、画面オフでも時間通りに大音量アラームが発火します）
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#141a23] px-4 py-3 border-t border-gray-700/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-400">
            プロジェクトZIP検証済: 2.2 MB (Capacitor 6 + ネイティブアラーム収録)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
