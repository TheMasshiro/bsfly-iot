import { useIonToast } from "@ionic/react";
import { useEffect, useRef } from "react";
import { useNotification } from "../../context/NotificationContext";
import { issuesFor } from "./insights";
import { DRAWERS, Drawer, Snapshot } from "./useFarmData";

export function useReadingAlerts(readings: Record<Drawer, Snapshot>, enabled: boolean) {
  const { addNotification } = useNotification();
  const [present] = useIonToast();
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    const active = new Set<string>();
    for (const drawer of DRAWERS) {
      for (const issue of issuesFor(drawer, readings[drawer])) {
        const key = `${drawer}|${issue.text.split(":")[0]}|${issue.status}`;
        active.add(key);
        if (shown.current.has(key)) continue;
        shown.current.add(key);
        const title = `${drawer}: ${issue.text.split(":")[0]}`;
        addNotification({
          type: issue.status === "crit" ? "danger" : "warning",
          title,
          message: issue.text,
          drawer: drawer === "Drawer 1" ? "drawer1" : "drawer2",
        });
        if (issue.status === "crit") {
          void present({ message: title, duration: 3000, position: "top", color: "danger" });
        }
      }
    }
    shown.current.forEach((k) => !active.has(k) && shown.current.delete(k));
  }, [readings, enabled, addNotification, present]);
}
