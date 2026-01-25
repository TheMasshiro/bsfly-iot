import mongoose from "mongoose";

const drawerReadingSchema = new mongoose.Schema(
  {
    drawerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drawer",
      required: true,
    },

    date: { type: Date, required: true },

    readings: [
      {
        timestamp: { type: Date, required: true },
        temperature: Number,
        humidity: Number,
        moisture: Number,
        ammonia: Number,
      },
    ],
  },
  { timestamps: true }
);

drawerReadingSchema.index({ drawerId: 1, date: 1 }, { unique: true });

const DrawerReading = mongoose.model("DrawerReading", drawerReadingSchema);
export default DrawerReading;
