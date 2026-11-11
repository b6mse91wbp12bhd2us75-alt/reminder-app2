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

            String cleanBase64 = audioBase64;
            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex != -1) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            // 1. safeNameで保存
            File destSafe = new File(audioDir, "custom_audio_" + safeName + ".mp3");
            FileOutputStream fos1 = new FileOutputStream(destSafe);
            fos1.write(decodedBytes);
            fos1.flush();
            fos1.close();

            // 2. 原音源名で保存
            File destRaw = new File(audioDir, "custom_audio_" + name + ".mp3");
            FileOutputStream fos2 = new FileOutputStream(destRaw);
            fos2.write(decodedBytes);
            fos2.flush();
            fos2.close();

            // 3. ハッシュ名で保存
            File destHash = new File(audioDir, "custom_sound_" + Math.abs(name.hashCode()) + ".mp3");
            FileOutputStream fos3 = new FileOutputStream(destHash);
            fos3.write(decodedBytes);
            fos3.flush();
            fos3.close();

            Log.d(TAG, "Permanently saved custom audio file: " + destSafe.getAbsolutePath());
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("filePath", destSafe.getAbsolutePath());
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

        Intent alarmActivityIntent = new Intent(context, AlarmActivity.class);
        alarmActivityIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        PendingIntent piActivity = PendingIntent.getActivity(
            context,
            requestCode,
            alarmActivityIntent,
            PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent alarmBroadcastIntent = new Intent(context, AlarmReceiver.class);
        alarmBroadcastIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        PendingIntent piBroadcast = PendingIntent.getBroadcast(
            context,
            requestCode,
            alarmBroadcastIntent,
            PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        if (alarmManager != null) {
            if (piActivity != null) {
                alarmManager.cancel(piActivity);
                piActivity.cancel();
            }
            if (piBroadcast != null) {
                alarmManager.cancel(piBroadcast);
                piBroadcast.cancel();
            }
        }

        // 注意: リピート予定や再設定時の音源消失を防ぐため、custom_alarm_<id>.mp3 は削除しません
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

        // 1. Base64データが渡された場合はファイル保存
        if (audioBase64 != null && !audioBase64.isEmpty()) {
            audioFilePath = saveBase64ToFile(context, id, safeName, soundName, audioBase64);
        } else {
            // 2. Base64が無い場合（リピートや再読み込み後など）は、すでに端末内に保存されているファイルを探索
            File idFile = new File(context.getFilesDir(), "custom_alarm_" + id + ".mp3");
            if (idFile.exists() && idFile.length() > 0) {
                audioFilePath = idFile.getAbsolutePath();
            } else if (soundName != null && !soundName.isEmpty()) {
                File namedFile = new File(context.getFilesDir(), "custom_audio_" + soundName + ".mp3");
                if (!namedFile.exists() || namedFile.length() == 0) {
                    namedFile = new File(context.getFilesDir(), "custom_audio_" + safeName + ".mp3");
                }
                if (!namedFile.exists() || namedFile.length() == 0) {
                    namedFile = new File(context.getFilesDir(), "custom_sound_" + Math.abs(soundName.hashCode()) + ".mp3");
                }
                if (namedFile.exists() && namedFile.length() > 0) {
                    audioFilePath = namedFile.getAbsolutePath();
                    Log.d(TAG, "Reusing existing persistent audio file for " + soundName + ": " + audioFilePath);
                }
            }
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

        // AlarmActivity を直接起動する PendingIntent.getActivity を作成
        Intent alarmActivityIntent = new Intent(context, AlarmActivity.class);
        alarmActivityIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
        alarmActivityIntent.putExtra("ID", id);
        alarmActivityIntent.putExtra("TITLE", title);
        alarmActivityIntent.putExtra("MEMO", memo);
        alarmActivityIntent.putExtra("TIMESTAMP", timestamp);
        alarmActivityIntent.putExtra("REPEAT", repeat);
        alarmActivityIntent.putExtra("SOUND_NAME", soundName);
        alarmActivityIntent.putExtra("AUDIO_FILE", audioFilePath);
        alarmActivityIntent.putExtra("DURATION", duration);
        alarmActivityIntent.putExtra("VOLUME", volume);
        alarmActivityIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
            | Intent.FLAG_ACTIVITY_CLEAR_TOP
            | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        PendingIntent alarmPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            alarmActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // setAlarmClock によりOS自身が全画面Activityを起動（重ねて表示権限は完全に不要）
        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(timestamp, showPendingIntent);
        alarmManager.setAlarmClock(clockInfo, alarmPendingIntent);
        Log.d(TAG, "Scheduled direct native AlarmClock Activity for ID: " + id + " at: " + timestamp + " with audio: " + audioFilePath);

        return audioFilePath;
    }

    private String saveBase64ToFile(Context context, String id, String safeName, String soundName, String base64Data) {
        try {
            String cleanBase64 = base64Data;
            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex != -1) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            File audioDir = context.getFilesDir();

            // 1. 予定ID固有のファイル（リピート時も維持）
            File idFile = new File(audioDir, "custom_alarm_" + id + ".mp3");
            FileOutputStream fosId = new FileOutputStream(idFile);
            fosId.write(decodedBytes);
            fosId.flush();
            fosId.close();

            // 2. 音源名ごとの永続ファイル
            if (soundName != null && !soundName.isEmpty()) {
                File rawNamedFile = new File(audioDir, "custom_audio_" + soundName + ".mp3");
                FileOutputStream fosRaw = new FileOutputStream(rawNamedFile);
                fosRaw.write(decodedBytes);
                fosRaw.flush();
                fosRaw.close();

                File hashFile = new File(audioDir, "custom_sound_" + Math.abs(soundName.hashCode()) + ".mp3");
                FileOutputStream fosHash = new FileOutputStream(hashFile);
                fosHash.write(decodedBytes);
                fosHash.flush();
                fosHash.close();
            }

            if (safeName != null && !safeName.isEmpty()) {
                File safeNamedFile = new File(audioDir, "custom_audio_" + safeName + ".mp3");
                FileOutputStream fosSafe = new FileOutputStream(safeNamedFile);
                fosSafe.write(decodedBytes);
                fosSafe.flush();
                fosSafe.close();
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
