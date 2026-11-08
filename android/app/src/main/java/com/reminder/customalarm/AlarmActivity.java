package com.reminder.customalarm;

import android.app.Activity;
import android.app.KeyguardManager;
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

/**
 * ホーム画面やロック画面の上に直接強制起動する全面全画面Activity。
 */
public class AlarmActivity extends Activity {
    public static final String EXTRA_ID = "ID";
    public static final String EXTRA_TITLE = "TITLE";
    public static final String EXTRA_MEMO = "MEMO";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Android 10〜14での最前面強制割り込みフラグ設定
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            | WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        // 2. タイトルとメモの取得
        Intent intent = getIntent();
        String title = intent != null && intent.hasExtra(EXTRA_TITLE) ? intent.getStringExtra(EXTRA_TITLE) : "リマインダー";
        if (title == null || title.isEmpty()) title = "リマインダー";
        String memo = intent != null && intent.hasExtra(EXTRA_MEMO) ? intent.getStringExtra(EXTRA_MEMO) : "";

        // 3. 緑の全面表示ビューを直接生成してセット
        setContentView(createFullScreenView(title, memo));
    }

    private View createFullScreenView(String title, String memo) {
        int padH = dpToPx(24);
        int padV = dpToPx(36);

        LinearLayout root = new LinearLayout(this);
        root.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(padH, padV, padH, padV);

        // 落ち着いた薄緑（フォレストグリーン）のグラデーション背景
        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{Color.parseColor("#2e4a3e"), Color.parseColor("#243b32"), Color.parseColor("#1a2c25")}
        );
        root.setBackground(bg);

        // 上部バッジ
        LinearLayout pill = new LinearLayout(this);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER);
        int pillH = dpToPx(16);
        int pillV = dpToPx(8);
        pill.setPadding(pillH, pillV, pillH, pillV);
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(Color.parseColor("#446d5b"));
        pillBg.setCornerRadius(dpToPx(20));
        pillBg.setStroke(dpToPx(1), Color.parseColor("#68a187"));
        pill.setBackground(pillBg);

        TextView pillText = new TextView(this);
        pillText.setText("🔔 リマインダー通知");
        pillText.setTextColor(Color.parseColor("#e6fffa"));
        pillText.setTextSize(16);
        pillText.setTypeface(Typeface.DEFAULT_BOLD);
        pill.addView(pillText);

        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        pillParams.topMargin = dpToPx(16);
        root.addView(pill, pillParams);

        TextView sub = new TextView(this);
        sub.setText("時間になりました");
        sub.setTextColor(Color.parseColor("#b2f5ea"));
        sub.setTextSize(14);
        sub.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subParams.topMargin = dpToPx(10);
        root.addView(sub, subParams);

        // 中央：予定内容（スクロール対応）
        ScrollView scrollView = new ScrollView(this);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1.0f
        );
        scrollParams.setMargins(0, dpToPx(20), 0, dpToPx(20));
        scrollView.setLayoutParams(scrollParams);
        scrollView.setFillViewport(true);

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

        TextView label = new TextView(this);
        label.setText("【予定内容】");
        label.setTextColor(Color.parseColor("#68d391"));
        label.setTextSize(13);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(label);

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

        scrollView.addView(card);
        root.addView(scrollView);

        // 下部：横長・大型「停止」ボタン
        Button stopBtn = new Button(this);
        stopBtn.setText("停止");
        stopBtn.setTextColor(Color.WHITE);
        stopBtn.setTextSize(26);
        stopBtn.setTypeface(Typeface.DEFAULT_BOLD);

        GradientDrawable stopBg = new GradientDrawable();
        stopBg.setColor(Color.parseColor("#059669")); // エメラルドグリーン
        stopBg.setCornerRadius(dpToPx(18));
        stopBg.setStroke(dpToPx(2), Color.parseColor("#a7f3d0"));
        stopBtn.setBackground(stopBg);

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dpToPx(64)
        );
        btnParams.bottomMargin = dpToPx(12);
        stopBtn.setLayoutParams(btnParams);

        stopBtn.setOnClickListener(v -> {
            Intent stopIntent = new Intent(this, AlarmService.class);
            stopIntent.setAction(AlarmService.ACTION_STOP_ALARM);
            startService(stopIntent);
            finish();
        });
        root.addView(stopBtn);

        return root;
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
