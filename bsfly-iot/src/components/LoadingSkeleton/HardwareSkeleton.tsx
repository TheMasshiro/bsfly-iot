import React from "react";
import { IonSkeletonText, IonItem, IonLabel, IonList } from "@ionic/react";

interface StatusSkeletonProps {
  count?: number;
}

/**
 * Component: Skeleton loader for hardware status card
 * Shows placeholder while data is loading
 */
export const StatusSkeleton: React.FC<StatusSkeletonProps> = ({
  count = 3,
}) => {
  return (
    <IonList style={{ width: "100%", paddingLeft: 0, paddingRight: 0 }}>
      {Array.from({ length: count }).map((_, index) => (
        <IonItem lines="none" key={index}>
          <IonLabel>
            <IonSkeletonText
              animated={true}
              style={{ width: "60%", height: "16px" }}
            />
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
};

/**
 * Component: Skeleton loader for calibration card
 * Shows placeholder while calibration data is loading
 */
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

export default StatusSkeleton;
