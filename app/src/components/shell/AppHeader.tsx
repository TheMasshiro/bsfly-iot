import { IonIcon, IonToolbar } from "@ionic/react";
import { menuController } from "@ionic/core/components";
import { chevronDownOutline, cloudOfflineOutline, notificationsOutline } from "ionicons/icons";
import { FC } from "react";
import { useDevice } from "../../context/DeviceContext";
import { useNotification } from "../../context/NotificationContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { formatRelativeTime } from "../../utils/time";

const AppHeader: FC = () => {
  const { currentDevice, devices } = useDevice();
  const { unreadCount } = useNotification();
  const online = useOnlineStatus();
  const deviceOnline = currentDevice?.status === "online";

  const state = !currentDevice
    ? "Add a device"
    : deviceOnline
      ? "Online"
      : `Offline${currentDevice.lastSeen ? " · " + formatRelativeTime(currentDevice.lastSeen) : ""}`;

  return (
    <>
      <IonToolbar>
        <div className="bs-header">
          <button
            type="button"
            className="bs-device-chip"
            onClick={() => (devices.length > 1 ? menuController.open("device-menu") : undefined)}
            aria-label={currentDevice ? `Device ${currentDevice.name}, ${state}. Change device` : "No device"}
          >
            <span className={`bs-dot ${currentDevice ? (deviceOnline ? "online" : "offline") : ""}`} />
            <span className="name">{currentDevice?.name ?? "No device"}</span>
            <span className="state">{state}</span>
            {devices.length > 1 && <IonIcon icon={chevronDownOutline} aria-hidden="true" />}
          </button>
          <span className="spacer" />
          <button type="button" className="bs-icon-btn" onClick={() => menuController.open("open-notifications")} aria-label={`Alerts, ${unreadCount} unread`}>
            <IonIcon icon={notificationsOutline} aria-hidden="true" />
            {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
        </div>
      </IonToolbar>
      {!online && (
        <div className="bs-offline-banner" role="status">
          <IonIcon icon={cloudOfflineOutline} aria-hidden="true" />
          No internet. Showing the last saved readings.
        </div>
      )}
    </>
  );
};

export default AppHeader;
