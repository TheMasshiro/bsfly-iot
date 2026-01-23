import {
    IonBadge,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
} from '@ionic/react';
import './Notifications.css';
import { FC, useMemo } from 'react';
import { alertCircleOutline, checkmarkCircleOutline, informationCircleOutline, warningOutline } from 'ionicons/icons';

interface Notification {
    id: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
}

const mockNotifications: Notification[] = [
    {
        id: '1',
        type: 'danger',
        title: 'Temperature Alert',
        message: 'Temperature exceeded maximum threshold (32°C)',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        read: false
    },
    {
        id: '2',
        type: 'warning',
        title: 'Humidity Warning',
        message: 'Humidity levels approaching warning limit (85%)',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        read: false
    },
    {
        id: '3',
        type: 'success',
        title: 'Environment Stable',
        message: 'All sensors within optimal range',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        read: true
    },
    {
        id: '4',
        type: 'info',
        title: 'Stage Changed',
        message: 'Growth stage updated to Pinning',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: true
    }
];

const Notifications: FC = () => {
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success':
                return checkmarkCircleOutline;
            case 'warning':
                return warningOutline;
            case 'danger':
                return alertCircleOutline;
            case 'info':
            default:
                return informationCircleOutline;
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'success':
                return 'success';
            case 'warning':
                return 'warning';
            case 'danger':
                return 'danger';
            case 'info':
            default:
                return 'primary';
        }
    };

    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const unreadCount = useMemo(
        () => mockNotifications.filter(n => !n.read).length,
        []
    );

    return (
        <IonMenu menuId="open-notifications" contentId="main" type="overlay" side="end">
            <IonContent>
                <IonList id="notification-header">
                    <IonItem lines="none" button={false}>
                        <IonLabel>
                            <h1>Notifications</h1>
                        </IonLabel>
                        {unreadCount > 0 && (
                            <IonBadge color="danger" slot="end">
                                {unreadCount} unread
                            </IonBadge>
                        )}
                    </IonItem>
                </IonList>

                <IonList id="notification-list">
                    {mockNotifications.map((notification) => (
                        <IonMenuToggle key={notification.id} autoHide={false}>
                            <IonItem
                                className={`notification-item ${!notification.read ? 'notification-unread' : ''}`}
                                lines="none"
                                detail={false}
                                button
                            >
                                <IonIcon
                                    aria-hidden="true"
                                    slot="start"
                                    icon={getNotificationIcon(notification.type)}
                                    color={getNotificationColor(notification.type)}
                                />
                                <IonLabel>
                                    <h2>{notification.title}</h2>
                                    <p>{notification.message}</p>
                                    <p className="notification-timestamp">
                                        {formatTimestamp(notification.timestamp)}
                                    </p>
                                </IonLabel>
                                {!notification.read && (
                                    <IonBadge color="primary" slot="end">
                                        •
                                    </IonBadge>
                                )}
                            </IonItem>
                        </IonMenuToggle>
                    ))}
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

export default Notifications;
