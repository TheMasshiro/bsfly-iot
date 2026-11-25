import { useCallback, useEffect, useState } from "react";
import { controlsData, drawerActuatorMap } from "../../assets/assets";
import { actuatorService } from "../../services/socket/socket";
import { api, withToken } from "../../utils/api";

export type Drawer = "Drawer 1" | "Drawer 2";
export const DRAWERS: Drawer[] = ["Drawer 1", "Drawer 2"];

export interface Snapshot {
  temperature: number | null;
  humidity: number | null;
  leftSubstrate: number | null;
  centerSubstrate: number | null;
  rightSubstrate: number | null;
  ammonia: number | null;
  updatedAt: number | null;
}

const EMPTY: Snapshot = {
  temperature: null,
  humidity: null,
  leftSubstrate: null,
  centerSubstrate: null,
  rightSubstrate: null,
  ammonia: null,
  updatedAt: null,
};

const num = (v: unknown, allowNegative = false) =>
  typeof v === "number" && Number.isFinite(v) && (allowNegative || v >= 0) ? v : null;

const toDrawer = (name: unknown): Drawer | null =>
  typeof name === "string" && name.trim().startsWith("Drawer 2") ? "Drawer 2" : typeof name === "string" && name.trim().startsWith("Drawer 1") ? "Drawer 1" : null;

function normalize(data: any): Snapshot {
  const moisture = num(data?.moisture);
  const ts = data?.timestamp ? new Date(data.timestamp).getTime() : Date.now();
  const empty = ["temperature", "humidity", "leftSubstrate", "centerSubstrate", "rightSubstrate", "ammonia", "moisture"].every((k) => num(data?.[k], true) === null);
  if (empty) return { ...EMPTY };
  return {
    temperature: num(data?.temperature, true),
    humidity: num(data?.humidity),
    leftSubstrate: num(data?.leftSubstrate ?? data?.leftSoil) ?? moisture,
    centerSubstrate: num(data?.centerSubstrate ?? data?.centerSoil) ?? moisture,
    rightSubstrate: num(data?.rightSubstrate ?? data?.rightSoil) ?? moisture,
    ammonia: num(data?.ammonia),
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}

export function useDrawerReadings(deviceId: string | undefined, getToken: () => Promise<string | null>) {
  const [readings, setReadings] = useState<Record<Drawer, Snapshot>>({ "Drawer 1": EMPTY, "Drawer 2": EMPTY });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const results = await Promise.all(
        DRAWERS.map((d) => api.get(`/api/sensors/device/${deviceId}?drawer=${encodeURIComponent(d)}`, withToken(token))),
      );
      setReadings({ "Drawer 1": normalize(results[0].data), "Drawer 2": normalize(results[1].data) });
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [deviceId, getToken]);

  useEffect(() => {
    setReadings({ "Drawer 1": EMPTY, "Drawer 2": EMPTY });
    setLoading(Boolean(deviceId));
    if (!deviceId) return;
    void refresh();

    const onSensor = (data: any) => {
      const drawer = toDrawer(data?.drawerName);
      if (!drawer) return;
      setReadings((prev) => ({ ...prev, [drawer]: { ...normalize(data), updatedAt: Date.now() } }));
      setLoading(false);
    };
    actuatorService.onSensor(deviceId, onSensor);
    return () => actuatorService.offSensor(deviceId, onSensor);
  }, [deviceId, refresh]);

  return { readings, loading, failed, refresh };
}

export type ControlName = "Fan" | "Heater" | "Humidifier" | "Water Pump";

const idsFor = (deviceId: string, drawer: Drawer, control: ControlName) => {
  const map = drawerActuatorMap[drawer] as Record<string, readonly string[]>;
  return (map[control] ?? []).map((a) => `${deviceId}:${a}`);
};

export const controlsFor = (drawer: Drawer): ControlName[] =>
  controlsData
    .filter((c) => c.available && Object.keys(drawerActuatorMap[drawer]).includes(c.name))
    .map((c) => c.name as ControlName);

export function useActuators(deviceId: string | undefined) {
  const [states, setStates] = useState<Record<Drawer, Partial<Record<ControlName, boolean>>>>({ "Drawer 1": {}, "Drawer 2": {} });
  const [lightSeconds, setLightSeconds] = useState<number | null>(null);

  useEffect(() => {
    setStates({ "Drawer 1": {}, "Drawer 2": {} });
    setLightSeconds(null);
    if (!deviceId) return;

    let cancelled = false;
    void actuatorService.getAllStates().then((all) => {
      if (cancelled) return;
      const next: Record<Drawer, Partial<Record<ControlName, boolean>>> = { "Drawer 1": {}, "Drawer 2": {} };
      for (const drawer of DRAWERS) {
        for (const control of controlsFor(drawer)) {
          const ids = idsFor(deviceId, drawer, control);
          next[drawer][control] = ids.some((id) => Boolean(all[id]));
        }
      }
      setStates(next);
      const light = all[`${deviceId}:light`];
      setLightSeconds(typeof light === "number" ? light : null);
    });

    const subs: Array<[string, (s: any) => void]> = [];
    for (const drawer of DRAWERS) {
      for (const control of controlsFor(drawer)) {
        for (const id of idsFor(deviceId, drawer, control)) {
          const cb = (s: any) => setStates((prev) => ({ ...prev, [drawer]: { ...prev[drawer], [control]: Boolean(s) } }));
          actuatorService.on(id, cb);
          subs.push([id, cb]);
        }
      }
    }
    const lightCb = (s: any) => setLightSeconds(typeof s === "number" ? s : s && typeof s === "object" && "time" in s ? Number(s.time) : 0);
    actuatorService.on(`${deviceId}:light`, lightCb);
    subs.push([`${deviceId}:light`, lightCb]);

    return () => {
      cancelled = true;
      subs.forEach(([id, cb]) => actuatorService.off(id, cb));
    };
  }, [deviceId]);

  const toggle = useCallback(
    async (drawer: Drawer, control: ControlName) => {
      if (!deviceId) return;
      const next = !states[drawer][control];
      await Promise.all(idsFor(deviceId, drawer, control).map((id) => actuatorService.emit(id, next)));
      setStates((prev) => ({ ...prev, [drawer]: { ...prev[drawer], [control]: next } }));
      return next;
    },
    [deviceId, states],
  );

  return { states, lightSeconds, toggle };
}
