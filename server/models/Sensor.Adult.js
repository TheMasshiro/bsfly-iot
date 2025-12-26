import mongoose from "mongoose";

const adultSchema = new mongoose.Schema(
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

const Adult = mongoose.model("Adult", adultSchema);
export default Adult;
