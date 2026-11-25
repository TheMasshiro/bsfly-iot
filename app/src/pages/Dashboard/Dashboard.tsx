import { IonButton, IonIcon, useIonToast } from "@ionic/react";
import { alertCircleOutline, checkmarkCircleOutline, hardwareChipOutline, sunnyOutline, timeOutline } from "ionicons/icons";
import { FC, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import Page from "../../components/ui/Page";
import Segmented from "../../components/ui/Segmented";
import StatusPill from "../../components/ui/StatusPill";
import { useDevice } from "../../context/DeviceContext";
import { useLifeCycle } from "../../context/LifeCycleContext";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { api, withToken } from "../../utils/api";
import DrawerPanel from "./DrawerPanel";
import { issuesFor } from "./insights";
import { ControlName, DRAWERS, Drawer, useActuators, useDrawerReadings } from "./useFarmData";
import { useReadingAlerts } from "./useReadingAlerts";
import "./Dashboard.css";

const hm = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const Dashboard: FC = () => {
  const history = useHistory();
  const [present] = useIonToast();
  const online = useOnlineStatus();
  const { stage, setStage } = useLifeCycle();
  const { currentDevice, setCurrentDevice, getToken, refreshDevices, loading: devicesLoading } = useDevice();
  const deviceId = currentDevice?._id;
  const deviceOnline = currentDevice?.status === "online";
  const mode = currentDevice?.controlMode ?? "auto";

  const { readings, loading, refresh } = useDrawerReadings(deviceId, getToken);
  const { states, lightSeconds, toggle } = useActuators(deviceId);
  const [busy, setBusy] = useState<ControlName | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  useReadingAlerts(readings, deviceOnline);

  const issues = useMemo(() => DRAWERS.flatMap((d) => issuesFor(d, readings[d])), [readings]);
  const critical = issues.filter((i) => i.status === "crit").length;

  const lockReason = !currentDevice
    ? null
    : !online
      ? "No internet"
      : !deviceOnline
        ? "Device is offline"
        : mode === "auto"
          ? "Automatic mode is on. Switch to Manual to use these."
          : null;

  const setMode = async (next: "auto" | "manual") => {
    if (!currentDevice) return;
    setModeBusy(true);
    try {
      const token = await getToken();
      await api.patch(`/api/devices/${currentDevice._id}/control-mode`, { mode: next }, withToken(token));
      setCurrentDevice({ ...currentDevice, controlMode: next });
      void present({ message: next === "auto" ? "Automatic mode on" : "Manual mode on", duration: 1600, position: "top", color: "success" });
    } catch {
      void present({ message: "Couldn't change the mode. Try again.", duration: 2200, position: "top", color: "danger" });
    } finally {
      setModeBusy(false);
    }
  };

  const onToggle = async (drawer: Drawer, control: ControlName) => {
    setBusy(control);
    try {
      const next = await toggle(drawer, control);
      void present({ message: `${control} turned ${next ? "on" : "off"}`, duration: 1400, position: "top" });
    } catch {
      void present({ message: `Couldn't switch the ${control.toLowerCase()}. Try again.`, duration: 2200, position: "top", color: "danger" });
    } finally {
      setBusy(null);
    }
  };

  if (!devicesLoading && !currentDevice) {
    return (
      <Page title="Home">
        <Card>
          <EmptyState
            icon={hardwareChipOutline}
            title="No device yet"
            action={<IonButton onClick={() => history.push("/devices")}>Add a device</IonButton>}
          >
            Add your ESP32 controller to start seeing drawer readings here.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Home"
      subtitle={currentDevice ? `${currentDevice.name} · ${deviceOnline ? "live" : "offline"}` : undefined}
      onRefresh={() => Promise.all([refresh(), refreshDevices()])}
      actions={
        <div className="mode-switch">
          <span>Control</span>
          <Segmented<"auto" | "manual">
            label="Control mode"
            value={mode}
            disabled={modeBusy || !currentDevice || !online}
            onChange={(v) => void setMode(v)}
            options={[
              { value: "auto", label: "Automatic" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </div>
      }
    >
      <div className="home-top">
        <div className="status-hero" data-status={loading ? "idle" : critical ? "crit" : issues.length ? "warn" : "ok"} role="status">
          <IonIcon icon={issues.length ? alertCircleOutline : checkmarkCircleOutline} aria-hidden="true" />
          <div>
            <h2>
              {loading
                ? "Checking the drawers…"
                : issues.length === 0
                  ? "Everything looks good"
                  : `${issues.length} ${issues.length === 1 ? "thing needs" : "things need"} attention`}
            </h2>
            {!loading && issues.length === 0 && <p>All readings are inside the target ranges.</p>}
            {issues.length > 0 && (
              <ul>
                {issues.slice(0, 4).map((i) => (
                  <li key={i.drawer + i.text}>
                    <StatusPill status={i.status} plain>{i.drawer}</StatusPill>
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <button type="button" className="light-card" onClick={() => history.push("/light")}>
          <IonIcon icon={sunnyOutline} aria-hidden="true" />
          <span className="title">Light</span>
          <span className="value">{lightSeconds && lightSeconds > 0 ? "On" : "Off"}</span>
          <span className="sub">
            <IonIcon icon={timeOutline} aria-hidden="true" />
            {lightSeconds && lightSeconds > 0 ? `${hm(lightSeconds)} left` : "Tap to set a timer"}
          </span>
        </button>
      </div>

      <div className="drawer-switch">
        <Segmented<Drawer>
          block
          label="Drawer"
          value={stage}
          onChange={setStage}
          options={DRAWERS.map((d) => ({ value: d, label: d }))}
        />
      </div>

      <div className="drawers">
        {DRAWERS.map((d) => (
          <DrawerPanel
            key={d}
            drawer={d}
            snapshot={readings[d]}
            controls={states[d]}
            canControl={lockReason === null}
            lockReason={lockReason}
            busy={busy}
            onToggle={(c) => void onToggle(d, c)}
            hidden={d !== stage ? true : undefined}
          />
        ))}
      </div>
    </Page>
  );
};

export default Dashboard;
