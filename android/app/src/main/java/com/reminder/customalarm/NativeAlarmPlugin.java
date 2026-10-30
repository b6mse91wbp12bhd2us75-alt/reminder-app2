package com.reminder.customalarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
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
 * and native file saving for custom MP3 external audio files.
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

        if (id == null || timestamp == null) {
            call.reject("id and timestamp are required");
            return;
        }

        try {
            String audioPath = executeScheduleAlarm(id, title, memo, timestamp, audioBase64, duration != null ? duration : 15);
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
    public void testAlarmNow(PluginCall call) {
        int delaySeconds = call.getInt("delaySeconds", 10);
        String title = call.getString("title", "【テスト成功】大音量アラーム");
        String memo = call.getString("memo", "アプリを完全に閉じた状態での発火テストに成功しました！");
        String audioBase64 = call.getString("audioBase64");

        long targetTime = System.currentTimeMillis() + (delaySeconds * 1000L);

        try {
            executeScheduleAlarm("quick_test_alarm", title, memo, targetTime, audioBase64, 15);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed test alarm", e);
            call.reject("Failed test alarm: " + e.getMessage());
        }
    }

    private String executeScheduleAlarm(String id, String title, String memo, long timestamp, String audioBase64, int duration) throws Exception {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            throw new IllegalStateException("AlarmManager not available");
        }

        String audioFilePath = null;
        if (audioBase64 != null && !audioBase64.isEmpty()) {
            audioFilePath = saveBase64ToFile(context, id, audioBase64);
        }

        int requestCode = Math.abs(id.hashCode());

        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
        alarmIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        alarmIntent.putExtra("ID", id);
        alarmIntent.putExtra("TITLE", title);
        alarmIntent.putExtra("MEMO", memo);
        alarmIntent.putExtra("AUDIO_FILE", audioFilePath);
        alarmIntent.putExtra("DURATION", duration);

        PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(timestamp, showPendingIntent);
        alarmManager.setAlarmClock(clockInfo, alarmPendingIntent);
        Log.d(TAG, "Scheduled native AlarmClock for ID: " + id + " at: " + timestamp);

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
