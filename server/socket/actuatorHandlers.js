export function registerActuatorHandlers(_io, socket) {
  console.log(`User Connected: ${socket.id}`);

  // Drawer 1 actuators
  socket.on("drawer1:fan", (data) => {
    console.log("Drawer 1 Fan:", data);
    socket.broadcast.emit("drawer1:fan:response", data);
  });

  socket.on("drawer1:heater", (data) => {
    console.log("Drawer 1 Heater:", data);
    socket.broadcast.emit("drawer1:heater:response", data);
  });

  socket.on("drawer1:humidifier", (data) => {
    console.log("Drawer 1 Humidifier:", data);
    socket.broadcast.emit("drawer1:humidifier:response", data);
  });

  socket.on("drawer1:dehumidifier", (data) => {
    console.log("Drawer 1 Dehumidifier:", data);
    socket.broadcast.emit("drawer1:dehumidifier:response", data);
  });

  socket.on("drawer1:misting", (data) => {
    console.log("Drawer 1 Misting:", data);
    socket.broadcast.emit("drawer1:misting:response", data);
  });

  // Drawer 2 actuators
  socket.on("drawer2:fan", (data) => {
    console.log("Drawer 2 Fan:", data);
    socket.broadcast.emit("drawer2:fan:response", data);
  });

  socket.on("drawer2:heater", (data) => {
    console.log("Drawer 2 Heater:", data);
    socket.broadcast.emit("drawer2:heater:response", data);
  });

  socket.on("drawer2:humidifier", (data) => {
    console.log("Drawer 2 Humidifier:", data);
    socket.broadcast.emit("drawer2:humidifier:response", data);
  });

  socket.on("drawer2:dehumidifier", (data) => {
    console.log("Drawer 2 Dehumidifier:", data);
    socket.broadcast.emit("drawer2:dehumidifier:response", data);
  });

  socket.on("drawer2:misting", (data) => {
    console.log("Drawer 2 Misting:", data);
    socket.broadcast.emit("drawer2:misting:response", data);
  });

  // Drawer 3 actuators
  socket.on("drawer3:fan", (data) => {
    console.log("Drawer 3 Fan:", data);
    socket.broadcast.emit("drawer3:fan:response", data);
  });

  socket.on("drawer3:heater", (data) => {
    console.log("Drawer 3 Heater:", data);
    socket.broadcast.emit("drawer3:heater:response", data);
  });

  socket.on("drawer3:humidifier", (data) => {
    console.log("Drawer 3 Humidifier:", data);
    socket.broadcast.emit("drawer3:humidifier:response", data);
  });

  socket.on("drawer3:dehumidifier", (data) => {
    console.log("Drawer 3 Dehumidifier:", data);
    socket.broadcast.emit("drawer3:dehumidifier:response", data);
  });

  socket.on("light", (data) => {
    console.log("Light:", data);
    socket.broadcast.emit("light:response", data);
  });

  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
  });
}
