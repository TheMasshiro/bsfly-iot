import { createContext, FC, ReactNode, useContext, useState, useCallback, useEffect } from "react";
import { useAndroidNotifications } from "../hooks/useAndroidNotifications";

export interface Notification {
    id: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    drawer: 'drawer1' | 'drawer2';
}

interface NotificationContextProps {
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    deleteNotification: (id: string) => void;
    clearNotifications: () => void;
    unreadCount: number;
}

const NotificationContext = createContext<NotificationContextProps | null>(null);

export const NotificationProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { sendNativeNotification } = useAndroidNotifications();

    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNotification: Notification = {
            ...notification,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date(),
            read: false,
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 50));

        // Trigger Android native notification for alerts and warnings
        if (notification.type === 'danger' || notification.type === 'warning' || notification.type === 'info') {
            sendNativeNotification(
                notification.title,
                notification.message,
                notification.type === 'danger' ? 'danger' : notification.type === 'warning' ? 'warning' : 'info',
                notification.drawer
            );
        }
    }, [sendNativeNotification]);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const deleteNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                addNotification,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                clearNotifications,
                unreadCount,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotification must be used inside NotificationProvider");
    return context;
};
