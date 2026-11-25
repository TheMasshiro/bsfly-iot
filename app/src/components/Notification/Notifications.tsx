import { IonButton, IonContent, IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding, IonList, IonMenu } from '@ionic/react';
import { FC, useMemo, useRef, useState } from 'react';
import { notificationsOutline, trashOutline } from 'ionicons/icons';
import { useNotification } from '../../context/NotificationContext';
import EmptyState from '../ui/EmptyState';
import Segmented from '../ui/Segmented';
import StatusPill from '../ui/StatusPill';
import { Status } from '../ui/status';
import './Notifications.css';

type Drawer = 'all' | 'drawer1' | 'drawer2';

const TYPE_STATUS: Record<string, Status> = {
    success: 'ok',
    warning: 'warn',
    danger: 'crit',
    info: 'idle',
};

const TYPE_LABEL: Record<string, string> = {
    success: 'Resolved',
    warning: 'Warning',
    danger: 'Critical',
    info: 'Info',
};

const Notifications: FC = () => {
    const [selectedDrawer, setSelectedDrawer] = useState<Drawer>('all');
    const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotification();
    const slidingRefs = useRef<Map<string, HTMLIonItemSlidingElement>>(new Map());

    const handleDelete = async (id: string) => {
        const slidingEl = slidingRefs.current.get(id);
        if (slidingEl) {
            await slidingEl.close();
        }
        deleteNotification(id);
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
            ? notifications
            : notifications.filter(n => n.drawer === selectedDrawer),
        [selectedDrawer, notifications]
    );

    const unreadCount = useMemo(
        () => filteredNotifications.filter(n => !n.read).length,
        [filteredNotifications]
    );

    return (
        <IonMenu menuId="open-notifications" contentId="main" type="overlay" side="end" className="alerts-menu">
            <IonContent>
                <div className="alerts">
                    <header className="alerts-head">
                        <div>
                            <h2>Alerts</h2>
                            <p>{unreadCount > 0 ? `${unreadCount} unread` : 'Nothing unread'}</p>
                        </div>
                        {unreadCount > 0 && (
                            <IonButton fill="clear" onClick={markAllAsRead}>
                                Mark all read
                            </IonButton>
                        )}
                    </header>

                    <Segmented<Drawer>
                        block
                        label="Drawer"
                        value={selectedDrawer}
                        onChange={setSelectedDrawer}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'drawer1', label: 'Drawer 1' },
                            { value: 'drawer2', label: 'Drawer 2' },
                        ]}
                    />

                    {filteredNotifications.length === 0 ? (
                        <EmptyState icon={notificationsOutline} title="No alerts">
                            Readings that go out of range show up here.
                        </EmptyState>
                    ) : (
                        <IonList className="alerts-list" lines="none">
                            {filteredNotifications.map((notification) => (
                                <IonItemSliding
                                    key={notification.id}
                                    ref={(el) => {
                                        if (el) {
                                            slidingRefs.current.set(notification.id, el);
                                        } else {
                                            slidingRefs.current.delete(notification.id);
                                        }
                                    }}
                                >
                                    <IonItem className="alert-item" data-read={notification.read} button={false} lines="none" detail={false}>
                                        <div className="alert-row">
                                            <button type="button" className="alert-main" onClick={() => markAsRead(notification.id)}>
                                                <span className="alert-top">
                                                    <StatusPill status={TYPE_STATUS[notification.type]}>{TYPE_LABEL[notification.type]}</StatusPill>
                                                    {!notification.read && <span className="alert-unread" aria-label="Unread" />}
                                                    <span className="alert-time">{formatTimestamp(notification.timestamp)}</span>
                                                </span>
                                                <strong className="alert-title">{notification.title}</strong>
                                                <span className="alert-message">{notification.message}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="alert-delete"
                                                aria-label={`Delete ${notification.title}`}
                                                onClick={() => void handleDelete(notification.id)}
                                            >
                                                <IonIcon icon={trashOutline} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </IonItem>
                                    <IonItemOptions side="end" onIonSwipe={() => handleDelete(notification.id)}>
                                        <IonItemOption color="danger" expandable onClick={() => handleDelete(notification.id)}>
                                            <IonIcon slot="icon-only" icon={trashOutline} />
                                        </IonItemOption>
                                    </IonItemOptions>
                                </IonItemSliding>
                            ))}
                        </IonList>
                    )}
                </div>
            </IonContent>
        </IonMenu>
    );
};

export default Notifications;
