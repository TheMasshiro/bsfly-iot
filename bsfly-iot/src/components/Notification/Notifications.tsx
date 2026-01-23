import {
    IonBadge,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
    IonSegment,
    IonSegmentButton,
} from '@ionic/react';
import './Notifications.css';
import { FC, useMemo, useState } from 'react';
import { alertCircleOutline, checkmarkCircleOutline, fileTrayOutline, informationCircleOutline, listOutline, warningOutline } from 'ionicons/icons';

type Drawer = 'all' | 'drawer1' | 'drawer2' | 'drawer3';

interface Notification {
    id: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    drawer: 'drawer1' | 'drawer2' | 'drawer3';
}

const mockNotifications: Notification[] = [
    {
        id: '1',
        type: 'danger',
        title: 'Temperature Alert',
        message: 'Temperature exceeded maximum threshold (32°C)',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        read: false,
        drawer: 'drawer1'
    },
    {
        id: '2',
        type: 'warning',
        title: 'Humidity Warning',
        message: 'Humidity levels approaching warning limit (85%)',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        read: false,
        drawer: 'drawer2'
    },
    {
        id: '3',
        type: 'success',
        title: 'Environment Stable',
        message: 'All sensors within optimal range',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        read: true,
        drawer: 'drawer1'
    },
    {
        id: '4',
        type: 'info',
        title: 'Stage Changed',
        message: 'Growth stage updated to Pinning',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: true,
        drawer: 'drawer3'
    }
];

const Notifications: FC = () => {
    const [selectedDrawer, setSelectedDrawer] = useState<Drawer>('all');

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

    const filteredNotifications = useMemo(
        () => selectedDrawer === 'all'
            ? mockNotifications
            : mockNotifications.filter(n => n.drawer === selectedDrawer),
        [selectedDrawer]
    );

    const unreadCount = useMemo(
        () => filteredNotifications.filter(n => !n.read).length,
        [filteredNotifications]
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

                    <IonItem lines="none">
                        <IonSegment
                            value={selectedDrawer}
                            onIonChange={(e) => setSelectedDrawer(e.detail.value as Drawer)}
                            style={{ minWidth: "auto" }}
                        >
                            <IonSegmentButton value="all" style={{ minWidth: 40 }}>
                                <IonIcon icon={listOutline} size="small" />
                            </IonSegmentButton>
                            <IonSegmentButton value="drawer1" style={{ minWidth: 50 }}>
                                <IonIcon icon={fileTrayOutline} size="small" />
                                <IonLabel style={{ fontSize: 12 }}>1</IonLabel>
                            </IonSegmentButton>
                            <IonSegmentButton value="drawer2" style={{ minWidth: 50 }}>
                                <IonIcon icon={fileTrayOutline} size="small" />
                                <IonLabel style={{ fontSize: 12 }}>2</IonLabel>
                            </IonSegmentButton>
                            <IonSegmentButton value="drawer3" style={{ minWidth: 50 }}>
                                <IonIcon icon={fileTrayOutline} size="small" />
                                <IonLabel style={{ fontSize: 12 }}>3</IonLabel>
                            </IonSegmentButton>
                        </IonSegment>
                    </IonItem>
                </IonList>

                <IonList id="notification-list">
                    {filteredNotifications.length === 0 ? (
                        <IonItem lines="none">
                            <IonLabel className="ion-text-center" color="medium">
                                <p>No notifications</p>
                            </IonLabel>
                        </IonItem>
                    ) : (
                        filteredNotifications.map((notification) => (
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
                        ))
                    )}
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

export default Notifications;
