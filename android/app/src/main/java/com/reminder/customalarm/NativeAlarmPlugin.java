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
 * Directly launches AlarmActivity fullscreen without intermediate heads-up banner.
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

        if (id == null || timestamp == null) {
            call.reject("id and timestamp are required");
            return;
        }

        try {
            String audioPath = executeScheduleAlarm(id, title, memo, timestamp, audioBase64, duration != null ? duration : 15, volume != null ? volume : 70, repeat);
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
    public void cancelAlarm(PluginCall call) {
        String id = call.getString("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        int requestCode = Math.abs(id.hashCode());

        Intent alarmIntent = new Intent(context, AlarmActivity.class);
        alarmIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        if (alarmManager != null && pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }

        // Delete associated audio file if exists
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

        long targetTime = System.currentTimeMillis() + (delaySeconds * 1000L);

        try {
            executeScheduleAlarm("quick_test_alarm", title, memo, targetTime, audioBase64, 15, volume != null ? volume : 70, "なし");
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed test alarm", e);
            call.reject("Failed test alarm: " + e.getMessage());
        }
    }

    private String executeScheduleAlarm(String id, String title, String memo, long timestamp, String audioBase64, int duration, int volume, String repeat) throws Exception {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            throw new IllegalStateException("AlarmManager not available");
        }

        // Save custom audio file if provided
        String audioFilePath = null;
        if (audioBase64 != null && !audioBase64.isEmpty()) {
            audioFilePath = saveBase64ToFile(context, id, audioBase64);
        }

        int requestCode = Math.abs(id.hashCode());

        // Direct full-screen AlarmActivity intent launched by Android AlarmManager
        Intent alarmActivityIntent = new Intent(context, AlarmActivity.class);
        alarmActivityIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        alarmActivityIntent.putExtra(AlarmActivity.EXTRA_ID, id);
        alarmActivityIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
        alarmActivityIntent.putExtra(AlarmActivity.EXTRA_MEMO, memo);
        alarmActivityIntent.putExtra(AlarmActivity.EXTRA_TIME, timestamp);
        alarmActivityIntent.putExtra(AlarmActivity.EXTRA_IS_PRE_NOTICE, id != null && id.contains("_notice_"));
        alarmActivityIntent.putExtra("REPEAT", repeat);
        alarmActivityIntent.putExtra("AUDIO_FILE", audioFilePath);
        alarmActivityIntent.putExtra("DURATION", duration);
        alarmActivityIntent.putExtra("VOLUME", volume);
        alarmActivityIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        PendingIntent alarmActivityPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            alarmActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Schedule via setAlarmClock (Directly pops up AlarmActivity full-screen without heads-up banner)
        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(timestamp, alarmActivityPendingIntent);
        alarmManager.setAlarmClock(clockInfo, alarmActivityPendingIntent);
        Log.d(TAG, "Scheduled native direct AlarmClock for ID: " + id + " at: " + timestamp);

        return audioFilePath;
    }

    private String saveBase64ToFile(Context context, String id, String base64Data) {
        try {
            String cleanBase64 = base64Data;
            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex != -1) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            File audioDir = context.getFilesDir();
            File destFile = new File(audioDir, "custom_alarm_" + id + ".mp3");

            FileOutputStream fos = new FileOutputStream(destFile);
            fos.write(decodedBytes);
            fos.flush();
            fos.close();

            Log.d(TAG, "Saved custom audio file to: " + destFile.getAbsolutePath());
            return destFile.getAbsolutePath();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save base64 audio to file", e);
            return null;
        }
    }
}
