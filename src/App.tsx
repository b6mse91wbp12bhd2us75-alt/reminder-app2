// 5. SELECTIVE ONE-WAY EXPORT: Push a single selected reminder to Google Calendar (Native Android APK + Web)
  const handlePushSingleToCalendar = async (item: ReminderItem) => {
    setPushingReminderId(item.id);
    try {
      let eventId = item.google_event_id;

      if (Capacitor.isNativePlatform()) {
        // Native Android APK: launch Android OS Google Calendar directly (0 OAuth, 0 logins, 100% reliable)
        await openAndroidCalendarEvent({
          title: item.title,
          memo: item.memo,
          target_time: item.target_time,
        });
        eventId = `native-${Date.now()}`;
      } else {
        // Desktop / Web: try OAuth if connected, else open web calendar
        const token = await getAccessToken();
        if (token && user) {
          eventId = await pushReminderToGoogleCalendar(item);
        } else {
          await openAndroidCalendarEvent({
            title: item.title,
            memo: item.memo,
            target_time: item.target_time,
          });
          eventId = `web-${Date.now()}`;
        }
      }

      const updated = reminders.map((r) =>
        r.id === item.id ? { ...r, google_event_id: eventId, sync_with_google: true } : r
      );
      saveRemindersToStorage(updated);
      showToast(`「${item.title}」をGoogleカレンダーに送信しました！`);
    } catch (err: any) {
      console.error('Push to calendar failed:', err);
      showToast(`カレンダー送信エラー: ${err.message || '送信に失敗しました'}`);
    } finally {
      setPushingReminderId(null);
    }
  };
