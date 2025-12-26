import mongoose from "mongoose";

const adultReadingSchema = new mongoose.Schema(
  {
    adultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Adult",
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

adultReadingSchema.index({ adultId: 1, date: 1 }, { unique: true });

const AdultReading = mongoose.model("AdultReading", adultReadingSchema);
export default AdultReading;
