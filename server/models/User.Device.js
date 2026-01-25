import mongoose from "mongoose";
import crypto from "crypto";

const deviceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // MAC address as ID
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
    lastSeen: { type: Date },

    // Join code for sharing device with other users
    joinCode: { 
      type: String, 
      unique: true,
      default: () => crypto.randomBytes(4).toString("hex").toUpperCase()
    },

    // Users who have joined this device (many users -> 1 device)
    members: [{
      userId: { type: String, ref: "User", required: true },
      joinedAt: { type: Date, default: Date.now },
      role: { type: String, enum: ["owner", "member"], default: "member" }
    }],

    drawers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Drawer" }],
  },
  { timestamps: true }
);

// Generate new join code
deviceSchema.methods.regenerateJoinCode = function() {
  this.joinCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  return this.save();
};

const Device = mongoose.model("Device", deviceSchema);
export default Device;
