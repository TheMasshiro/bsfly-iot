export const secondsToTime = (totalSeconds: number, includeLabel = true): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const remaining = totalSeconds % 3600;
  const minutes = Math.floor(remaining / 60);

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  const time = `${formattedHours}:${formattedMinutes}`;
  
  if (!includeLabel) {
    return time;
  }
  
  return hours < 1 ? `${time} minutes` : `${time} hours`;
};

export const displayTime = (seconds: number): string => {
  return secondsToTime(seconds, false);
};
