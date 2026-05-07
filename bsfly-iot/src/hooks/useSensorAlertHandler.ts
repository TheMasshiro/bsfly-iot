/**
 * Example: Sensor Alert Handler Component
 * 
 * This example demonstrates how to integrate Android notifications
 * with your sensor monitoring logic.
 * 
 * Usage in your component:
 * 
 * import { useSensorAlertHandler } from './useSensorAlertHandler';
 * 
 * function Dashboard() {
 *   useSensorAlertHandler(readings);
 *   // ... rest of component
 * }
 */

import { useEffect, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';

export interface SensorReading {
  temperature: number;
  humidity: number;
  moisture?: number;
  ammonia?: number;
  drawer: 'drawer1' | 'drawer2';
  timestamp: Date;
}

export interface Thresholds {
  temperature: { min: number; max: number; optimal: [number, number] };
  humidity: { min: number; max: number; optimal: [number, number] };
  moisture?: { min: number; max: number; optimal: [number, number] };
  ammonia?: { min: number; max: number; optimal: [number, number] };
}

/**
 * Hook to monitor sensor readings and trigger alerts
 */
export const useSensorAlertHandler = (
  reading: SensorReading | null,
  thresholds?: Thresholds
) => {
  const { addNotification } = useNotification();
  const lastAlertTimeRef = useRef<{ [key: string]: number }>({});

  // Debounce notifications (max 1 per 5 minutes per alert type)
  const shouldAlert = (alertType: string): boolean => {
    const key = `${reading?.drawer}-${alertType}`;
    const lastTime = lastAlertTimeRef.current[key] || 0;
    const now = Date.now();

    if (now - lastTime > 5 * 60 * 1000) {
      lastAlertTimeRef.current[key] = now;
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!reading || !thresholds) return;

    // Check Temperature
    if (reading.temperature > thresholds.temperature.max) {
      if (shouldAlert('temp-high')) {
        addNotification({
          type: 'danger',
          title: '🔥 Temperature Critical',
          message: `${reading.drawer}: ${reading.temperature}°C (max: ${thresholds.temperature.max}°C)`,
          drawer: reading.drawer,
        });
      }
    } else if (reading.temperature < thresholds.temperature.min) {
      if (shouldAlert('temp-low')) {
        addNotification({
          type: 'danger',
          title: '❄️ Temperature Low',
          message: `${reading.drawer}: ${reading.temperature}°C (min: ${thresholds.temperature.min}°C)`,
          drawer: reading.drawer,
        });
      }
    }

    // Check Humidity
    if (reading.humidity > thresholds.humidity.max) {
      if (shouldAlert('humidity-high')) {
        addNotification({
          type: 'warning',
          title: '💧 High Humidity',
          message: `${reading.drawer}: ${reading.humidity}% (max: ${thresholds.humidity.max}%)`,
          drawer: reading.drawer,
        });
      }
    } else if (reading.humidity < thresholds.humidity.min) {
      if (shouldAlert('humidity-low')) {
        addNotification({
          type: 'warning',
          title: '🌵 Low Humidity',
          message: `${reading.drawer}: ${reading.humidity}% (min: ${thresholds.humidity.min}%)`,
          drawer: reading.drawer,
        });
      }
    }

    // Check Moisture (if applicable)
    if (thresholds.moisture && reading.moisture !== undefined) {
      if (reading.moisture > thresholds.moisture.max) {
        if (shouldAlert('moisture-high')) {
          addNotification({
            type: 'warning',
            title: '🌊 Substrate Too Wet',
            message: `${reading.drawer}: ${reading.moisture}% (max: ${thresholds.moisture.max}%)`,
            drawer: reading.drawer,
          });
        }
      } else if (reading.moisture < thresholds.moisture.min) {
        if (shouldAlert('moisture-low')) {
          addNotification({
            type: 'warning',
            title: '🏜️ Substrate Too Dry',
            message: `${reading.drawer}: ${reading.moisture}% (min: ${thresholds.moisture.min}%)`,
            drawer: reading.drawer,
          });
        }
      }
    }

    // Check Ammonia (if applicable)
    if (thresholds.ammonia && reading.ammonia !== undefined) {
      if (reading.ammonia > thresholds.ammonia.max) {
        if (shouldAlert('ammonia-high')) {
          addNotification({
            type: 'danger',
            title: '⚠️ Ammonia Critical',
            message: `${reading.drawer}: ${reading.ammonia.toFixed(2)} ppm (max: ${thresholds.ammonia.max})`,
            drawer: reading.drawer,
          });
        }
      }
    }
  }, [reading, thresholds, addNotification, shouldAlert]);
};

/**
 * Example: Integration with Dashboard component
 * 
 * function Dashboard() {
 *   const { currentReading } = useDeviceContext();
 *   const drawer1Thresholds = lifecycleThresholds['Drawer 1'];
 *   
 *   // Automatically monitor and alert
 *   useSensorAlertHandler(currentReading, drawer1Thresholds);
 *   
 *   return (
 *     <div>
 *       <h1>Dashboard</h1>
 *       {currentReading && (
 *         <div>
 *           <p>Temperature: {currentReading.temperature}°C</p>
 *           <p>Humidity: {currentReading.humidity}%</p>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 */
