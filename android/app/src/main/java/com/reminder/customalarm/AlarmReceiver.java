package com.reminder.customalarm;

import android.app.ActivityOptions;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.content.ContextCompat;
import java.lang.reflect.Method;
import java.util.Calendar;

/**
 * Legacy/Fallback Native BroadcastReceiver.
 * Primary scheduling launches AlarmActivity directly via AlarmManager.setAlarmClock().
 */
public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "AlarmReceiver triggered! Action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            Log.d(TAG, "Device rebooted; ignoring BOOT_COMPLETED phantom alarm trigger.");
            return;
        }

        // 0. Wake screen and CPU immediately
        try {
            android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                android.os.PowerManager.WakeLock wl = pm.newWakeLock(
                    android.os.PowerManager.FULL_WAKE_LOCK
                    | android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP
                    | android.os.PowerManager.ON_AFTER_RELEASE,
                    "reminder:ReceiverWakeLock"
                );
                wl.acquire(10 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire receiver wakelock", e);
        }

        // 1. Direct launch full-screen AlarmActivity with BAL options
        try {
            Intent fullScreenIntent = new Intent(context, AlarmActivity.class);
            if (intent.getExtras() != null) {
                fullScreenIntent.putExtras(intent.getExtras());
            }
            String title = intent.getStringExtra("TITLE");
            String memo = intent.getStringExtra("MEMO");
            String id = intent.getStringExtra("ID");
            boolean isPreNotice = id != null && id.contains("_notice_");
            fullScreenIntent.putExtra(AlarmActivity.EXTRA_TITLE, title != null ? title : "リマインダー");
            fullScreenIntent.putExtra(AlarmActivity.EXTRA_MEMO, memo != null ? memo : "");
            fullScreenIntent.putExtra(AlarmActivity.EXTRA_IS_PRE_NOTICE, isPreNotice);
            fullScreenIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            Bundle balBundle = createBackgroundAllowedOptionsBundle();
            if (balBundle != null) {
                context.startActivity(fullScreenIntent, balBundle);
            } else {
                context.startActivity(fullScreenIntent);
            }
            Log.d(TAG, "Directly launched AlarmActivity from AlarmReceiver!");
        } catch (Exception e) {
            Log.w(TAG, "Direct launch from AlarmReceiver caught exception", e);
        }

        // 2. Start foreground alarm service to ring sound & vibrate
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

        // 3. Automatically reschedule next occurrence for repeating alarms (e.g. 毎日, 毎週)
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
            Log.e(TAG, "Failed to check or reschedule repeating alarm", e);
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
            } else if (repeat != null && repeat.contains("日おき")) {
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
            int showRequestCode = (requestCode + 100000) & 0x7FFFFFFF;
            int immutableFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
            Bundle balBundle = createBackgroundAllowedOptionsBundle();

            Intent showIntent = new Intent(context, MainActivity.class);
            showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent showPendingIntent = PendingIntent.getActivity(
                context,
                showRequestCode,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag,
                balBundle
            );

            Intent alarmIntent = new Intent(context, AlarmActivity.class);
            alarmIntent.setAction("com.reminder.customalarm.ALARM_TRIGGER_" + id);
            if (originalIntent.getExtras() != null) {
                alarmIntent.putExtras(originalIntent.getExtras());
            }
            alarmIntent.putExtra("TIMESTAMP", nextTimestamp);
            alarmIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );

            PendingIntent alarmPendingIntent = PendingIntent.getActivity(
                context,
                requestCode,
                alarmIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag,
                balBundle
            );

            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(nextTimestamp, showPendingIntent);
            alarmManager.setAlarmClock(clockInfo, alarmPendingIntent);
            Log.d(TAG, "Successfully auto-rescheduled next repeating alarm for " + id + " at " + nextTimestamp);
        } catch (Exception e) {
            Log.e(TAG, "Failed to reschedule next repeating alarm", e);
        }
    }

    private Bundle createBackgroundAllowedOptionsBundle() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ActivityOptions options = ActivityOptions.makeBasic();
            options.setPendingIntentBackgroundActivityStartMode(
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            );
            if (Build.VERSION.SDK_INT >= 35) {
                try {
                    Method creatorMethod = ActivityOptions.class.getMethod(
                        "setPendingIntentCreatorBackgroundActivityStartMode", int.class
                    );
                    creatorMethod.invoke(options, ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
                } catch (Exception ignored) {}
            }
            return options.toBundle();
        }
        return null;
    }
}
