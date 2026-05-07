import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Initialize Android Notification Channels
 * Required for Android 8.0+ (API level 26+)
 */
export const initializeNotificationChannels = async () => {
  if (Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    // Critical alerts channel (high priority, sound + vibration)
    await LocalNotifications.createChannel({
      id: 'alerts_critical',
      name: 'Critical Alerts',
      description: 'Urgent parameter violations and system errors',
      importance: 5, // IMPORTANCE_MAX
      visibility: 1, // VISIBILITY_PUBLIC
      sound: 'alert_critical',
      vibration: true,
      lightColor: '#FF0000',
    });

    // General alerts channel (normal priority)
    await LocalNotifications.createChannel({
      id: 'alerts_general',
      name: 'General Alerts',
      description: 'Parameter warnings and informational messages',
      importance: 3, // IMPORTANCE_DEFAULT
      visibility: 0, // VISIBILITY_SECRET
      sound: 'alert_notice',
      vibration: false,
      lightColor: '#FFA500',
    });

    // Data updates channel (low priority, silent)
    await LocalNotifications.createChannel({
      id: 'updates_data',
      name: 'Data Updates',
      description: 'Hourly data sync and routine updates',
      importance: 2, // IMPORTANCE_LOW
      visibility: 0, // VISIBILITY_SECRET
      sound: '',
      vibration: false,
    });

    console.log('✓ Notification channels initialized');
  } catch (error) {
    console.error('Failed to initialize notification channels:', error);
  }
};
