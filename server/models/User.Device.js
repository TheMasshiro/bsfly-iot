import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: {
      type: String,
      ref: "User",
      required: true,
    },

    name: { type: String, required: true },
    espSocketId: { type: String },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },

    pairingCode: { type: String },
    pairedAt: { type: Date },

    drawers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Drawer" }],
  },
  { timestamps: true }
);

const Device = mongoose.model("Device", deviceSchema);
export default Device;
