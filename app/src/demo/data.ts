export const DEMO_MAC = "AA:BB:CC:DD:EE:01";

const now = () => new Date().toISOString();

export const devices = [
  {
    _id: "dev-rack-a",
    macAddress: DEMO_MAC,
    name: "Rack A",
    ownerId: "demo-user",
    status: "online",
    controlMode: "auto",
    joinCode: "7F3KQ9ZD",
    ipAddress: "192.168.100.200",
    lastSeen: now(),
    members: [
      { userId: "demo-user", role: "owner", joinedAt: "2025-09-02T08:00:00Z" },
      { userId: "u-2", role: "member", joinedAt: "2025-10-11T08:00:00Z" },
    ],
  },
  {
    _id: "dev-rack-b",
    macAddress: "AA:BB:CC:DD:EE:02",
    name: "Rack B",
    ownerId: "demo-user",
    status: "offline",
    controlMode: "manual",
    joinCode: "Q2M8HX4C",
    ipAddress: "192.168.100.201",
    lastSeen: "2026-11-24T21:14:00Z",
    members: [{ userId: "demo-user", role: "owner", joinedAt: "2025-11-20T08:00:00Z" }],
  },
];

export const members = [
  { userId: "demo-user", role: "owner", joinedAt: "2025-09-02T08:00:00Z", name: "Juan Dela Cruz", email: "juan@farm.local" },
  { userId: "u-2", role: "member", joinedAt: "2025-10-11T08:00:00Z", name: "Maria Santos", email: "maria@farm.local" },
];

const wave = (t: number, period: number, amp: number) => Math.sin((t / period) * Math.PI * 2) * amp;

export function reading(drawer: string, t = Date.now()) {
  const d1 = drawer !== "Drawer 2";
  const base = {
    drawerName: d1 ? "Drawer 1" : "Drawer 2",
    temperature: +(29.1 + wave(t, 2.2e7, 1.4) + wave(t, 7.9e6, 0.4) + (d1 ? 0 : 0.8)).toFixed(2),
    humidity: +(64 + wave(t, 1.9e7, 5) + wave(t, 5.3e6, 1.5) + (d1 ? 0 : 3.2)).toFixed(2),
    timestamp: t,
  };
  if (!d1) return { ...base, leftSubstrate: null, centerSubstrate: null, rightSubstrate: null, ammonia: null };
  return {
    ...base,
    leftSubstrate: Math.round(66 + wave(t, 2.6e7, 6)),
    centerSubstrate: Math.round(64 + wave(t, 1.7e7, 5)),
    rightSubstrate: Math.round(70 + wave(t, 2.3e7, 4)),
    ammonia: +(14 + wave(t, 3.1e7, 8)).toFixed(2),
  };
}

export function hourly(drawer: string) {
  const hour = 3.6e6;
  const end = Math.floor(Date.now() / hour) * hour;
  return Array.from({ length: 24 }, (_, i) => {
    const t = end - (23 - i) * hour;
    const r = reading(drawer, t);
    const subs = [r.leftSubstrate, r.centerSubstrate, r.rightSubstrate].filter((v): v is number => typeof v === "number");
    return {
      hour: new Date(t).toISOString(),
      temperature: r.temperature,
      humidity: r.humidity,
      moisture: subs.length ? Math.round(subs.reduce((a, b) => a + b, 0) / subs.length) : null,
      leftSubstrate: r.leftSubstrate,
      centerSubstrate: r.centerSubstrate,
      rightSubstrate: r.rightSubstrate,
      ammonia: r.ammonia,
    };
  });
}

export function history(from: string | null, to: string | null) {
  const start = from ? new Date(from).getTime() : Date.now() - 2 * 864e5;
  const end = Math.min(to ? new Date(to).getTime() + 864e5 : Date.now(), Date.now());
  const out: Array<{ drawerId: string; date: string; readings: unknown[] }> = [];
  for (const drawer of ["Drawer 1", "Drawer 2"]) {
    for (let h = Math.floor(start / 3.6e6) * 3.6e6; h < end; h += 3.6e6) {
      out.push({
        drawerId: drawer,
        date: new Date(h).toISOString(),
        readings: [0, 20, 40].map((m) => reading(drawer, h + m * 6e4)),
      });
    }
  }
  return out;
}

export const actuators: Record<string, unknown> = {
  "dev-rack-a:fan1": true,
  "dev-rack-a:heater": false,
  "dev-rack-a:humidifier1": false,
  "dev-rack-a:substrate": false,
  "dev-rack-a:fan3": false,
  "dev-rack-a:humidifier3": true,
  "dev-rack-a:light": 14400,
};
