import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

export const useAndroidNotifications = () => {
  useEffect(() => {
    const initNotifications = async () => {
      try {
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== 'granted') {
          console.warn('Notification permissions not granted');
        }

        LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (notification) => {
            console.log('Notification clicked:', notification);
          }
        );

        App.addListener('pause', () => {

        });
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initNotifications();

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, []);

  /**
   * Trigger an Android native notification
   * @param title - Notification title
   * @param body - Notification message
   * @param type - Alert type: 'danger' (critical), 'warning' (caution), 'info' (informational)
   * @param drawer - Drawer identifier: 'drawer1' or 'drawer2'
   */
  const sendNativeNotification = async (
    title: string,
    body: string,
    type: 'danger' | 'warning' | 'info',
    drawer: 'drawer1' | 'drawer2'
  ) => {
    try {
      const soundUri = type === 'danger' ? 'res://raw/alert_critical' : 'res://raw/alert_notice';
      const smallIcon = 'icon_0';
      const largeIcon = type === 'danger' ? 'icon_danger' : 'icon_warning';

      const notificationId = parseInt(
        `${drawer === 'drawer1' ? '1' : '2'}${Date.now().toString().slice(-8)}`
      );

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title,
            body,
            smallIcon,
            largeIcon,
            sound: soundUri,
            channelId: type === 'danger' ? 'alerts_critical' : 'alerts_general',
            extra: {
              type,
              drawer,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      });
    } catch (error) {
    }
  };

  return { sendNativeNotification };
};
