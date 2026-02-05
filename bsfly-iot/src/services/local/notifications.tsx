import { LocalNotifications, LocalNotificationSchema, ScheduleResult } from '@capacitor/local-notifications';

export interface NotificationOptions {
    title: string;
    body: string;
    id?: number;
    schedule?: Date;
}

class NotificationService {
    private notificationId: number = 1;

    async requestPermissions(): Promise<boolean> {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
    }

    async schedule(options: NotificationOptions): Promise<ScheduleResult | null> {
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                return null;
            }

            const notification: LocalNotificationSchema = {
                title: options.title,
                body: options.body,
                id: options.id ?? this.notificationId++,
                schedule: options.schedule
                    ? { at: options.schedule }
                    : { at: new Date(Date.now() + 1000) },
            };

            const result = await LocalNotifications.schedule({
                notifications: [notification],
            });

            return result;
        } catch {
            return null;
        }
    }

    async scheduleImmediate(title: string, body: string): Promise<ScheduleResult | null> {
        return this.schedule({ title, body });
    }

    async scheduleDelayed(title: string, body: string, delayMs: number): Promise<ScheduleResult | null> {
        return this.schedule({
            title,
            body,
            schedule: new Date(Date.now() + delayMs),
        });
    }

    async cancelAll(): Promise<void> {
        try {
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel({
                    notifications: pending.notifications.map(n => ({ id: n.id })),
                });
            }
        } catch {
        }
    }

    async cancelById(id: number): Promise<void> {
        try {
            await LocalNotifications.cancel({
                notifications: [{ id }],
            });
        } catch {
        }
    }

    async getPending(): Promise<LocalNotificationSchema[]> {
        try {
            const result = await LocalNotifications.getPending();
            return result.notifications;
        } catch {
            return [];
        }
    }
}

export const notificationService = new NotificationService();

export const scheduleNotification = async () => {
    return notificationService.scheduleImmediate('BSFly IoT', 'Notification');
};
