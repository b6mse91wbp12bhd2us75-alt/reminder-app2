# 📱 単体スマホアプリ（Android APK）作成ガイド

このプロジェクトは、Webブラウザの制限（URLバー、バックグラウンドでのアラーム停止）を受けず、
**「スマホの画面がオフでも・アプリを完全に閉じていても確実に鳴る」**
ネイティブAndroidアプリ化（Capacitor + Android LocalNotifications AlarmManager）に対応済みです。

---

## 🌟 一番簡単な方法：GitHub Actionsで自動作成（PC・スマホ両対応・無料）

1. **GitHub（https://github.com）に無料ログイン**（Googleアカウント等で1分で登録可能）
2. **新規リポジトリを作成**（名前は `my-reminder-app` など何でもOK、PublicまたはPrivateどちらでも可）
3. **このZIPファイルを解凍した全ファイルをGitHubにアップロード**（ブラウザからドラッグ＆ドロップでOK）
4. アップロード完了と同時に、自動的に **「Actions」** タブでAndroid APKの自動ビルドが始まります！
5. **約2〜3分後**に完了し、「reminder-app-debug-apk」をクリックするとスマホ用 `app-debug.apk` が直接ダウンロードできます！
6. ダウンロードしたAPKをスマホに送信（LINE、Googleドライブ、メール等）してタップすればインストール完了です。

---

## 💻 PCをお持ちの場合：Android Studioで1クリック作成

1. **Android Studio**（無料の公式開発ソフト）をPCで開きます。
2. **「Open」** を選択し、解凍したフォルダの中にある **`android`** フォルダを選択して開きます。
3. Android Studio上部のメニューから：
   `Build` ➔ `Build Bundle(s) / APK(s)` ➔ `Build APK(s)` をクリック！
4. 1〜2分で右下に **「APK(s) generated successfully - locate」** と表示されます。
5. 「locate」をクリックすると `app-debug.apk` が見つかるので、スマホに移してインストールしてください。

---

## 📲 スマホへのインストール手順

1. スマホで `app-debug.apk` をタップします。
2. 初回のみ「この提供元からのアプリを許可」の確認が出たら **「許可」** を選択します。
3. **「インストール」** をタップすると、ホーム画面に本物のアプリとして追加されます！
4. ブラウザ枠やURLバーが一切なく、画面オフでも大音量でアラームと事前通知が鳴動します。
