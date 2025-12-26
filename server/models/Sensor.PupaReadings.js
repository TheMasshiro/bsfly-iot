import mongoose from "mongoose";

const pupaReadingSchema = new mongoose.Schema(
  {
    pupaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pupa",
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

pupaReadingSchema.index({ pupaId: 1, date: 1 }, { unique: true });

const PupaReading = mongoose.model("PupaReading", pupaReadingSchema);
export default PupaReading;
