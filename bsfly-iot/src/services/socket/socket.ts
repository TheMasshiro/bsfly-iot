import { io } from "socket.io-client";

const url = import.meta.env.vite_backend_url;

export const socket = io(url);
