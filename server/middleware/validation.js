import validator from "validator";

export const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return validator.escape(validator.trim(str));
};

export const isValidMacAddress = (mac) => {
  if (typeof mac !== "string") return false;
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
};

export const isValidDeviceName = (name) => {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
};

export const isValidJoinCode = (code) => {
  if (typeof code !== "string") return false;
  return /^[A-Z0-9]{8}$/i.test(code);
};

export const isValidUserId = (userId) => {
  if (typeof userId !== "string") return false;
  return userId.length > 0 && userId.length <= 100;
};

export const isValidSensorValue = (value, min = -50, max = 150) => {
  if (typeof value !== "number") return false;
  return !isNaN(value) && value >= min && value <= max;
};

export const isValidTemperature = (temp) => {
  return isValidSensorValue(temp, -10, 60);
};

export const isValidHumidity = (humidity) => {
  return isValidSensorValue(humidity, 0, 100);
};

export const isValidMoisture = (moisture) => {
  return isValidSensorValue(moisture, 0, 100);
};

export const isValidAmmonia = (ammonia) => {
  return isValidSensorValue(ammonia, 0, 500);
};

export const isValidActuatorState = (state) => {
  if (typeof state === "boolean") return true;
  if (typeof state === "object" && state !== null) return true;
  return false;
};

export const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (
        rules.required &&
        (value === undefined || value === null || value === "")
      ) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${field} must be a ${rules.type}`);
          continue;
        }

        if (rules.validator && !rules.validator(value)) {
          errors.push(rules.message || `${field} is invalid`);
        }

        if (typeof value === "string" && rules.sanitize !== false) {
          req.body[field] = sanitizeString(value);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(", ") });
    }

    next();
  };
};
