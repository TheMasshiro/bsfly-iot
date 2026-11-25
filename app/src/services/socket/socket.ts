import { api, API_URL } from "../../utils/api";
import axios, { AxiosRequestConfig } from "axios";
import mqtt, { MqttClient } from "mqtt";

type ActuatorCallback = (data: any) => void;
type ModeCallback = (data: { deviceId: string; mode: 'auto' | 'manual' }) => void;
type DeviceActivityCallback = (data: { deviceId: string; lastSeen: string }) => void;
type SensorCallback = (data: any) => void;
type ErrorCallback = (error: Error) => void;
type StateMap = Record<string, any>;
type TokenGetter = () => Promise<string | null>;

class ActuatorService {
  private listeners: Map<string, Set<ActuatorCallback>> = new Map();
  private modeListeners: Set<ModeCallback> = new Set();
  private deviceActivityListeners: Set<DeviceActivityCallback> = new Set();
  private sensorListeners: Map<string, Set<SensorCallback>> = new Map();
  private errorListeners: Set<ErrorCallback> = new Set();
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 2000;
  private tokenGetter: TokenGetter | null = null;

  private mqttClient: MqttClient | null = null;
  private mqttUrl: string = "";
  private macToDeviceId: Record<string, string> = {};
  private deviceIdToMac: Record<string, string> = {};

  setTokenGetter(getter: TokenGetter) {
    this.tokenGetter = getter;
  }

