import {
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonMenu,
    IonMenuToggle,
} from '@ionic/react';

import { hardwareChipOutline, hardwareChipSharp } from 'ionicons/icons';
import { useDevice } from '../../context/DeviceContext';
import './DeviceMenu.css';

const DeviceMenu: React.FC = () => {
    const { devices, currentDevice, setCurrentDevice } = useDevice();

    return (
        <IonMenu menuId="device-menu" contentId="main" type="overlay" side="end">
            <IonContent>
                <IonList id="device-list">
                    <IonListHeader>Select Device</IonListHeader>
                    {devices.map((device) => (
                        <IonMenuToggle key={device._id} autoHide={false} menu="device-menu">
                            <IonItem
                                className={currentDevice?._id === device._id ? 'selected' : ''}
                                lines="none"
                                detail={false}
                                button
                                onClick={() => setCurrentDevice(device)}
                            >
                                <IonIcon
                                    aria-hidden="true"
                                    slot="start"
                                    ios={hardwareChipOutline}
                                    md={hardwareChipSharp}
                                />
                                <IonLabel>{device.name}</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                    ))}
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

export default DeviceMenu;
