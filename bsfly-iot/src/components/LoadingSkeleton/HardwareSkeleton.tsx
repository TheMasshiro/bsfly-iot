import React from "react";
import { IonSkeletonText, IonItem, IonLabel, IonList } from "@ionic/react";

export const CalibrationSkeleton: React.FC = () => {
  return (
    <IonList style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}>
      <IonItem lines="none">
        <IonLabel>
          <IonSkeletonText
            animated={true}
            style={{ width: "80%", height: "16px" }}
          />
        </IonLabel>
      </IonItem>
    </IonList>
  );
};

export default CalibrationSkeleton;
