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
} from '@ionic/react';
import { controlsData } from '../../assets/assets';
import { useLifeCycle } from '../../context/LifeCycleContext';
import Controls from '../Controls/Controls';

const ControlModal: FC = () => {
    const { stage } = useLifeCycle()
    const modal = useRef<HTMLIonModalElement>(null);


    return (
        <IonModal
            ref={modal}
            trigger="open-control-modal"
            initialBreakpoint={0.75}
            breakpoints={[0, 0.25, 0.5, 0.75, 1]}
        >
            class
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Controls: {stage} Enclosure</IonTitle>
                    <IonButtons slot="end">
                        <IonButton onClick={() => modal.current?.dismiss()}>Close</IonButton>
                    </IonButtons>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonGrid>
                    <IonRow class="ion-justify-content-center ion-align-items-center">
                        {controlsData.map((control, index) => (
                            <IonCol key={index} size="12" sizeMd="6" sizeLg="4">
                                <Controls
                                    key={index}
                                    title={control.name}
                                    description={control.description}
                                />
                            </IonCol>
                        ))}
                    </IonRow>
                </IonGrid>
            </IonContent>
        </IonModal>
    );
}

export default ControlModal;
