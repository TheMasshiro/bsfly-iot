import axios, { AxiosRequestConfig } from "axios";

export const API_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("Unauthorized request");
    }
    return Promise.reject(error);
  }
);

export const withToken = (token: string | null): AxiosRequestConfig => ({
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

export const authFetch = async (
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${endpoint}`, { ...options, headers });
};
