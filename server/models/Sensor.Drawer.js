import mongoose from "mongoose";

const drawerSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      ref: "Device",
      required: true,
    },

    name: {
      type: String,
      enum: ["Drawer 1", "Drawer 2", "Drawer 3"],
      required: true,
    },
  },
  { timestamps: true }
);

drawerSchema.index({ deviceId: 1, name: 1 }, { unique: true });

const Drawer = mongoose.model("Drawer", drawerSchema);
export default Drawer;
