import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonLabel,
    IonPage,
    IonRange,
    IonText,
} from "@ionic/react";
import { calendarOutline, cloudUpload, timeOutline } from "ionicons/icons";
import { FC, useState, useMemo } from "react";
import Toolbar from "../../components/Toolbar/Toolbar";

const Backup: FC = () => {
    const [daysAgo, setDaysAgo] = useState<number>(0);

    const today = useMemo(() => new Date(), []);

    const selectedDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date;
    }, [daysAgo]);

    const formatDate = (date: Date): string => {
        return date.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const handleBackup = () => {
        console.log("Backing up data from:", formatDate(selectedDate));
        // TODO: Implement backup logic
    };

    return (
        <IonPage>
            <IonHeader class="ion-no-border">
                <Toolbar header={"Backup Data"} />
            </IonHeader>

            <IonContent fullscreen>
                {/* Date Selection Card */}
                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={calendarOutline}
                                style={{ verticalAlign: "middle", marginRight: 8 }}
                            />
                            Select Backup Date
                        </IonCardSubtitle>
                        <IonCardTitle className="ion-text-center ion-padding-top">
                            <IonText color="primary">
                                <h1 style={{ margin: 0, fontSize: 28 }}>
                                    {formatDate(selectedDate)}
                                </h1>
                            </IonText>
                        </IonCardTitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <div className="ion-text-center ion-padding-bottom">
                            <IonChip color={daysAgo === 0 ? "primary" : "medium"}>
                                <IonIcon icon={timeOutline} />
                                <IonLabel>
                                    {daysAgo === 0
                                        ? "Today"
                                        : `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`}
                                </IonLabel>
                            </IonChip>
                        </div>

                        <IonRange
                            min={0}
                            max={30}
                            step={1}
                            value={daysAgo}
                            onIonChange={(e) => setDaysAgo(e.detail.value as number)}
                            pin
                            pinFormatter={(value: number) => `${value}d`}
                            style={{ padding: "0 8px" }}
                        >
                            <IonLabel slot="start" color="medium">
                                Today
                            </IonLabel>
                            <IonLabel slot="end" color="medium">
                                30 days
                            </IonLabel>
                        </IonRange>

                        <div
                            className="ion-text-center"
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 8px 0",
                            }}
                        >
                            <IonText color="medium">
                                <small>{formatDate(today)}</small>
                            </IonText>
                            <IonText color="medium">
                                <small>
                                    {formatDate(
                                        new Date(
                                            today.getTime() - 30 * 24 * 60 * 60 * 1000
                                        )
                                    )}
                                </small>
                            </IonText>
                        </div>
                    </IonCardContent>
                </IonCard>

                {/* Backup Action Card */}
                <IonCard className="ion-margin">
                    <IonCardHeader>
                        <IonCardSubtitle>
                            <IonIcon
                                icon={cloudUpload}
                                style={{ verticalAlign: "middle", marginRight: 8 }}
                            />
                            Backup Action
                        </IonCardSubtitle>
                        <IonCardTitle>Create Backup</IonCardTitle>
                    </IonCardHeader>

                    <IonCardContent>
                        <IonText color="medium">
                            <p style={{ margin: "0 0 24px" }}>
                                Export sensor data from{" "}
                                <strong>{formatDate(selectedDate)}</strong> to today.
                            </p>
                        </IonText>

                        <IonButton
                            expand="block"
                            onClick={handleBackup}
                            size="large"
                            style={{
                                "--background":
                                    "linear-gradient(135deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
                                "--box-shadow":
                                    "0 4px 16px rgba(var(--ion-color-primary-rgb), 0.4)",
                                "--border-radius": "12px",
                                height: "56px",
                                fontSize: "18px",
                                fontWeight: "600",
                            }}
                        >
                            <IonIcon
                                icon={cloudUpload}
                                slot="start"
                                style={{ fontSize: 24 }}
                            />
                            Create Backup
                        </IonButton>
                    </IonCardContent>
                </IonCard>
            </IonContent>
        </IonPage>
    );
};

export default Backup;
