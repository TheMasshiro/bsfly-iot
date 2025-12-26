import mongoose from "mongoose";

const larvaSchema = new mongoose.Schema(
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

const Larva = mongoose.model("Larva", larvaSchema);
export default Larva;
