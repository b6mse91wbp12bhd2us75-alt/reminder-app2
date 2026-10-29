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

public class AlarmService extends Service {
    private static final String TAG = "AlarmService";
    public static final String ACTION_START_ALARM = "com.reminder.customalarm.ACTION_START_ALARM";
    public static final String ACTION_STOP_ALARM = "com.reminder.customalarm.ACTION_STOP_ALARM";
    public static final String CHANNEL_ID = "reminder_native_alarm_channel_v1";
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
            int durationSec = intent.getIntExtra("DURATION", 15);
            if (durationSec <= 0) durationSec = 60;

            startAlarmWithNotification(title, memo, audioPath, durationSec);
            return START_STICKY;
        }

        return START_NOT_STICKY;
    }

    private void startAlarmWithNotification(String title, String memo, String audioPath, int durationSec) {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "reminder:AlarmWakeLock");
                wakeLock.acquire(10 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire wakelock", e);
        }

        Intent stopIntent = new Intent(this, AlarmService.class);
        stopIntent.setAction(ACTION_STOP_ALARM);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏰ " + title)
            .setContentText(memo)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "■ アラーム停止 (STOP)", stopPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false);

        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        playAudio(audioPath);

        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 800, 400, 800, 400, 800, 400};
                vibrator.vibrate(pattern, 1);
            }
        } catch (Exception e) {
            Log.w(TAG, "Vibration failed", e);
        }

        autoStopHandler = new Handler(Looper.getMainLooper());
        autoStopHandler.postDelayed(() -> {
            stopAlarm();
        }, durationSec * 1000L);
    }

    private void playAudio(String audioPath) {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
                mediaPlayer = null;
            }

            mediaPlayer = new MediaPlayer();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);

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
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "リマインダー大音量アラーム (ネイティブ)",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("アプリ終了時にも大音量で確実に鳴動する高優先度チャンネル");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            channel.setSound(null, null);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
