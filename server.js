const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;
const DEFAULT_ROOM = "global";
const DIST_PATH = path.join(__dirname, "dist");
const BOT_NAME = "Nova AI";
const MAX_ROOM_HISTORY = 30;

const onlineUsers = {};
const roomTypingUsers = {};
const roomHistories = {};

app.get("/", (_req, res) => {
  res.json({
    message: "Real-time chat server is running.",
    onlineUsers: Object.values(onlineUsers),
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

const getRecentChatMessages = (room, count = 6) =>
  getRoomHistory(room)
    .filter((item) => item.type === "chat")
    .slice(-count);

const summarizeRecentTopics = (room) => {
  const recent = getRecentChatMessages(room, 5).filter(
    (item) => item.username !== BOT_NAME
  );

  if (recent.length === 0) {
    return "The room is still quiet, so this is a good time to start a new thread.";
  }

  const latest = recent[recent.length - 1];
  const participants = [...new Set(recent.map((item) => item.username))];

  return `Right now ${participants.join(", ")} ${
    participants.length === 1 ? "is" : "are"
  } discussing "${latest.text}".`;
};

const detectIntent = (message) => {
  const normalized = message.toLowerCase();

  if (/(^|\b)(hi|hello|hey|hola)\b/.test(normalized)) {
    return "greeting";
  }

  if (/(how are you|how r u|how are u)/.test(normalized)) {
    return "wellbeing";
  }

  if (/(summary|summarize|quick summary|recap)/.test(normalized)) {
    return "summary";
  }

  if (/(ui improvement|design improvement|improve the ui|frontend improvement)/.test(normalized)) {
    return "ui_improvements";
  }

  if (/(private room|room support|multiple room|chat room)/.test(normalized)) {
    return "private_rooms";
  }

  if (/(welcome message|intro message)/.test(normalized)) {
    return "welcome_message";
  }

  if (/(thanks|thank you|thx)/.test(normalized)) {
    return "gratitude";
  }

  if (/\?$/.test(normalized) || /how|what|why|can|should/.test(normalized)) {
    return "question";
  }

  return "general";
};

const buildReplyByIntent = ({ room, username, message, intent }) => {
  const currentUsers = Object.values(onlineUsers)
    .filter((user) => user.room === room)
    .map((user) => user.username);
  const recentTopics = summarizeRecentTopics(room);

  switch (intent) {
    case "greeting":
      return `Hey ${username}, glad you're here. ${currentUsers.length} user${
        currentUsers.length === 1 ? "" : "s"
      } ${currentUsers.length === 1 ? "is" : "are"} online in ${room}, and I can help keep the conversation moving.`;
    case "wellbeing":
      return `I'm doing well, ${username}. The chat server is healthy, sockets are live, and the room context is updating correctly.`;
    case "summary":
      return `Quick summary: ${recentTopics}`;
    case "ui_improvements":
      return "Three solid UI upgrades would be: add room tabs with unread badges, introduce reactions for lightweight feedback, and show message grouping for consecutive posts by the same user.";
    case "private_rooms":
      return "For private rooms, create room ids on the server, let users join a selected room instead of only 'global', store room-specific history, and scope online user lists plus typing events to the active room.";
    case "welcome_message":
      return "Welcome everyone to the real-time chat room. Jump in, share updates, ask questions, and enjoy the live conversation experience together.";
    case "gratitude":
      return `You're welcome, ${username}. If you want, I can keep helping with architecture ideas, feature suggestions, or testing flows.`;
    case "question":
      return `Good question. Based on the current room context, I'd approach it this way: keep the real-time events lightweight, store recent history per room, and make each response clearly tied to the latest user intent.`;
    default:
      return `I picked up your message: "${message}". ${recentTopics}`;
  }
};

const buildAiReply = ({ room, username, message }) => {
  const intent = detectIntent(message);
  return buildReplyByIntent({ room, username, message, intent });
};

const getTypingDelay = (text) => {
  const baseDelay = 850;
  const readingDelay = text.length * 12;
  return Math.min(2600, Math.max(baseDelay, baseDelay + readingDelay));
};

const emitAiReply = ({ room, username, message }) => {
  const response = buildAiReply({ room, username, message });
  const delay = getTypingDelay(response);

  addTypingUser(room, BOT_NAME);

  setTimeout(() => {
    removeTypingUser(room, BOT_NAME);

    broadcastMessage(
      createMessage({
        id: `bot-${Date.now()}`,
        type: "chat",
        username: BOT_NAME,
        text: response,
        room,
        socketId: "bot",
      })
    );
  }, delay);
};

const emitBotGreeting = (room, username) => {
  const greeting = `Welcome ${username}. You're connected to the ${room} room now. Ask a question, start a topic, or use one of the quick suggestions to keep the conversation going.`;

  addTypingUser(room, BOT_NAME);

  setTimeout(() => {
    removeTypingUser(room, BOT_NAME);

    broadcastMessage(
      createMessage({
        id: `bot-welcome-${Date.now()}`,
        type: "chat",
        username: BOT_NAME,
        text: greeting,
        room,
        socketId: "bot",
      })
    );
  }, 1000);
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

    emitBotGreeting(room, trimmedUsername);
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

    if (username !== BOT_NAME) {
      emitAiReply({ room, username, message: trimmedMessage });
    }
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
