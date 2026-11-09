package com.reminder.customalarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.io.File;

/**
 * Native Android Foreground Service that plays loud alarm audio and vibrates.
 * Runs independently of the JavaScript / WebView environment.
 */
public class AlarmService extends Service {
    private static final String TAG = "AlarmService";
    public static final String ACTION_START_ALARM = "com.reminder.customalarm.ACTION_START_ALARM";
    public static final String ACTION_STOP_ALARM = "com.reminder.customalarm.ACTION_STOP_ALARM";
    // 古いキャッシュを完全に破棄するため新しいチャンネルIDに変更
    public static final String CHANNEL_ID = "reminder_silent_service_v4";
    private static final int NOTIFICATION_ID = 987654;

    private MediaPlayer mediaPlayer;
    private PowerManager.WakeLock wakeLock;
    private Vibrator vibrator;
    private Handler autoStopHandler;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP_ALARM.equals(action)) {
            stopAlarm();
            return START_NOT_STICKY;
        }

        if (ACTION_START_ALARM.equals(action)) {
            String title = intent.getStringExtra("TITLE");
            if (title == null || title.isEmpty()) title = "リマインダー";
            String memo = intent.getStringExtra("MEMO");
            if (memo == null) memo = "予定の時刻になりました。確認してください。";
            String audioPath = intent.getStringExtra("AUDIO_FILE");
            String soundName = intent.getStringExtra("SOUND_NAME");
            int durationSec = intent.getIntExtra("DURATION", 15);
            if (durationSec <= 0) durationSec = 60;
            int volume = intent.getIntExtra("VOLUME", 70);

            startAlarmWithNotification(title, memo, audioPath, soundName, durationSec, volume);
            return START_STICKY;
        }

        return START_NOT_STICKY;
    }

    private void startAlarmWithNotification(String title, String memo, String audioPath, String soundName, int durationSec, int volume) {
        // 1. Acquire Full WakeLock to illuminate screen
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "reminder:AlarmWakeLock"
                );
                wakeLock.acquire(10 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire wakelock", e);
        }

        // 2. Build Stop Intent
        Intent stopIntent = new Intent(this, AlarmService.class);
        stopIntent.setAction(ACTION_STOP_ALARM);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // 3. Build FullScreen Intent to launch AlarmActivity over lockscreen/homescreen
        Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
        fullScreenIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        fullScreenIntent.putExtra(AlarmActivity.EXTRA_MEMO, memo);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            1,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        int appIcon = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_lock_idle_alarm;

        // サイレント常駐通知（黒い小窓ヘッドアップは一切出さない）
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(appIcon)
            .setContentTitle(title)
            .setContentText("アラーム作動中")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setContentIntent(fullScreenPendingIntent)
            .setSilent(true)
            .setOngoing(true)
            .setAutoCancel(false);

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // 画面点灯状態時の直接起動
        try {
            startActivity(fullScreenIntent);
        } catch (Exception e) {
            Log.w(TAG, "Direct startActivity failed", e);
        }

        // 5. Play Audio using MediaPlayer on USAGE_ALARM stream with user volume
        playAudio(audioPath, soundName, volume);

        // 6. Vibrate
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 800, 400, 800, 400, 800, 400};
                vibrator.vibrate(pattern, 1);
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration failed", e);
        }

        // 7. Auto Stop timer
        autoStopHandler = new Handler(Looper.getMainLooper());
        autoStopHandler.postDelayed(() -> {
            Log.d(TAG, "Alarm auto-stopped after duration: " + durationSec + "s");
            stopAlarm();
        }, durationSec * 1000L);
    }

    private void playAudio(String audioPath, String soundName, int volume) {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
                mediaPlayer = null;
            }

            if (volume <= 0) {
                Log.d(TAG, "Volume is 0%. Skipping MediaPlayer.");
                return;
            }

            float volFloat = Math.max(0.01f, Math.min(1.0f, volume / 100.0f));

            mediaPlayer = new MediaPlayer();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            mediaPlayer.setVolume(volFloat, volFloat);

            boolean audioSet = false;

            // 1. 指定ファイルパスの確認
            if (audioPath != null && !audioPath.isEmpty()) {
                File customFile = new File(audioPath);
                if (customFile.exists() && customFile.length() > 0) {
                    mediaPlayer.setDataSource(customFile.getAbsolutePath());
                    audioSet = true;
                    Log.d(TAG, "Playing custom external audio from: " + customFile.getAbsolutePath());
                }
            }

            // 2. 内部ストレージに永続保存されたMP3の確認
            if (!audioSet && soundName != null && !soundName.isEmpty()) {
                String safeName = soundName.replaceAll("[^a-zA-Z0-9._-]", "_");
                File namedFile = new File(getFilesDir(), "custom_audio_" + safeName + ".mp3");
                if (namedFile.exists() && namedFile.length() > 0) {
                    mediaPlayer.setDataSource(namedFile.getAbsolutePath());
                    audioSet = true;
                    Log.d(TAG, "Playing permanent audio by soundName: " + namedFile.getAbsolutePath());
                }
            }

            // Fallback: raw/alarm_ring.wav
            if (!audioSet) {
                try {
                    int rawResId = getResources().getIdentifier("alarm_ring", "raw", getPackageName());
                    if (rawResId != 0) {
                        AssetFileDescriptor afd = getResources().openRawResourceFd(rawResId);
                        if (afd != null) {
                            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                            afd.close();
                            audioSet = true;
                        }
                    }
                } catch (Exception ignored) {}
            }

            // Fallback: system alarm ringtone
            if (!audioSet) {
                Uri defaultAlarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (defaultAlarmUri == null) {
                    defaultAlarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                mediaPlayer.setDataSource(this, defaultAlarmUri);
            }

            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to play alarm audio", e);
        }
    }

    private void stopAlarm() {
        if (autoStopHandler != null) {
            autoStopHandler.removeCallbacksAndMessages(null);
            autoStopHandler = null;
        }

        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {}
            mediaPlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception e) {}
            vibrator = null;
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception e) {}
            wakeLock = null;
        }

        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopAlarm();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                try {
                    manager.deleteNotificationChannel("reminder_native_alarm_channel_v1");
                    manager.deleteNotificationChannel("reminder_native_alarm_channel_v2");
                    manager.deleteNotificationChannel("reminder_fullscreen_alarm_channel_v3");
                    manager.deleteNotificationChannel("reminder_channel");
                } catch (Exception ignored) {}

                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "リマインダーバックグラウンド再生",
                    NotificationManager.IMPORTANCE_LOW
                );
                channel.setDescription("全面表示中のバックグラウンド音声再生用");
                channel.setLockscreenVisibility(Notification.VISIBILITY_SECRET);
                channel.enableVibration(false);
                channel.setShowBadge(false);
                channel.setSound(null, null);

                manager.createNotificationChannel(channel);
            }
        }
    }
}
