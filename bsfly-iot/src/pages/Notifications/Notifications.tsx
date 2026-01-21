import { IonBadge, IonCard, IonCardContent, IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage, IonRow, IonText, IonTitle, IonToolbar } from '@ionic/react';
import './Notifications.css';
import { FC, useMemo } from 'react';
import Toolbar from '../../components/Toolbar/Toolbar';
import { alertCircleOutline, checkmarkCircleOutline, informationCircleOutline, warningOutline } from 'ionicons/icons';
import { useLifeCycle } from '../../context/LifeCycleContext';
import Segments from '../../components/Segments/Segments';

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
    const { stage, setStage } = useLifeCycle();

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
        <IonPage className="notifications-page">
            <IonHeader>
                <Toolbar header="Notifications" />
            </IonHeader>

            <IonContent fullscreen>
                <IonHeader collapse="condense">
                    <IonToolbar>
                        <IonTitle size="large">Notifications</IonTitle>
                    </IonToolbar>
                </IonHeader>

                <IonGrid>
                    <IonRow className="ion-justify-content-center ion-align-items-center">
                        <IonCol>
                            <IonCard className="notification-header-card">
                                <IonCardContent>
                                    <div className="notification-header">
                                        <IonText>
                                            <h2>Current {stage}</h2>
                                        </IonText>
                                        {unreadCount > 0 && (
                                            <IonBadge color="danger" className="unread-badge">
                                                {unreadCount} unread
                                            </IonBadge>
                                        )}
                                    </div>
                                </IonCardContent>
                            </IonCard>
                        </IonCol>
                    </IonRow>

                    <IonRow>
                        <IonCol>
                            <IonList inset>
                                {mockNotifications.map((notification) => (
                                    <IonItem
                                        key={notification.id}
                                        className={`notification-item ${!notification.read ? 'notification-unread' : ''}`}
                                        button
                                        detail={false}
                                    >
                                        <IonIcon
                                            icon={getNotificationIcon(notification.type)}
                                            slot="start"
                                            color={getNotificationColor(notification.type)}
                                            className="notification-icon"
                                        />
                                        <IonLabel>
                                            <h2 className="notification-title">{notification.title}</h2>
                                            <p className="notification-message">{notification.message}</p>
                                            <p className="notification-timestamp">
                                                {formatTimestamp(notification.timestamp)}
                                            </p>
                                        </IonLabel>
                                        {!notification.read && (
                                            <IonBadge color="primary" slot="end" className="unread-dot">
                                                •
                                            </IonBadge>
                                        )}
                                    </IonItem>
                                ))}
                            </IonList>
                        </IonCol>
                    </IonRow>
                </IonGrid>

                <Segments stage={stage} setStage={setStage} />
            </IonContent>
        </IonPage>
    );
};

export default Notifications;
