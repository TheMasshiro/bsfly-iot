export const secondsToTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  if (hours < 1) {
    return `${formattedHours}:${formattedMinutes} minutes`;
  }
  return `${formattedHours}:${formattedMinutes} hours`;
};

export const displayTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");

  if (hours < 1) {
    return `${formattedHours}:${formattedMinutes}`;
  }
  return `${formattedHours}:${formattedMinutes}`;
};
