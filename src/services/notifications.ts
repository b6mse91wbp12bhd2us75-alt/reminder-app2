import { Capacitor } from '@capacitor/core';

/**
 * Helper for browser system notifications and device vibration.
 * Disabled on native Capacitor Android because native AlarmActivity / AlarmService handle alarms directly without banner popups.
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    return false;
  }
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
};

export const sendSystemNotification = async (
  title: string,
  options?: NotificationOptions
) => {
  if (Capacitor.isNativePlatform()) {
    return;
  }

  // Trigger vibration if on mobile web browser
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([300, 150, 300, 150, 500]);
    } catch {}
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notificationOptions: NotificationOptions = {
    badge: '/pwa-192x192.png',
    icon: '/pwa-192x192.png',
    requireInteraction: true,
    ...options,
  };

  // 1. Try ServiceWorkerRegistration (Required on Android Chrome)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions);
        return;
      }
    } catch (e) {
      console.warn('ServiceWorker showNotification failed, trying fallback:', e);
    }
  }

  // 2. Fallback to standard window Notification (Desktop / Safari)
  try {
    new Notification(title, notificationOptions);
  } catch (err) {
    console.warn('System notification error:', err);
  }
};
