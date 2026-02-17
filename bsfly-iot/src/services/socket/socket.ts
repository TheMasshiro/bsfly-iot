import { api, API_URL } from "../../utils/api";
import axios, { AxiosRequestConfig } from "axios";

type ActuatorCallback = (data: any) => void;
type ErrorCallback = (error: Error) => void;
type StateMap = Record<string, any>;
type TokenGetter = () => Promise<string | null>;

class ActuatorService {
  private listeners: Map<string, Set<ActuatorCallback>> = new Map();
  private errorListeners: Set<ErrorCallback> = new Set();
  private pollInterval: number | null = null;
  private isPolling: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 2000;
  private tokenGetter: TokenGetter | null = null;

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

  startPolling(intervalMs: number = 5000) {
    if (this.pollInterval) return;

    this.isPolling = true;
    this.retryCount = 0;

    this.pollInterval = window.setInterval(async () => {
      if (!this.isPolling) return;

      try {
        const config = await this.getAxiosConfig();
        const { data: states } = await api.get("/api/actuators", config);

        if (states && Object.keys(states).length > 0) {
          Object.entries(states).forEach(([actuatorId, state]) => {
            this.notifyListeners(actuatorId, state);
          });
        }

        this.retryCount = 0;
      } catch (error) {
        this.retryCount++;
        if (this.retryCount >= this.maxRetries) {
          this.notifyError(new Error("Connection lost. Retrying..."));
        }
      }
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
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

  onError(callback: ErrorCallback) {
    this.errorListeners.add(callback);
  }

  offError(callback: ErrorCallback) {
    this.errorListeners.delete(callback);
  }

  private notifyListeners(actuatorId: string, state: any) {
    const callbacks = this.listeners.get(actuatorId);
    if (callbacks) {
      callbacks.forEach((cb) => cb(state));
    }
  }

  private notifyError(error: Error) {
    this.errorListeners.forEach((cb) => cb(error));
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
        await api.post(`/api/actuators/${actuatorId}`, { state }, config);
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
