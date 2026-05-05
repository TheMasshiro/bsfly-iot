import mongoose from "mongoose";

const actuatorStateSchema = new mongoose.Schema(
  {
    actuatorId: {
      type: String,
      required: true,
      unique: true,
    },
    state: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
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
