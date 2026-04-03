const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by Socket.io CORS"));
    },
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;
const DEFAULT_ROOM = "global";
const DIST_PATH = path.join(__dirname, "dist");
const MAX_ROOM_HISTORY = 30;

const onlineUsers = {};
const roomTypingUsers = {};
const roomHistories = {};

app.get("/", (_req, res) => {
  res.json({
    message: "Real-time chat server is running.",
    onlineUsers: Object.values(onlineUsers),
    allowedOrigins,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    roomCount: Object.keys(roomHistories).length,
  });
});

if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/socket.io")) {
      next();
      return;
    }

    res.sendFile(path.join(DIST_PATH, "index.html"));
  });
}

const emitOnlineUsers = () => {
  io.emit("online_users", Object.values(onlineUsers));
};

const emitTypingUsers = (room) => {
  const typingUsers = Array.from(roomTypingUsers[room] || []);
  io.to(room).emit("typing_users", typingUsers);
};

const addTypingUser = (room, username) => {
  if (!roomTypingUsers[room]) {
    roomTypingUsers[room] = new Set();
  }

  roomTypingUsers[room].add(username);
  emitTypingUsers(room);
};

const removeTypingUser = (room, username) => {
  if (!roomTypingUsers[room]) {
    return;
  }

  roomTypingUsers[room].delete(username);

  if (roomTypingUsers[room].size === 0) {
    delete roomTypingUsers[room];
  }

  emitTypingUsers(room);
};

const getRoomHistory = (room) => {
  if (!roomHistories[room]) {
    roomHistories[room] = [];
  }

  return roomHistories[room];
};

const rememberMessage = (room, message) => {
  const history = getRoomHistory(room);
  history.push(message);

  if (history.length > MAX_ROOM_HISTORY) {
    history.shift();
  }
};

const createMessage = ({ id, type, username, text, room, socketId }) => ({
  id,
  type,
  username,
  text,
  room,
  timestamp: new Date().toISOString(),
  socketId,
});

const broadcastMessage = (message) => {
  rememberMessage(message.room, message);
  io.to(message.room).emit("receive_message", message);
};

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join_room", ({ username, room = DEFAULT_ROOM }) => {
    const trimmedUsername = (username || "").trim();

    if (!trimmedUsername) {
      return;
    }

    if (socket.data.room) {
      socket.leave(socket.data.room);
      removeTypingUser(socket.data.room, socket.data.username);
    }

    socket.join(room);
    socket.data.username = trimmedUsername;
    socket.data.room = room;

    onlineUsers[socket.id] = {
      id: socket.id,
      username: trimmedUsername,
      room,
    };

    emitOnlineUsers();

    broadcastMessage(
      createMessage({
        id: `${socket.id}-${Date.now()}`,
        type: "system",
        text: `${trimmedUsername} joined the chat`,
        room,
      })
    );

    const history = getRoomHistory(room)
      .filter((item) => item.type === "chat" || item.type === "system")
      .slice(-12);

    if (history.length > 0) {
      socket.emit("chat_history", history);
    }
  });

  socket.on("send_message", ({ room = DEFAULT_ROOM, message }) => {
    const trimmedMessage = (message || "").trim();
    const username = socket.data.username;

    if (!trimmedMessage || !username) {
      return;
    }

    removeTypingUser(room, username);

    broadcastMessage(
      createMessage({
        id: `${socket.id}-${Date.now()}`,
        type: "chat",
        username,
        text: trimmedMessage,
        room,
        socketId: socket.id,
      })
    );
  });

  socket.on("typing", ({ room = DEFAULT_ROOM, username, isTyping }) => {
    const effectiveUsername = (username || socket.data.username || "").trim();

    if (!effectiveUsername) {
      return;
    }

    if (isTyping) {
      addTypingUser(room, effectiveUsername);
      return;
    }

    removeTypingUser(room, effectiveUsername);
  });

  socket.on("reset_chat", ({ room = DEFAULT_ROOM } = {}) => {
    const targetRoom = (room || DEFAULT_ROOM).trim() || DEFAULT_ROOM;
    const username = socket.data.username || "A user";

    roomHistories[targetRoom] = [];
    delete roomTypingUsers[targetRoom];
    emitTypingUsers(targetRoom);

    io.to(targetRoom).emit("chat_cleared", {
      room: targetRoom,
      by: username,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("disconnect", () => {
    const { username, room } = socket.data;

    if (username && room) {
      removeTypingUser(room, username);

      broadcastMessage(
        createMessage({
          id: `${socket.id}-${Date.now()}`,
          type: "system",
          text: `${username} left the chat`,
          room,
        })
      );
    }

    delete onlineUsers[socket.id];
    emitOnlineUsers();

    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
