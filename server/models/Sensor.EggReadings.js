import mongoose from "mongoose";

const eggReadingSchema = new mongoose.Schema(
  {
    eggId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Egg",
      required: true,
    },

    date: { type: Date, required: true },

    readings: [
      {
        timestamp: { type: Date, required: true },
        temperature: Number,
        humidity: Number,
        moisture: Number,
        light: Number,
        ammonia: Number,
      },
    ],
  },
  { timestamps: true }
);

eggReadingSchema.index({ eggId: 1, date: 1 }, { unique: true });

const EggReading = mongoose.model("EggReading", eggReadingSchema);
export default EggReading;
