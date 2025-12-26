import mongoose from "mongoose";

const larvaReadingSchema = new mongoose.Schema(
  {
    larvaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Larva",
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

larvaReadingSchema.index({ larvaId: 1, date: 1 }, { unique: true });

const LarvaReading = mongoose.model("LarvaReading", larvaReadingSchema);
export default LarvaReading;
