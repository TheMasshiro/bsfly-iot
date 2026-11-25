import axios, { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "../utils/api";
import { actuators, devices, history, hourly, members, reading } from "./data";

type Handler = (m: RegExpMatchArray, q: URLSearchParams, body: any) => unknown;

const routes: Array<[string, RegExp, Handler]> = [
  ["get", /^\/api\/devices\/user\/me$/, () => devices],
  ["get", /^\/api\/devices\/([^/]+)\/members$/, () => members],
  ["get", /^\/api\/devices\/([^/]+)\/api-key$/, () => ({ apiKey: "3f9a...c21e", note: "Masked." })],
  ["post", /^\/api\/devices\/([^/]+)\/regenerate-api-key$/, () => ({ apiKey: "3f9ad81c0b7e4a55e2d1f0c9b8a7e6d5c4b3a2918f7e6d5c4b3a29180f7ec21e" })],
  ["post", /^\/api\/devices\/([^/]+)\/regenerate-code$/, () => ({ joinCode: "K8D2LQ7W" })],
  ["post", /^\/api\/devices\/register$/, (_m, _q, b) => ({ ...devices[0], _id: "dev-new", name: b?.name, macAddress: b?.macAddress, apiKey: "9c1e" + "0".repeat(56) + "b7aa" })],
  ["post", /^\/api\/devices\/join$/, () => devices[1]],
  ["patch", /^\/api\/devices\/([^/]+)\/control-mode$/, (m, _q, b) => {
    const d = devices.find((x) => x._id === m[1]);
    if (d) d.controlMode = b?.mode;
    return d;
  }],
  ["get", /^\/api\/sensors\/device\/([^/]+)\/hourly$/, (_m, q) => hourly(q.get("drawer") ?? "Drawer 1")],
  ["get", /^\/api\/sensors\/device\/([^/]+)\/history$/, (_m, q) => history(q.get("from"), q.get("to"))],
  ["get", /^\/api\/sensors\/device\/([^/]+)$/, (_m, q) => reading(q.get("drawer") ?? "Drawer 1")],
  ["get", /^\/api\/actuators$/, () => actuators],
  ["get", /^\/api\/actuators\/([^/]+)$/, (m) => ({ actuatorId: m[1], state: actuators[decodeURIComponent(m[1])] ?? null })],
  ["post", /^\/api\/actuators\/([^/]+)$/, (m, _q, b) => {
    actuators[decodeURIComponent(m[1])] = b?.state;
    return { actuatorId: m[1], state: b?.state };
  }],
];

const params = new URLSearchParams(window.location.search);
if (params.has("scenario")) sessionStorage.setItem("demo-scenario", params.get("scenario") ?? "");
const scenario = sessionStorage.getItem("demo-scenario") ?? "";
if (scenario === "empty") devices.splice(0, devices.length);
if (scenario === "nodata") Object.keys(actuators).forEach((k) => delete actuators[k]);

const blank = (pathname: string) => {
  if (/\/hourly$/.test(pathname)) return Array.from({ length: 24 }, (_, i) => ({ hour: new Date(Date.now() - (23 - i) * 3.6e6).toISOString(), temperature: null, humidity: null, moisture: null, leftSubstrate: null, centerSubstrate: null, rightSubstrate: null, ammonia: null }));
  if (/\/history$/.test(pathname)) return [];
  return { temperature: null, humidity: null, moisture: null, leftSubstrate: null, centerSubstrate: null, rightSubstrate: null, ammonia: null };
};

const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const url = new URL((config.baseURL ?? "") + (config.url ?? ""), "http://demo.local");
  const method = (config.method ?? "get").toLowerCase();
  const body = typeof config.data === "string" ? JSON.parse(config.data || "null") : config.data;
  await new Promise((r) => setTimeout(r, 120));
  if (scenario === "error" && url.pathname.startsWith("/api/")) {
    return Promise.reject(Object.assign(new Error("Request failed with status code 500"), { isAxiosError: true, config, response: { status: 500, data: { error: "Internal server error" }, config, headers: {}, statusText: "Error" } }));
  }
  if (scenario === "nodata" && url.pathname.startsWith("/api/sensors/")) {
    return { data: blank(url.pathname), status: 200, statusText: "OK", headers: {}, config } as AxiosResponse;
  }
  for (const [verb, pattern, handler] of routes) {
    const m = url.pathname.match(pattern);
    if (verb === method && m) {
      return { data: handler(m, url.searchParams, body), status: 200, statusText: "OK", headers: {}, config } as AxiosResponse;
    }
  }
  return { data: {}, status: 200, statusText: "OK", headers: {}, config } as AxiosResponse;
};

api.defaults.adapter = adapter;
axios.defaults.adapter = adapter;
