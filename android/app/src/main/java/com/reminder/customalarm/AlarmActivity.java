package com.reminder.customalarm;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.util.Log;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

/**
 * Fullscreen Native Activity launched as a full-screen window when an alarm rings.
 * Shows directly over lockscreen with ZERO PIN bouncer veil.
 */
public class AlarmActivity extends AppCompatActivity {
    public static final String EXTRA_ID = "ID";
    public static final String EXTRA_TITLE = "TITLE";
    public static final String EXTRA_MEMO = "MEMO";
    public static final String EXTRA_TIME = "TARGET_TIME";
    public static final String EXTRA_IS_PRE_NOTICE = "IS_PRE_NOTICE";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn on screen, show directly over lockscreen without showing PIN bouncer veil
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        // Read intent extras
        Intent intent = getIntent();
        String title = intent != null && intent.hasExtra(EXTRA_TITLE) ? intent.getStringExtra(EXTRA_TITLE) : "リマインダー";
        if (title == null || title.isEmpty()) title = "リマインダー";
        String memo = intent != null && intent.hasExtra(EXTRA_MEMO) ? intent.getStringExtra(EXTRA_MEMO) : "";
        boolean isPreNotice = intent != null && intent.getBooleanExtra(EXTRA_IS_PRE_NOTICE, false);

        // Build View programmatically to guarantee 100% full-screen without XML inflate dependency
        View contentView = createFullScreenAlarmView(title, memo, isPreNotice);
        setContentView(contentView);

        // Start foreground AlarmService for loud sound & vibration
        try {
            Intent serviceIntent = new Intent(this, AlarmService.class);
            serviceIntent.setAction(AlarmService.ACTION_START_ALARM);
            if (intent != null && intent.getExtras() != null) {
                serviceIntent.putExtras(intent.getExtras());
            }
            ContextCompat.startForegroundService(this, serviceIntent);
        } catch (Exception e) {
            Log.e("AlarmActivity", "Failed to start AlarmService from AlarmActivity", e);
        }
    }

    private View createFullScreenAlarmView(String title, String memo, boolean isPreNotice) {
        int paddingHoriz = dpToPx(24);
        int paddingTop = dpToPx(36);
        int paddingBottom = dpToPx(28);

        // Root container: Calm forest green gradient
        LinearLayout root = new LinearLayout(this);
        root.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(paddingHoriz, paddingTop, paddingHoriz, paddingBottom);

        GradientDrawable backgroundGradient = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.parseColor("#2e4a3e"), Color.parseColor("#243b32"), Color.parseColor("#1a2c25")}
        );
        root.setBackground(backgroundGradient);

        // Top Header: "リマインダー通知" / "事前通知" pill
        LinearLayout headerPill = new LinearLayout(this);
        headerPill.setOrientation(LinearLayout.HORIZONTAL);
        headerPill.setGravity(Gravity.CENTER);
        int pillPadH = dpToPx(16);
        int pillPadV = dpToPx(8);
        headerPill.setPadding(pillPadH, pillPadV, pillPadH, pillPadV);

        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(Color.parseColor("#446d5b"));
        pillBg.setCornerRadius(dpToPx(20));
        pillBg.setStroke(dpToPx(1), Color.parseColor("#68a187"));
        headerPill.setBackground(pillBg);

        TextView headerText = new TextView(this);
        headerText.setText(isPreNotice ? "📢 事前通知" : "🔔 リマインダー通知");
        headerText.setTextColor(Color.parseColor("#e6fffa"));
        headerText.setTextSize(16);
        headerText.setTypeface(Typeface.DEFAULT_BOLD);
        headerPill.addView(headerText);

        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        pillParams.topMargin = dpToPx(8);
        root.addView(headerPill, pillParams);

        // Subheader status text
        TextView subHeader = new TextView(this);
        subHeader.setText(isPreNotice ? "まもなく予定の時刻です" : "時間になりました");
        subHeader.setTextColor(Color.parseColor("#b2f5ea"));
        subHeader.setTextSize(14);
        subHeader.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subParams.topMargin = dpToPx(8);
        root.addView(subHeader, subParams);

        // Center Content ScrollView
        ScrollView centerScroll = new ScrollView(this);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1.0f
        );
        scrollParams.setMargins(0, dpToPx(14), 0, dpToPx(16));
        centerScroll.setLayoutParams(scrollParams);
        centerScroll.setFillViewport(true);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER);
        int cardPad = dpToPx(24);
        card.setPadding(cardPad, cardPad, cardPad, cardPad);

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.parseColor("#1b2f27"));
        cardBg.setCornerRadius(dpToPx(24));
        cardBg.setStroke(dpToPx(1), Color.parseColor("#3b5c4e"));
        card.setBackground(cardBg);

        // Category label
        TextView label = new TextView(this);
        label.setText("【予定内容】");
        label.setTextColor(Color.parseColor("#68d391"));
        label.setTextSize(13);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(label);

        // Large title
        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(26);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dpToPx(12);
        card.addView(titleView, titleParams);

        // Memo if present
        if (memo != null && !memo.trim().isEmpty()) {
            View divider = new View(this);
            divider.setBackgroundColor(Color.parseColor("#2d4a3e"));
            LinearLayout.LayoutParams divParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(1)
            );
            divParams.setMargins(0, dpToPx(16), 0, dpToPx(12));
            card.addView(divider, divParams);

            TextView memoView = new TextView(this);
            memoView.setText(memo);
            memoView.setTextColor(Color.parseColor("#e2e8f0"));
            memoView.setTextSize(15);
            memoView.setLineSpacing(dpToPx(4), 1.0f);
            card.addView(memoView);
        }

        centerScroll.addView(card);
        root.addView(centerScroll);

        // Bottom Action Section: Giant Wide STOP button
        Button stopBtn = new Button(this);
        stopBtn.setText("停止");
        stopBtn.setTextColor(Color.WHITE);
        stopBtn.setTextSize(26);
        stopBtn.setTypeface(Typeface.DEFAULT_BOLD);

        GradientDrawable stopBg = new GradientDrawable();
        stopBg.setColor(Color.parseColor("#059669"));
        stopBg.setCornerRadius(dpToPx(18));
        stopBg.setStroke(dpToPx(2), Color.parseColor("#a7f3d0"));
        stopBtn.setBackground(stopBg);

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dpToPx(64)
        );
        btnParams.bottomMargin = dpToPx(12);
        stopBtn.setLayoutParams(btnParams);

        stopBtn.setOnClickListener(v -> stopAlarmAndFinish());
        root.addView(stopBtn);

        return root;
    }

    private void stopAlarmAndFinish() {
        Intent stopService = new Intent(this, AlarmService.class);
        stopService.setAction(AlarmService.ACTION_STOP_ALARM);
        startService(stopService);

        finish();
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
