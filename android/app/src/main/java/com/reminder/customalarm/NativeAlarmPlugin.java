package com.reminder.customalarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/**
 * Custom Capacitor plugin exposing Android's AlarmManager.setAlarmClock
 * and persistent internal storage file management for custom external MP3 audio.
 */
@CapacitorPlugin(name = "NativeAlarm")
public class NativeAlarmPlugin extends Plugin {
    private static final String TAG = "NativeAlarmPlugin";

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title", "リマインダー");
        String memo = call.getString("memo", "");
        Long timestamp = call.getLong("timestamp");
        String audioBase64 = call.getString("audioBase64");
        Integer duration = call.getInt("duration", 15);
        Integer volume = call.getInt("volume", 70);
        String repeat = call.getString("repeat", "なし");
        String soundName = call.getString("soundName", "");

        if (id == null || timestamp == null) {
            call.reject("id and timestamp are required");
            return;
        }

        try {
            String audioPath = executeScheduleAlarm(id, title, memo, timestamp, audioBase64, duration != null ? duration : 15, volume != null ? volume : 70, repeat, soundName);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("audioPath", audioPath);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule alarm", e);
            call.reject("Failed to schedule alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveAudioFile(PluginCall call) {
        String name = call.getString("name");
        String audioBase64 = call.getString("audioBase64");
        if (name == null || audioBase64 == null || audioBase64.isEmpty()) {
            call.reject("name and audioBase64 are required");
            return;
        }

        try {
            Context context = getContext();
            String safeName = sanitizeFileName(name);
            File audioDir = context.getFilesDir();
            File destFile = new File(audioDir, "custom_audio_" + safeName + ".mp3");

            String cleanBase64 = audioBase64;
            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex != -1) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            FileOutputStream fos = new FileOutputStream(destFile);
            fos.write(decodedBytes);
            fos.flush();
            fos.close();

            Log.d(TAG, "Permanently saved custom audio file: " + destFile.getAbsolutePath());
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filePath", destFile.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to permanently save audio file", e);
            call.reject("Failed to save audio file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        int requestCode = Math.abs(id.hashCode());

        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
        alarmIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        if (alarmManager != null && pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }

        try {
            File audioFile = new File(context.getFilesDir(), "custom_alarm_" + id + ".mp3");
            if (audioFile.exists()) {
                audioFile.delete();
            }
        } catch (Exception ignored) {}

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopAlarm(PluginCall call) {
        Context context = getContext();
        Intent stopIntent = new Intent(context, AlarmService.class);
        stopIntent.setAction(AlarmService.ACTION_STOP_ALARM);
        context.startService(stopIntent);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openCalendarEvent(PluginCall call) {
        String title = call.getString("title", "リマインダー");
        String memo = call.getString("memo", "");
        Long startTime = call.getLong("startTime");
        Long endTime = call.getLong("endTime");

        try {
            Context context = getContext();
            Intent intent = new Intent(Intent.ACTION_INSERT);
            intent.setData(android.provider.CalendarContract.Events.CONTENT_URI);
            if (title != null) intent.putExtra(android.provider.CalendarContract.Events.TITLE, title);
            if (memo != null) intent.putExtra(android.provider.CalendarContract.Events.DESCRIPTION, memo);
            if (startTime != null && startTime > 0) {
                intent.putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME, startTime);
            }
            if (endTime != null && endTime > 0) {
                intent.putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME, endTime);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to open native calendar", e);
            call.reject("カレンダーの起動に失敗しました: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        boolean canDraw = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            canDraw = Settings.canDrawOverlays(getContext());
        }
        JSObject ret = new JSObject();
        ret.put("granted", canDraw);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context context = getContext();
            if (!Settings.canDrawOverlays(context)) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void testAlarmNow(PluginCall call) {
        int delaySeconds = call.getInt("delaySeconds", 10);
        String title = call.getString("title", "【テスト成功】大音量アラーム");
        String memo = call.getString("memo", "アプリを完全に閉じた状態での発火テストに成功しました！");
        String audioBase64 = call.getString("audioBase64");
        Integer volume = call.getInt("volume", 70);
        String soundName = call.getString("soundName", "テスト音源");

        long targetTime = System.currentTimeMillis() + (delaySeconds * 1000L);

        try {
            executeScheduleAlarm("quick_test_alarm", title, memo, targetTime, audioBase64, 15, volume != null ? volume : 70, "なし", soundName);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed test alarm", e);
            call.reject("Failed test alarm: " + e.getMessage());
        }
    }

    private String executeScheduleAlarm(String id, String title, String memo, long timestamp, String audioBase64, int duration, int volume, String repeat, String soundName) throws Exception {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            throw new IllegalStateException("AlarmManager not available");
        }

        String audioFilePath = null;
        String safeName = sanitizeFileName(soundName);

        // 1. If base64 provided, save it both for this alarm ID and as a permanent named sound file
        if (audioBase64 != null && !audioBase64.isEmpty()) {
            audioFilePath = saveBase64ToFile(context, id, safeName, audioBase64);
        } else if (!safeName.isEmpty()) {
            // 2. Base64 omitted, but check if persistent sound file exists on disk
            File namedFile = new File(context.getFilesDir(), "custom_audio_" + safeName + ".mp3");
            if (namedFile.exists() && namedFile.length() > 0) {
                audioFilePath = namedFile.getAbsolutePath();
                Log.d(TAG, "Using existing persistent audio file for " + soundName + ": " + audioFilePath);
            }
        }

        int requestCode = Math.abs(id.hashCode());

        // 1. Show Intent
        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // 2. Alarm Intent sent to AlarmReceiver
        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
        alarmIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        alarmIntent.putExtra("ID", id);
        alarmIntent.putExtra("TITLE", title);
        alarmIntent.putExtra("MEMO", memo);
        alarmIntent.putExtra("TIMESTAMP", timestamp);
        alarmIntent.putExtra("REPEAT", repeat);
        alarmIntent.putExtra("SOUND_NAME", soundName);
        alarmIntent.putExtra("AUDIO_FILE", audioFilePath);
        alarmIntent.putExtra("DURATION", duration);
        alarmIntent.putExtra("VOLUME", volume);

        PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(timestamp, showPendingIntent);
        alarmManager.setAlarmClock(clockInfo, alarmPendingIntent);
        Log.d(TAG, "Scheduled native AlarmClock for ID: " + id + " at: " + timestamp + " with audio: " + audioFilePath);

        return audioFilePath;
    }

    private String saveBase64ToFile(Context context, String id, String safeName, String base64Data) {
        try {
            String cleanBase64 = base64Data;
            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex != -1) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            File audioDir = context.getFilesDir();

            // Save alarm-specific file
            File idFile = new File(audioDir, "custom_alarm_" + id + ".mp3");
            FileOutputStream fosId = new FileOutputStream(idFile);
            fosId.write(decodedBytes);
            fosId.flush();
            fosId.close();

            // If soundName is provided, also save persistent named file that survives updates
            if (safeName != null && !safeName.isEmpty()) {
                File namedFile = new File(audioDir, "custom_audio_" + safeName + ".mp3");
                FileOutputStream fosNamed = new FileOutputStream(namedFile);
                fosNamed.write(decodedBytes);
                fosNamed.flush();
                fosNamed.close();
                Log.d(TAG, "Saved permanent named audio: " + namedFile.getAbsolutePath());
            }

            Log.d(TAG, "Saved custom audio file to: " + idFile.getAbsolutePath());
            return idFile.getAbsolutePath();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save base64 audio to file", e);
            return null;
        }
    }

    private String sanitizeFileName(String name) {
        if (name == null) return "";
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
