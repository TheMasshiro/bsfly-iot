import mongoose from "mongoose";

const pupaSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      ref: "Device",
      required: true,
    },

    name: { type: String },
  },
  { timestamps: true }
);

const Pupa = mongoose.model("Pupa", pupaSchema);
export default Pupa;
