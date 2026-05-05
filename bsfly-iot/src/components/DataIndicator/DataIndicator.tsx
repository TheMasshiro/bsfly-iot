import React from "react";
import { IonText, IonNote } from "@ionic/react";
import { formatRelativeTime } from "../../utils/time";
import "./DataIndicator.css";

interface DataIndicatorProps {
  lastUpdated: Date | null;
  isStale: boolean;
  staleThresholdMs?: number;
}

/**
 * Component: Displays when data was last updated
 * Shows warning if data is stale (e.g., >1 hour old)
 */
export const DataIndicator: React.FC<DataIndicatorProps> = ({
  lastUpdated,
  isStale,
  staleThresholdMs = 1000 * 60 * 60, // 1 hour default
}) => {
  if (!lastUpdated) {
    return (
      <IonText color="warning" className="data-indicator">
        <IonNote>No data available</IonNote>
      </IonText>
    );
  }

  const relativeTime = formatRelativeTime(lastUpdated);

  if (isStale) {
    return (
    <IonText
      color="warning"
      className="data-indicator stale"
      role="status"
      aria-live="polite"
    >
        <IonNote>
          Last updated: {relativeTime} (stale - older than{" "}
          {Math.floor(staleThresholdMs / (1000 * 60 * 60))} hours)
        </IonNote>
      </IonText>
    );
  }

  return (
    <IonText
      color="medium"
      className="data-indicator fresh"
      role="status"
      aria-live="polite"
    >
      <IonNote>Last updated: {relativeTime}</IonNote>
    </IonText>
  );
};

export default DataIndicator;
