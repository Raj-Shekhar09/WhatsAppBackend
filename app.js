require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rt = require("./routes/rt");
const { Server } = require("socket.io");
const http = require("http");
const jwt = require("jsonwebtoken");


const JWT_SECRET = process.env.JWT_SECRET || 'your-secure-secret'; // Single definition
const PORT=process.env.PORT

// MongoDB connection (remove deprecated options)
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskportal")
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

// Message schema for persistence
const messageSchema = new mongoose.Schema({
  userId: String,
  name: String,
  message: String,
  dateTime: Date,
});
const Message = mongoose.model("Message", messageSchema);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [`http://localhost:5001`, `http://localhost:3000`],
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Socket.IO authentication middleware (single instance)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded; // Store user data (e.g., _id)
      next();
    } catch (err) {
      console.error("Socket auth error:", err.message);
      next(new Error("Invalid token"));
    }
  } else {
    next(new Error("Authentication required"));
  }
});

// Track connected sockets
const socketsConnected = new Set();

io.on("connection", (socket) => {
  console.log("Authenticated socket connected:", socket.id, socket.user._id);
  socketsConnected.add(socket.id);
  io.emit("clients-total", socketsConnected.size);

  socket.on("message", async (data) => {
    console.log("Broadcasting message from user:", socket.user._id, data);
    data.userId = socket.user._id;
    // Save message to MongoDB
    const message = new Message({
      userId: data.userId,
      name: data.name,
      message: data.message,
      dateTime: data.dateTime,
    });
    await message.save();
    socket.broadcast.emit("chat-message", data); // Broadcast to others
  });

  socket.on("feedback", (data) => {
    console.log("Feedback received:", data);
    io.emit("feedback", data); // Send to all (including sender for clear confirmation)
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    socketsConnected.delete(socket.id);
    io.emit("clients-total", socketsConnected.size);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

// Express middleware
app.use(express.json());

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5001", "http://localhost:YOUR_FRONTEND_PORT"],
  credentials: true,
}));
app.use("/", rt);

// Endpoint to fetch message history
app.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ dateTime: -1 }).limit(50);
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err.message);
    res.status(500).json({ msg: "Error fetching messages" });
  }
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));