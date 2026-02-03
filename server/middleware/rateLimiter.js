import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const deviceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Too many device registrations, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const sensorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Rate limit exceeded" },
  standardHeaders: true,
  legacyHeaders: false,
});
