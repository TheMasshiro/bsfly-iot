import { io } from "socket.io-client";

const url = import.meta.env.VITE_BACKEND_URL;

if (!url) {
  console.warn("VITE_BACKEND_URL not configured. Socket connection may fail.");
}

export const socket = io(url || "", {
  autoConnect: !!url,
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});
