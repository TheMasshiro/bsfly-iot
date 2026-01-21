import { FC, useRef } from 'react';
import {
    IonModal,
    IonContent,
    IonTitle,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
} from '@ionic/react';
import { controlsData } from '../../assets/assets';
import { useLifeCycle } from '../../context/LifeCycleContext';
import Controls from '../Controls/Controls';

interface ControlModalProps {
    sensor: string;
    onClose: () => void;
}

const ControlModal: FC<ControlModalProps> = ({ sensor, onClose }) => {
    const { stage } = useLifeCycle()
    const modal = useRef<HTMLIonModalElement>(null);


    return (
        <IonModal
            ref={modal}
            isOpen
            onDidDismiss={onClose}
            initialBreakpoint={0.75}
            breakpoints={[0, 0.25, 0.5, 0.75, 1]}
        >
            <IonHeader>
                <IonToolbar>
                    <IonTitle size='small'>{sensor}: {stage}</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={() => modal.current?.dismiss()}>Close</IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonGrid>
                    <IonRow class="ion-justify-content-center ion-align-items-center">
                        {controlsData.map((control, index) => {
                            if (control.sensor === sensor && control.available) {
                                return (
                                    <IonCol key={index} size="12" sizeMd="6">
                                        <Controls
                                            key={index}
                                            title={control.name}
                                            description={control.description}
                                        />
                                    </IonCol>
                                )
                            } else if (control.sensor === sensor && !control.available) {
                                return (
                                    <IonCard key={index} mode="ios">
                                        <IonCardHeader>
                                            <IonCardTitle>{control.name}</IonCardTitle>
                                        </IonCardHeader>
                                        <IonCardContent>{control.description}</IonCardContent>
                                    </IonCard>
                                )
                            }
                        })}
                    </IonRow>
                </IonGrid>
            </IonContent>
        </IonModal>
    );
}

export default ControlModal;
