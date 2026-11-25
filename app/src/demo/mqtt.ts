import { DEMO_MAC, reading } from "./data";

type Listener = (...args: any[]) => void;

function connect() {
  const listeners: Record<string, Listener[]> = {};
  const emit = (event: string, ...args: any[]) => (listeners[event] ?? []).forEach((cb) => cb(...args));
  let timer: number | undefined;

  const client = {
    connected: false,
    on(event: string, cb: Listener) {
      (listeners[event] ??= []).push(cb);
      return client;
    },
    subscribe(_topic: string, cb?: (err: Error | null) => void) {
      cb?.(null);
      return client;
    },
    publish() {
      return client;
    },
    end() {
      window.clearInterval(timer);
      client.connected = false;
    },
  };

  setTimeout(() => {
    client.connected = true;
    emit("connect");
    const scenario = sessionStorage.getItem("demo-scenario") ?? "";
    const tick = () => {
      if (scenario === "empty" || scenario === "nodata" || scenario === "error") return;
      for (const drawer of ["Drawer 1", "Drawer 2"]) {
        emit("message", `devices/${DEMO_MAC}/sensors`, new TextEncoder().encode(JSON.stringify(reading(drawer))));
      }
    };
    tick();
    timer = window.setInterval(tick, 5000);
  }, 300);

  return client;
}

export default { connect };
export { connect };
