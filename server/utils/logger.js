/**
 * Logger Utility
 * Centralized logging with structured format including timestamp, level, and context
 */

const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

const isDevelopment = process.env.NODE_ENV !== "production";

const formatLog = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length
    ? ` | ${JSON.stringify(context)}`
    : "";
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
};

const logger = {
  debug: (message, context) => {
    if (isDevelopment) {
      console.debug(formatLog(LOG_LEVELS.DEBUG, message, context));
    }
  },

  info: (message, context) => {
    console.log(formatLog(LOG_LEVELS.INFO, message, context));
  },

  warn: (message, context) => {
    console.warn(formatLog(LOG_LEVELS.WARN, message, context));
  },

  error: (message, context) => {
    console.error(formatLog(LOG_LEVELS.ERROR, message, context));
  },
};

export default logger;
