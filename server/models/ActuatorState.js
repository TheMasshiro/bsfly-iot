import mongoose from "mongoose";

const actuatorStateSchema = new mongoose.Schema(
  {
    actuatorId: {
      type: String,
      required: true,
      unique: true,
      // Format: "drawer1:fan", "drawer2:heater", "light", etc.
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      // Can be boolean (on/off) or object (e.g., { time: 300, startTime: timestamp })
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const ActuatorState = mongoose.model("ActuatorState", actuatorStateSchema);
export default ActuatorState;
