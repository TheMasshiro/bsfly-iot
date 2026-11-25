import { randomBytes, randomUUID } from "node:crypto";
import {
  bigserial,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const controlMode = pgEnum("control_mode", ["auto", "manual"]);

export const newJoinCode = () => randomBytes(4).toString("hex").toUpperCase();
export const newApiKey = () => randomBytes(32).toString("hex");

const tz = (name) => timestamp(name, { withTimezone: true });

const timestamps = {
  createdAt: tz("created_at").notNull().defaultNow(),
  updatedAt: tz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  ...timestamps,
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  macAddress: text("mac_address").notNull().unique(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  controlMode: controlMode("control_mode").notNull().default("auto"),
  lastSeen: tz("last_seen"),
  ipAddress: text("ip_address"),
  joinCode: text("join_code").notNull().unique().$defaultFn(newJoinCode),
  apiKeyHash: text("api_key_hash").notNull(),
  apiKeyHint: text("api_key_hint").notNull(),
  ...timestamps,
});

export const deviceMembers = pgTable(
  "device_members",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: tz("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.userId] }), index("device_members_user_idx").on(t.userId)],
);

export const drawers = pgTable(
  "drawers",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [unique("drawers_device_name_unique").on(t.deviceId, t.name)],
);

export const readings = pgTable(
  "readings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    drawerId: text("drawer_id")
      .notNull()
      .references(() => drawers.id, { onDelete: "cascade" }),
    recordedAt: tz("recorded_at").notNull(),
    temperature: real("temperature"),
    humidity: real("humidity"),
    moisture: real("moisture"),
    leftSubstrate: real("left_substrate"),
    centerSubstrate: real("center_substrate"),
    rightSubstrate: real("right_substrate"),
    ammonia: real("ammonia"),
  },
  (t) => [index("readings_drawer_time_idx").on(t.drawerId, t.recordedAt)],
);

export const actuatorStates = pgTable(
  "actuator_states",
  {
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    actuator: text("actuator").notNull(),
    state: jsonb("state").notNull(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.deviceId, t.actuator] })],
);

export const actuatorEvents = pgTable(
  "actuator_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    actuator: text("actuator").notNull(),
    drawer: text("drawer"),
    parameter: text("parameter"),
    value: jsonb("value"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [index("actuator_events_device_time_idx").on(t.deviceId, t.createdAt)],
);
