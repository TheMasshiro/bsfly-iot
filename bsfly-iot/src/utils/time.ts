/**
 * Time Utilities
 * Functions for formatting and calculating time-related data
 */

/**
 * Format a date as relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (date: Date | string | null): string => {
  if (!date) return "Never";

  const targetDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();

  if (diffMs < 0) return "In the future";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  return targetDate.toLocaleDateString();
};

/**
 * Format uptime in seconds to human-readable format
 * e.g., 3661 seconds -> "1h 1m"
 */
export const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours === 0 && minutes === 0) return `${secs}s`;
  if (hours === 0) return `${minutes}m ${secs}s`;
  return `${hours}h ${minutes}m`;
};

/**
 * Check if cached data is stale
 */
export const isDataStale = (
  lastUpdate: Date | string | null | undefined,
  staleAfterMs: number
): boolean => {
  if (!lastUpdate) return true;

  const updateDate =
    typeof lastUpdate === "string" ? new Date(lastUpdate) : lastUpdate;
  const now = new Date();
  const diffMs = now.getTime() - updateDate.getTime();

  return diffMs > staleAfterMs;
};

/**
 * Get time until data becomes stale
 */
export const getTimeUntilStale = (
  lastUpdate: Date | string | null | undefined,
  staleAfterMs: number
): number => {
  if (!lastUpdate) return 0;

  const updateDate =
    typeof lastUpdate === "string" ? new Date(lastUpdate) : lastUpdate;
  const now = new Date();
  const diffMs = now.getTime() - updateDate.getTime();
  const remaining = staleAfterMs - diffMs;

  return Math.max(0, remaining);
};