  private async getAxiosConfig(): Promise<AxiosRequestConfig> {
    const config: AxiosRequestConfig = {};
    if (this.tokenGetter) {
      const token = await this.tokenGetter();
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }
    }
    return config;
  }

  connect() {
    if (!this.mqttClient) {
      this.initMqtt();
    }
  }

  disconnect() {
    if (this.mqttClient) {
      try {
        this.mqttClient.end();
      } catch (e) {
      }
      this.mqttClient = null;
    }
  }

  on(actuatorId: string, callback: ActuatorCallback) {
    if (!this.listeners.has(actuatorId)) {
      this.listeners.set(actuatorId, new Set());
    }
    this.listeners.get(actuatorId)!.add(callback);
  }

  off(actuatorId: string, callback: ActuatorCallback) {
    const callbacks = this.listeners.get(actuatorId);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  onMode(callback: ModeCallback) {
    this.modeListeners.add(callback);
  }

  offMode(callback: ModeCallback) {
    this.modeListeners.delete(callback);
  }

  onDeviceActivity(callback: DeviceActivityCallback) {
    this.deviceActivityListeners.add(callback);
  }

  offDeviceActivity(callback: DeviceActivityCallback) {
    this.deviceActivityListeners.delete(callback);
  }

  onError(callback: ErrorCallback) {
    this.errorListeners.add(callback);
  }

  offError(callback: ErrorCallback) {
    this.errorListeners.delete(callback);
  }

  onSensor(deviceId: string, callback: SensorCallback) {
    if (!this.sensorListeners.has(deviceId)) {
      this.sensorListeners.set(deviceId, new Set());
    }
    this.sensorListeners.get(deviceId)!.add(callback);

    this.subscribeToDeviceSensors(deviceId);
  }

  offSensor(deviceId: string, callback: SensorCallback) {
    const callbacks = this.sensorListeners.get(deviceId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.sensorListeners.delete(deviceId);
      }
    }
  }

  private async subscribeToDeviceSensors(deviceId: string) {
    try {
      let mac = this.deviceIdToMac[deviceId];
      if (!mac) {
        await this.ensureDeviceMappings();
        mac = this.deviceIdToMac[deviceId];
      }

      if (mac && this.mqttClient && this.mqttClient.connected) {
        this.mqttClient.subscribe(`devices/${mac}/sensors`);
      }
    } catch (e) {
      console.error("Failed to subscribe to device sensors", e);
    }
  }

  private async resolveDeviceId(mac: string) {
    let deviceId = this.macToDeviceId[mac];
    if (!deviceId) {
      await this.ensureDeviceMappings();
      deviceId = this.macToDeviceId[mac];
    }

    return deviceId;
  }

  private parseMqttPayload(message: Buffer) {
    const text = message.toString();

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private normalizeActuatorState(payload: any) {
    let state: any = null;

    if (payload && typeof payload === "object" && payload.hasOwnProperty("state")) {
      state = payload.state;
    } else {
      state = payload;
    }

    if (typeof state === "string") {
      if (state === "true" || state === "1") state = true;
      else if (state === "false" || state === "0") state = false;
    }

    return state;
  }

  private normalizeModeState(payload: any) {
    const rawMode =
      typeof payload === "object" && payload !== null && "state" in payload
        ? payload.state
        : payload;

    if (typeof rawMode !== "string") {
      return null;
    }

    const normalized = rawMode.toLowerCase();
    return normalized === "auto" || normalized === "manual" ? normalized : null;
  }

  private notifyListeners(actuatorId: string, state: any) {
    const callbacks = this.listeners.get(actuatorId);
    if (callbacks) {
      callbacks.forEach((cb) => cb(state));
    }
  }

  private notifyModeListeners(deviceId: string, mode: 'auto' | 'manual') {
    this.modeListeners.forEach((cb) => cb({ deviceId, mode }));
  }

  private notifyDeviceActivity(deviceId: string) {
    const lastSeen = new Date().toISOString();
    this.deviceActivityListeners.forEach((cb) => cb({ deviceId, lastSeen }));
  }

  private notifySensorListeners(deviceId: string, data: any) {
    const callbacks = this.sensorListeners.get(deviceId);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  private notifyError(error: Error) {
    this.errorListeners.forEach((cb) => cb(error));
  }

  private async ensureDeviceMappings() {
    try {
      const config = await this.getAxiosConfig();
      const { data: devices } = await api.get("/api/devices/user/me", config);

      if (Array.isArray(devices)) {
        this.macToDeviceId = {};
        this.deviceIdToMac = {};

        devices.forEach((device: any) => {
          if (device._id && device.macAddress) {
            const mac = device.macAddress.toUpperCase();
            this.macToDeviceId[mac] = device._id;
            this.deviceIdToMac[device._id] = mac;
          }
        });
      }
    } catch (e) {
      console.error("Failed to load device mappings", e);
    }
  }

  private async initMqtt() {
    try {
      this.mqttUrl = import.meta.env.VITE_MQTT_BROKER_URL;

      await this.ensureDeviceMappings();

      const username = import.meta.env.VITE_MQTT_USERNAME;
      const password = import.meta.env.VITE_MQTT_PASSWORD;

      this.mqttClient = mqtt.connect(this.mqttUrl, {
        username: username || undefined,
        password: password || undefined,
        clientId: "web-client-" + Math.random().toString(36).substr(2, 9),
        clean: true,
        reconnectPeriod: 1000,
      });

      this.mqttClient.on("connect", () => {
        this.mqttClient!.subscribe("devices/+/sensors", (err) => {
          if (err) {
            console.error("MQTT sensor subscribe error:", err);
          }
        });

        this.mqttClient!.subscribe("devices/+/actuators/mode/+", (err) => {
          if (err) {
            console.error("MQTT mode subscribe error:", err);
          }
        });

        this.mqttClient!.subscribe("devices/+/actuators/+/state", (err) => {
          if (err) {
            console.error("MQTT subscribe error:", err);
          }
        });
      });

      this.mqttClient.on("message", (topic: string, message: Buffer) => {
        this.handleMqttMessage(topic, message);
      });

      this.mqttClient.on("error", (err: any) => {
        console.error("MQTT error:", err);
        this.notifyError(new Error("MQTT connection error"));
      });

      this.mqttClient.on("close", () => {});

      this.mqttClient.on("reconnect", () => {});
    } catch (e) {
      console.error("Failed to initialize MQTT client:", e);
    }
  }

  private async handleMqttMessage(topic: string, message: Buffer) {
    try {
      const parts = topic.split("/");
      const mac = parts[1]?.toUpperCase();

      if (
        parts.length >= 3 &&
        parts[0] === "devices" &&
        parts[2] === "sensors"
      ) {
        const payload = this.parseMqttPayload(message);

        const deviceId = mac ? await this.resolveDeviceId(mac) : null;

        if (deviceId) {
          this.notifyDeviceActivity(deviceId);
          this.notifySensorListeners(deviceId, payload);
        }
        return;
      }

      if (
        parts.length >= 5 &&
        parts[0] === "devices" &&
        parts[2] === "actuators" &&
        parts[3] === "mode" &&
        (parts[4] === "control" || parts[4] === "state")
      ) {
        const payload = this.parseMqttPayload(message);
        const mode = this.normalizeModeState(payload);

        if (!mode) {
          return;
        }

        const deviceId = mac ? await this.resolveDeviceId(mac) : null;

        if (deviceId) {
          this.notifyDeviceActivity(deviceId);
          this.notifyModeListeners(deviceId, mode);
        }
        return;
      }

      if (
        parts.length >= 5 &&
        parts[0] === "devices" &&
        parts[2] === "actuators" &&
        parts[4] === "state"
      ) {
        const actuator = parts[3];
        const payload = this.parseMqttPayload(message);
        const state = this.normalizeActuatorState(payload);
        const deviceId = mac ? await this.resolveDeviceId(mac) : null;

        if (deviceId) {
          const actuatorId = `${deviceId}:${actuator}`;
          this.notifyDeviceActivity(deviceId);
          this.notifyListeners(actuatorId, state);
        }
      }
    } catch (e) {
      console.error("Error handling MQTT message:", e);
    }
  }

  async emit(
    actuatorId: string,
    state: any,
    retries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const config = await this.getAxiosConfig();
        const { data } = await api.post(`/api/actuators/${actuatorId}`, { state }, config);
        const returnedState = data && data.state !== undefined ? data.state : state;
        this.notifyListeners(actuatorId, returnedState);
        return;
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * (i + 1))
          );
        }
      }
    }

    throw lastError || new Error("Failed to update actuator");
  }

  async getState(actuatorId: string): Promise<any> {
    try {
      const config = await this.getAxiosConfig();
      const { data } = await api.get(`/api/actuators/${actuatorId}`, config);
      return data.state;
    } catch {
      return null;
    }
  }

  async getAllStates(): Promise<StateMap> {
    try {
      const config = await this.getAxiosConfig();
      const { data } = await api.get("/api/actuators", config);
      return data;
    } catch {
      return {};
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await axios.get(`${API_URL}/`);
      return true;
    } catch {
      return false;
    }
  }
}

export const actuatorService = new ActuatorService();
