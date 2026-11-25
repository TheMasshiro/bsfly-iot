import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const limiter = (windowMs, limit, extra = {}) =>
  rateLimit({
    windowMs,
    limit,
    message: { error: "Too many requests, please try again later" },
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...extra,
  });

export const apiLimiter = limiter(15 * 60_000, 1000);
export const authLimiter = limiter(15 * 60_000, 20);
export const deviceLimiter = limiter(60 * 60_000, 10);
export const sensorLimiter = limiter(60_000, 240, {
  keyGenerator: (req) => req.device?.macAddress ?? ipKeyGenerator(req.ip),
});
