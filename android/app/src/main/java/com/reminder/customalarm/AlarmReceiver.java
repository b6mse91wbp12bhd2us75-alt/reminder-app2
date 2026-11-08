package com.reminder.customalarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.content.ContextCompat;
import java.util.Calendar;

/**
 * Native BroadcastReceiver triggered by Android AlarmManager.setAlarmClock.
 * Immediately opens the full-screen green AlarmActivity over homescreen/lockscreen!
 */
public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Native Alarm Triggered! Action: " + intent.getAction());

        String title = intent.getStringExtra("TITLE");
        String memo = intent.getStringExtra("MEMO");

        // 1. ホーム画面やロック画面の上から、直接「緑の全面画面」を最前面にドカンと起動！
        try {
            Intent fullScreenIntent = new Intent(context, AlarmActivity.class);
            fullScreenIntent.putExtra(AlarmActivity.EXTRA_TITLE, title);
            fullScreenIntent.putExtra(AlarmActivity.EXTRA_MEMO, memo);
            fullScreenIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            context.startActivity(fullScreenIntent);
            Log.d(TAG, "Directly started AlarmActivity in full-screen over homescreen");
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch full-screen AlarmActivity directly", e);
        }

        // 2. 音とバイブを鳴らすサービスをバックグラウンド起動
        Intent serviceIntent = new Intent(context, AlarmService.class);
        serviceIntent.setAction(AlarmService.ACTION_START_ALARM);
        if (intent.getExtras() != null) {
            serviceIntent.putExtras(intent.getExtras());
        }

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start AlarmService", e);
        }

        // 3. リピート予定の次回自動再設定
        try {
            String id = intent.getStringExtra("ID");
            String repeat = intent.getStringExtra("REPEAT");
            long timestamp = intent.getLongExtra("TIMESTAMP", 0);

            if (id != null && !id.contains("_notice_") && repeat != null && !repeat.equals("なし") && timestamp > 0) {
                long nextTimestamp = calculateNextTimestamp(timestamp, repeat);
                if (nextTimestamp > System.currentTimeMillis()) {
                    rescheduleNextAlarm(context, intent, id, nextTimestamp, repeat);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to reschedule next repeating alarm", e);
        }
    }

    private long calculateNextTimestamp(long currentTimestamp, String repeat) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(currentTimestamp);
        long now = System.currentTimeMillis();

        int maxLoops = 500;
        while (maxLoops-- > 0) {
            if ("毎日".equals(repeat)) {
                cal.add(Calendar.DAY_OF_YEAR, 1);
            } else if ("毎週".equals(repeat)) {
                cal.add(Calendar.DAY_OF_YEAR, 7);
            } else if ("毎月".equals(repeat)) {
                cal.add(Calendar.MONTH, 1);
            } else if ("毎年".equals(repeat)) {
                cal.add(Calendar.YEAR, 1);
            } else if (repeat.contains("日おき")) {
                try {
                    int days = Integer.parseInt(repeat.replace("日おき", "").trim());
                    cal.add(Calendar.DAY_OF_YEAR, days > 0 ? days : 2);
                } catch (Exception e) {
                    cal.add(Calendar.DAY_OF_YEAR, 2);
                }
            } else {
                return 0;
            }

            if (cal.getTimeInMillis() > now) {
                return cal.getTimeInMillis();
            }
        }
        return cal.getTimeInMillis();
    }

    private void rescheduleNextAlarm(Context context, Intent originalIntent, String id, long nextTimestamp, String repeat) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            int requestCode = Math.abs(id.hashCode());

            Intent showIntent = new Intent(context, AlarmActivity.class);
            showIntent.putExtra(AlarmActivity.EXTRA_TITLE, originalIntent.getStringExtra("TITLE"));
            showIntent.putExtra(AlarmActivity.EXTRA_MEMO, originalIntent.getStringExtra("MEMO"));
            showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Intent alarmIntent = new Intent(context, AlarmReceiver.class);
            alarmIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
            if (originalIntent.getExtras() != null) {
                alarmIntent.putExtras(originalIntent.getExtras());
            }
            alarmIntent.putExtra("TIMESTAMP", nextTimestamp);

            PendingIntent alarmPendingIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(nextTimestamp, showPendingIntent);
            alarmManager.setAlarmClock(clockInfo, alarmPendingIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to reschedule", e);
        }
    }
}
