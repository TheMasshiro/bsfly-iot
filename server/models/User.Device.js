import mongoose from "mongoose";
import crypto from "crypto";

const deviceSchema = new mongoose.Schema(
  {
    macAddress: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    ownerId: {
      type: String,
      ref: "User",
      required: true,
    },

    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },
    controlMode: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
    },
    lastSeen: { type: Date },

    joinCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString("hex").toUpperCase(),
    },

    apiKey: {
      type: String,
      unique: true,
      sparse: true,
      default: () => crypto.randomBytes(32).toString("hex"),
    },

    members: [
      {
        userId: { type: String, ref: "User", required: true },
        joinedAt: { type: Date, default: Date.now },
        role: { type: String, enum: ["owner", "member"], default: "member" },
      },
    ],

    drawers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Drawer" }],

    ipAddress: {
      type: String,
      sparse: true,
    },
    hardwareInfo: {
      type: mongoose.Schema.Types.Mixed,
      sparse: true,
    },
    hardwareInfoCachedAt: { type: Date },
    mq137Ro: {
      type: Number,
      default: 3.6,
    },
    mq137LastCalibration: { type: Date },
    mq137EstimatedPpm: {
      type: Number,
      default: 0,
    },
    lastCalibrationTime: { type: Date, sparse: true },
  },
  { timestamps: true }
);

deviceSchema.index({ "members.userId": 1 });
deviceSchema.index({ status: 1, lastSeen: 1 });

deviceSchema.methods.regenerateJoinCode = function () {
  this.joinCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  return this.save();
};

deviceSchema.methods.regenerateApiKey = function () {
  this.apiKey = crypto.randomBytes(32).toString("hex");
  return this.save();
};

const Device = mongoose.model("Device", deviceSchema);
export default Device;
