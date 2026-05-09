import mongoose from "mongoose";

const actuatorEventSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
    actuator: { type: String, required: true },
    drawer: { type: String },
    parameter: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
    dataTime: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const ActuatorEvent = mongoose.model("ActuatorEvent", actuatorEventSchema);
export default ActuatorEvent;
