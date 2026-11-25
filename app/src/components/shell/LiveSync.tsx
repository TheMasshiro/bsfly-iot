import { FC, useEffect } from "react";
import { useDevice } from "../../context/DeviceContext";
import { actuatorService } from "../../services/socket/socket";

let started = false;

const LiveSync: FC = () => {
  const { refreshDevices } = useDevice();

  useEffect(() => {
    if (!started) {
      started = true;
      actuatorService.connect();
    }
    const id = window.setInterval(() => void refreshDevices(), 5000);
    return () => window.clearInterval(id);
  }, [refreshDevices]);

  return null;
};

export default LiveSync;
