const API_URL = import.meta.env.VITE_BACKEND_URL || "";

type ActuatorCallback = (data: any) => void;
type StateMap = Record<string, any>;

class ActuatorService {
  private listeners: Map<string, Set<ActuatorCallback>> = new Map();
  private pollInterval: number | null = null;
  private lastPollTime: number = 0;
  private isPolling: boolean = false;

  // Start polling for actuator state changes
  startPolling(intervalMs: number = 2000) {
    if (this.pollInterval) return;

    this.lastPollTime = Date.now();
    this.isPolling = true;

    this.pollInterval = window.setInterval(async () => {
      if (!this.isPolling) return;

      try {
        const response = await fetch(
          `${API_URL}/api/actuators/poll/since/${this.lastPollTime}`
        );
        const data = await response.json();

        if (data.states) {
          Object.entries(data.states).forEach(([actuatorId, state]) => {
            this.notifyListeners(actuatorId, state);
          });
        }

        this.lastPollTime = data.serverTime || Date.now();
      } catch (error) {
        console.error("Polling error:", error);
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

  // Subscribe to actuator state changes
  on(actuatorId: string, callback: ActuatorCallback) {
    if (!this.listeners.has(actuatorId)) {
      this.listeners.set(actuatorId, new Set());
    }
    this.listeners.get(actuatorId)!.add(callback);
  }

  // Unsubscribe from actuator state changes
  off(actuatorId: string, callback: ActuatorCallback) {
    const callbacks = this.listeners.get(actuatorId);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  private notifyListeners(actuatorId: string, state: any) {
    const callbacks = this.listeners.get(actuatorId);
    if (callbacks) {
      callbacks.forEach((cb) => cb(state));
    }
  }

  // Send actuator command
  async emit(actuatorId: string, state: any): Promise<void> {
    try {
      await fetch(`${API_URL}/api/actuators/${actuatorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
    } catch (error) {
      console.error(`Error sending ${actuatorId} command:`, error);
      throw error;
    }
  }

  // Get current state of an actuator
  async getState(actuatorId: string): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/api/actuators/${actuatorId}`);
      const data = await response.json();
      return data.state;
    } catch (error) {
      console.error(`Error getting ${actuatorId} state:`, error);
      return null;
    }
  }

  // Get all actuator states
  async getAllStates(): Promise<StateMap> {
    try {
      const response = await fetch(`${API_URL}/api/actuators`);
      return await response.json();
    } catch (error) {
      console.error("Error getting all states:", error);
      return {};
    }
  }

  // Check if API is reachable
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/`, { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const actuatorService = new ActuatorService();
