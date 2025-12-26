import mongoose from "mongoose";

const eggSchema = new mongoose.Schema(
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

const Egg = mongoose.model("Egg", eggSchema);
export default Egg;
