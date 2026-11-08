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
 * Native Android Alarm Service.
 * Correctly launches AlarmActivity as a true FullScreenIntent on Android 10〜14.
 */
public class AlarmService extends Service {
    private static final String TAG = "AlarmService";
    public static final String ACTION_START_ALARM = "com.reminder.customalarm.ACTION_START_ALARM";
    public static final String ACTION_STOP_ALARM = "com.reminder.customalarm.ACTION_STOP_ALARM";
    public static final String CHANNEL_ID = "reminder_fullscreen_alarm_channel_v4";
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
            if (memo == null) memo = "";
            String audioPath = intent.getStringExtra("AUDIO_FILE");
            int durationSec = intent.getIntExtra("DURATION", 15);
            if (durationSec <= 0) durationSec = 60;
            int volume = intent.getIntExtra("VOLUME", 70);

            startAlarmFullScreen(title, memo, audioPath, durationSec, volume);
            return START_STICKY;
        }

        return START_NOT_STICKY;
    }

    private void startAlarmFullScreen(String title, String memo, String audioPath, int durationSec, int volume) {
        // 1. 画面を即時点灯（WAKE_LOCK）
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "reminder:FullScreenWakeLock"
                );
                wakeLock.acquire(10 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire wakelock", e);
        }

        // 2. 全面表示用のアクティビティIntent
        Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
        fullScreenIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        fullScreenIntent.putExtra(AlarmActivity.EXTRA_MEMO, memo);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            1,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // ホーム画面から直接全画面を起動
        try {
            startActivity(fullScreenIntent);
        } catch (Exception e) {
            Log.e(TAG, "startActivity failed, fallback to fullScreenIntent", e);
        }

        int appIcon = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_lock_idle_alarm;

        // 3. 全画面起動を保証するフルスクリーン通知
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(appIcon)
            .setContentTitle(title)
            .setContentText("アラーム鳴動中")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false);

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // 4. 音声再生
        playAudio(audioPath, volume);

        // 5. バイブレーション
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 800, 400, 800, 400, 800, 400};
                vibrator.vibrate(pattern, 1);
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration failed", e);
        }

        // 6. 自動停止タイマー
        autoStopHandler = new Handler(Looper.getMainLooper());
        autoStopHandler.postDelayed(() -> {
            stopAlarm();
        }, durationSec * 1000L);
    }

    private void playAudio(String audioPath, int volume) {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
                mediaPlayer = null;
            }

            if (volume <= 0) return;

            float volFloat = Math.max(0.01f, Math.min(1.0f, volume / 100.0f));

            mediaPlayer = new MediaPlayer();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            mediaPlayer.setVolume(volFloat, volFloat);

            boolean audioSet = false;

            if (audioPath != null && !audioPath.isEmpty()) {
                File customFile = new File(audioPath);
                if (customFile.exists() && customFile.length() > 0) {
                    mediaPlayer.setDataSource(customFile.getAbsolutePath());
                    audioSet = true;
                }
            }

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
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {}
            vibrator = null;
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
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
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "リマインダー全面アラーム",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("全面表示を直接起動するチャンネル");
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.enableVibration(true);
                channel.setSound(null, null);

                manager.createNotificationChannel(channel);
            }
        }
    }
}
