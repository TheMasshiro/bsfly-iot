import { IonContent, IonIcon, IonMenu, IonMenuToggle } from "@ionic/react";
import { checkmarkOutline } from "ionicons/icons";
import { FC } from "react";
import { useDevice } from "../../context/DeviceContext";
import "./DeviceMenu.css";

const DeviceMenu: FC = () => {
  const { devices, currentDevice, setCurrentDevice } = useDevice();

  return (
    <IonMenu menuId="device-menu" contentId="main" type="overlay" side="end" className="bs-device-menu">
      <IonContent>
        <div className="bs-device-menu-body">
          <h2>Choose a device</h2>
          <div className="bs-device-list">
            {devices.map((device) => {
              const active = currentDevice?._id === device._id;
              return (
                <IonMenuToggle key={device._id} autoHide={false} menu="device-menu">
                  <button type="button" className="bs-device-option" aria-pressed={active} onClick={() => setCurrentDevice(device)}>
                    <span className={`bs-dot ${device.status}`} />
                    <span className="text">
                      <strong>{device.name}</strong>
                      <span>{device.status === "online" ? "Online" : "Offline"} · {device.macAddress}</span>
                    </span>
                    {active && <IonIcon icon={checkmarkOutline} aria-hidden="true" />}
                  </button>
                </IonMenuToggle>
              );
            })}
          </div>
        </div>
      </IonContent>
    </IonMenu>
  );
};

export default DeviceMenu;
