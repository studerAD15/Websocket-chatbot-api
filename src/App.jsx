import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CircleRoundedIcon from "@mui/icons-material/CircleRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import NightlifeRoundedIcon from "@mui/icons-material/NightlifeRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import StarsRoundedIcon from "@mui/icons-material/StarsRounded";

const getDefaultSocketUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  const { hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000";
  }

  return "https://websocket-chatbot-api.onrender.com";
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getDefaultSocketUrl();
const ROOM = "global";

const noiseBackground =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E\")";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#14b8a6",
      dark: "#0f766e",
    },
    secondary: {
      main: "#ec4899",
    },
    background: {
      default: "#090b16",
      paper: "#15182b",
    },
    text: {
      primary: "#f8fafc",
      secondary: "#b8bfd6",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif',
    h3: {
      fontWeight: 800,
      letterSpacing: "-0.05em",
    },
    h4: {
      fontWeight: 800,
      letterSpacing: "-0.04em",
    },
    h6: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
});

const socket = io(SOCKET_URL, {
  autoConnect: false,
});

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

function App() {
  const [usernameInput, setUsernameInput] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hoverSend, setHoverSend] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!username) {
      return undefined;
    }

    socket.connect();
    socket.emit("join_room", { username, room: ROOM });

    const handleMessage = (incomingMessage) => {
      setMessages((prev) => [...prev, incomingMessage]);
    };

    const handleOnlineUsers = (users) => {
      setOnlineUsers(users.filter((user) => user.room === ROOM));
    };

    const handleChatHistory = (history) => {
      setMessages(history);
    };

    const handleTypingUsers = (users) => {
      setTypingUsers(users.filter((name) => name !== username));
    };

    socket.on("receive_message", handleMessage);
    socket.on("online_users", handleOnlineUsers);
    socket.on("chat_history", handleChatHistory);
    socket.on("typing_users", handleTypingUsers);

    return () => {
      socket.emit("typing", { room: ROOM, username, isTyping: false });
      socket.off("receive_message", handleMessage);
      socket.off("online_users", handleOnlineUsers);
      socket.off("chat_history", handleChatHistory);
      socket.off("typing_users", handleTypingUsers);
      socket.disconnect();
    };
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const typingLabel = useMemo(() => {
    if (typingUsers.length === 0) {
      return "";
    }

    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    }

    return `${typingUsers.slice(0, 2).join(", ")} are typing...`;
  }, [typingUsers]);

  const messageCount = messages.filter((item) => item.type === "chat").length;
  const recentMessages = messages.filter((item) => item.type === "chat").slice(-3);

  const stopTyping = () => {
    if (!username) {
      return;
    }

    socket.emit("typing", { room: ROOM, username, isTyping: false });
  };

  const handleJoinChat = () => {
    const trimmedUsername = usernameInput.trim();

    if (!trimmedUsername) {
      return;
    }

    setUsername(trimmedUsername);
  };

  const handleTyping = (value) => {
    setMessage(value);

    if (!username) {
      return;
    }

    socket.emit("typing", { room: ROOM, username, isTyping: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const sendText = (rawMessage = message) => {
    const trimmedMessage = rawMessage.trim();

    if (!trimmedMessage || !username) {
      return false;
    }

    socket.emit("send_message", { room: ROOM, message: trimmedMessage });
    setMessage("");
    stopTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    return true;
  };

  const handleSendMessage = () => {
    sendText(message);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!username) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: "100vh",
            position: "relative",
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            px: 2,
            py: 5,
            background:
              "linear-gradient(135deg, #0b1026 0%, #18163a 28%, #2a1742 54%, #102f3c 100%)",
            "& .noise-layer": {
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.18,
              backgroundImage: noiseBackground,
              mixBlendMode: "soft-light",
            },
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "auto auto 8% -10%",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(20,184,166,0.32) 0%, rgba(20,184,166,0) 70%)",
              animation: "floatOrb 10s ease-in-out infinite",
              filter: "blur(12px)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              inset: "8% -6% auto auto",
              width: 420,
              height: 420,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(236,72,153,0.28) 0%, rgba(236,72,153,0) 72%)",
              animation: "floatOrb 14s ease-in-out infinite reverse",
              filter: "blur(16px)",
            },
            "@keyframes floatOrb": {
              "0%": { transform: "translateY(0px)" },
              "50%": { transform: "translateY(-20px)" },
              "100%": { transform: "translateY(0px)" },
            },
          }}
        >
          <Box className="noise-layer" />
          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            <Paper
              elevation={0}
              sx={{
                overflow: "visible",
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 36px 120px rgba(0, 0, 0, 0.35)",
                backdropFilter: "blur(24px)",
                background:
                  "linear-gradient(180deg, rgba(17,18,39,0.74) 0%, rgba(17,24,39,0.56) 100%)",
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  borderRadius: "inherit",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                  pointerEvents: "none",
                },
              }}
            >
              <Stack direction={{ xs: "column", md: "row" }}>
                <Box
                  sx={{
                    width: { xs: "100%", md: "50%" },
                    px: { xs: 3, sm: 5, md: 6 },
                    py: { xs: 4, md: 6 },
                    color: "white",
                    background:
                      "linear-gradient(155deg, rgba(124,58,237,0.9) 0%, rgba(236,72,153,0.78) 42%, rgba(20,184,166,0.72) 100%)",
                    position: "relative",
                    overflow: "visible",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      inset: "auto -14% -18% auto",
                      width: 220,
                      height: 220,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  <Chip
                    icon={<BoltRoundedIcon />}
                    label="Socket.io Powered"
                    sx={{
                      mb: 3,
                      color: "white",
                      bgcolor: alpha("#ffffff", 0.12),
                      border: "1px solid rgba(255,255,255,0.14)",
                      ".MuiChip-icon": { color: "#fde68a" },
                    }}
                  />
                  <Typography variant="h3" sx={{ maxWidth: 420 }}>
                    Real-time conversations with cinematic polish.
                  </Typography>
                  <Typography sx={{ mt: 2, maxWidth: 440, opacity: 0.84 }}>
                    Ambient glow, glass surfaces, fast presence updates, and a
                    bold chat experience built to feel live from the first
                    message.
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{ mt: 4 }}
                  >
                    <Chip
                      icon={<ForumRoundedIcon />}
                      label="Live messaging"
                      sx={{
                        color: "white",
                        bgcolor: alpha("#ffffff", 0.1),
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Chip
                      icon={<GroupsRoundedIcon />}
                      label="Presence tracking"
                      sx={{
                        color: "white",
                        bgcolor: alpha("#ffffff", 0.1),
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Chip
                      icon={<NightlifeRoundedIcon />}
                      label="Typing states"
                      sx={{
                        color: "white",
                        bgcolor: alpha("#ffffff", 0.1),
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                  </Stack>
                </Box>

                <Box
                  sx={{
                    width: { xs: "100%", md: "50%" },
                    px: { xs: 3, sm: 5, md: 6 },
                    py: { xs: 4, md: 6 },
                    display: "flex",
                    alignItems: "center",
                    background:
                      "linear-gradient(180deg, rgba(10,13,28,0.65) 0%, rgba(16,18,33,0.55) 100%)",
                  }}
                >
                  <Stack spacing={3} sx={{ width: "100%" }}>
                    <Box>
                      <Typography variant="overline" color="#99f6e4">
                        Login Screen
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 1 }}>
                        Enter chat with your username
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1.5 }}>
                        Pick a display name and step into the shared global room
                        to chat in real time.
                      </Typography>
                    </Box>

                    <TextField
                      label="Username"
                      fullWidth
                      value={usernameInput}
                      onChange={(event) => setUsernameInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleJoinChat();
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Avatar
                              sx={{
                                width: 34,
                                height: 34,
                                bgcolor: alpha("#14b8a6", 0.18),
                                color: "#99f6e4",
                                fontSize: "0.9rem",
                                fontWeight: 800,
                              }}
                            >
                              {getInitials(usernameInput)}
                            </Avatar>
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 4,
                          bgcolor: alpha("#091120", 0.42),
                          color: "white",
                        },
                        "& .MuiInputLabel-root": {
                          color: alpha("#ffffff", 0.75),
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: alpha("#ffffff", 0.15),
                        },
                      }}
                    />

                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleJoinChat}
                      endIcon={<SendRoundedIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 999,
                        background:
                          "linear-gradient(135deg, #7c3aed 0%, #ec4899 52%, #14b8a6 100%)",
                        boxShadow: "0 18px 40px rgba(124,58,237,0.32)",
                      }}
                    >
                      Enter Chat
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          py: { xs: 2, md: 4 },
          background:
            "linear-gradient(180deg, #090b16 0%, #111528 40%, #101f2d 100%)",
          "& .noise-layer": {
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.18,
            backgroundImage: noiseBackground,
            mixBlendMode: "soft-light",
          },
          "&::before": {
            content: '""',
            position: "absolute",
            inset: "-15% auto auto -8%",
            width: 240,
            height: 240,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.24) 0%, rgba(124,58,237,0) 72%)",
            filter: "blur(26px)",
            opacity: 0.55,
          },
          "&::after": {
            content: '""',
            position: "absolute",
            inset: "auto -10% -12% auto",
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(20,184,166,0.2) 0%, rgba(20,184,166,0) 72%)",
            filter: "blur(30px)",
            opacity: 0.5,
          },
        }}
      >
        <Box className="noise-layer" />
        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
          <Paper
            elevation={0}
            sx={{
              overflow: "visible",
              borderRadius: 3,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 30px 120px rgba(0, 0, 0, 0.38)",
              background:
                "linear-gradient(180deg, rgba(13,16,33,0.7) 0%, rgba(13,18,35,0.52) 100%)",
              backdropFilter: "blur(28px)",
              position: "relative",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
                pointerEvents: "none",
              },
            }}
          >
            <Stack direction={{ xs: "column", lg: "row" }} sx={{ minHeight: "90vh" }}>
              <Box
                sx={{
                  width: { xs: "100%", lg: 360 },
                  p: { xs: 2.5, md: 3.5 },
                  color: "white",
                  background:
                    "linear-gradient(180deg, rgba(35,18,71,0.92) 0%, rgba(50,23,86,0.9) 24%, rgba(7,69,92,0.86) 100%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  position: "relative",
                  overflow: "visible",
                  "&::after": {
                      content: '""',
                      position: "absolute",
                    right: -90,
                    bottom: -90,
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.04)",
                    filter: "blur(10px)",
                  },
                }}
              >
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.72 }}>
                    Connected as
                  </Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                    <Avatar
                      sx={{
                        width: 56,
                        height: 56,
                        bgcolor: alpha("#ffffff", 0.18),
                        fontWeight: 800,
                        fontSize: "1.15rem",
                      }}
                    >
                      {getInitials(username)}
                    </Avatar>
                    <Box>
                      <Typography variant="h5">{username}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircleRoundedIcon
                          sx={{
                            fontSize: 12,
                            color: "#2dd4bf",
                            animation: "statusPulse 1.6s ease-in-out infinite",
                            "@keyframes statusPulse": {
                              "0%": { transform: "scale(0.9)", opacity: 0.55 },
                              "50%": { transform: "scale(1.35)", opacity: 1 },
                              "100%": { transform: "scale(0.9)", opacity: 0.55 },
                            },
                          }}
                        />
                        <Typography variant="body2" sx={{ opacity: 0.85 }}>
                          Active now
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 5,
                    color: "white",
                    bgcolor: alpha("#ffffff", 0.08),
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.7 }}>
                        Online users
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 0.75 }}>
                        {onlineUsers.length}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography variant="body2" sx={{ opacity: 0.7 }}>
                        Messages
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 0.75 }}>
                        {messageCount}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                <Stack direction="row" spacing={1.25}>
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      p: 1.6,
                      borderRadius: 4,
                      color: "white",
                      bgcolor: alpha("#ffffff", 0.08),
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StarsRoundedIcon sx={{ color: "#fde68a" }} />
                      <Box>
                        <Typography variant="caption" sx={{ opacity: 0.72 }}>
                          Room vibe
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          Energetic
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      p: 1.6,
                      borderRadius: 4,
                      color: "white",
                      bgcolor: alpha("#ffffff", 0.08),
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <NotificationsActiveRoundedIcon sx={{ color: "#86efac" }} />
                      <Box>
                        <Typography variant="caption" sx={{ opacity: 0.72 }}>
                          Status
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          Live sync
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Stack>

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <GroupsRoundedIcon fontSize="small" />
                    <Typography variant="h6">Online Users</Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    flexWrap="wrap"
                    gap={1}
                    sx={{ maxHeight: { xs: "none", lg: 320 }, overflowY: "auto" }}
                  >
                    {onlineUsers.map((user) => (
                      <Chip
                        key={user.id}
                        avatar={
                          <Avatar sx={{ bgcolor: alpha("#ffffff", 0.14) }}>
                            {getInitials(user.username)}
                          </Avatar>
                        }
                        label={user.username}
                        sx={{
                          color: "white",
                          bgcolor: alpha("#ffffff", 0.08),
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      />
                    ))}
                  </Stack>
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 5,
                    color: "white",
                    bgcolor: alpha("#081a18", 0.2),
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.2 }}>
                    Recent Activity
                  </Typography>
                  {recentMessages.length === 0 ? (
                    <Typography variant="body2" sx={{ opacity: 0.78 }}>
                      The room is waiting for its first message.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {recentMessages.map((item) => (
                        <Box key={item.id}>
                          <Typography variant="caption" sx={{ opacity: 0.72 }}>
                            {item.username} - {formatTime(item.timestamp)}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.25,
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                            }}
                          >
                            {item.text}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Box>

              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    px: { xs: 2.5, md: 3.5 },
                    py: 2.5,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    bgcolor: alpha("#ffffff", 0.03),
                    color: "text.primary",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Box>
                      <Typography variant="overline" color="#99f6e4">
                        Real-Time Chat Dashboard
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5 }}>
                        Global Chat Room
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        Instant messaging, presence tracking, and typing updates
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        icon={<BoltRoundedIcon />}
                        label="Socket Live"
                        sx={{
                          bgcolor: alpha("#7c3aed", 0.12),
                          color: "#d8b4fe",
                          border: "1px solid rgba(216,180,254,0.16)",
                        }}
                      />
                      <Chip
                        label={`${onlineUsers.length} online`}
                        sx={{
                          bgcolor: alpha("#14b8a6", 0.1),
                          color: "#99f6e4",
                          border: "1px solid rgba(153,246,228,0.16)",
                        }}
                      />
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    sx={{ mt: 2 }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 4,
                        bgcolor: alpha("#ffffff", 0.03),
                        border: "1px solid rgba(255,255,255,0.05)",
                        color: "text.primary",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Shared room
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.35 }}>
                        Collaboration space for everyone online
                      </Typography>
                    </Paper>
                    <Paper
                      elevation={0}
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 4,
                        bgcolor: alpha("#ffffff", 0.03),
                        border: "1px solid rgba(255,255,255,0.05)",
                        color: "text.primary",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Real-time state
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.35 }}>
                        Messages, users, and typing stay in sync instantly
                      </Typography>
                    </Paper>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    px: { xs: 2, md: 3.5 },
                    py: 2.5,
                    overflowY: "auto",
                    overflowX: "hidden",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                  }}
                >
                  {messages.length === 0 && (
                    <Paper
                      elevation={0}
                      sx={{
                        mb: 2.5,
                        p: { xs: 2.2, md: 3 },
                        borderRadius: 6,
                        background:
                          "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(236,72,153,0.08) 50%, rgba(20,184,166,0.08) 100%)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "text.primary",
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                      >
                        <Box>
                          <Typography variant="h6">Start the conversation</Typography>
                          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 520 }}>
                            Send the first message to bring this room to life. Join and leave
                            events, online users, and typing updates will appear here in real time.
                          </Typography>
                        </Box>
                        <Avatar
                          sx={{
                            width: 60,
                            height: 60,
                            bgcolor: alpha("#14b8a6", 0.12),
                            color: "#99f6e4",
                          }}
                        >
                          <ForumRoundedIcon />
                        </Avatar>
                      </Stack>
                    </Paper>
                  )}
                  <List sx={{ p: 0 }}>
                    {messages.map((msg) => {
                      const isMine = msg.username === username;
                      const isSystem = msg.type === "system";

                      if (isSystem) {
                        return (
                          <ListItem key={msg.id} sx={{ justifyContent: "center", px: 0 }}>
                            <Paper
                              elevation={0}
                              sx={{
                                px: 2,
                                py: 0.9,
                                borderRadius: 999,
                                bgcolor: alpha("#ffffff", 0.05),
                                color: "text.secondary",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <Typography variant="caption">
                                {msg.text} - {formatTime(msg.timestamp)}
                              </Typography>
                            </Paper>
                          </ListItem>
                        );
                      }

                      return (
                        <ListItem
                          key={msg.id}
                          alignItems="flex-start"
                          sx={{
                            justifyContent: isMine ? "flex-end" : "flex-start",
                            px: 0,
                            py: 1.1,
                            animation:
                              "messageSpring 520ms cubic-bezier(0.22, 1.18, 0.36, 1)",
                            "@keyframes messageSpring": {
                              "0%": {
                                opacity: 0,
                                transform: "translateY(24px) scale(0.96)",
                              },
                              "70%": {
                                opacity: 1,
                                transform: "translateY(-4px) scale(1.01)",
                              },
                              "100%": {
                                opacity: 1,
                                transform: "translateY(0) scale(1)",
                              },
                            },
                          }}
                        >
                          <Stack
                            direction={isMine ? "row-reverse" : "row"}
                            spacing={1.5}
                            sx={{ maxWidth: { xs: "94%", md: "80%" } }}
                          >
                            <ListItemAvatar sx={{ minWidth: "auto", mt: 0.3 }}>
                              <Avatar
                                sx={{
                                  width: 42,
                                  height: 42,
                                  fontWeight: 800,
                                  bgcolor: isMine ? "secondary.main" : "primary.main",
                                }}
                              >
                                {getInitials(msg.username)}
                              </Avatar>
                            </ListItemAvatar>

                            <Paper
                              elevation={0}
                              sx={{
                                px: 2.25,
                                py: 1.5,
                                borderRadius: isMine
                                  ? "16px 16px 4px 16px"
                                  : "16px 16px 16px 4px",
                                background: isMine
                                  ? "linear-gradient(135deg, #7c3aed 0%, #ec4899 55%, #14b8a6 100%)"
                                  : alpha("#ffffff", 0.08),
                                color: isMine ? "white" : "text.primary",
                                border: isMine
                                  ? "1px solid rgba(255,255,255,0.1)"
                                  : "1px solid rgba(255,255,255,0.06)",
                                boxShadow: isMine
                                  ? "0 18px 36px rgba(124,58,237,0.28)"
                                  : "0 12px 28px rgba(0,0,0,0.18)",
                                backdropFilter: "blur(12px)",
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems="center"
                                    sx={{ mb: 0.5 }}
                                  >
                                    <Typography
                                      variant="subtitle2"
                                      sx={{
                                        fontWeight: 800,
                                        color: isMine ? "white" : "text.primary",
                                      }}
                                    >
                                      {isMine ? "You" : msg.username}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: isMine
                                          ? alpha("#ffffff", 0.8)
                                          : "text.secondary",
                                      }}
                                    >
                                      {formatTime(msg.timestamp)}
                                    </Typography>
                                  </Stack>
                                }
                                secondary={
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      color: isMine ? "white" : "text.primary",
                                      lineHeight: 1.6,
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {msg.text}
                                  </Typography>
                                }
                              />
                            </Paper>
                          </Stack>
                        </ListItem>
                      );
                    })}
                  </List>

                  {typingLabel && (
                    <Paper
                      elevation={0}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 1,
                        px: 1.5,
                        py: 1,
                        borderRadius: 999,
                        bgcolor: alpha("#ffffff", 0.05),
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        {[0, 1, 2].map((dot) => (
                          <Box
                            key={dot}
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              bgcolor: "#2dd4bf",
                              animation: "typingBounce 0.9s ease-in-out infinite",
                              animationDelay: `${dot * 0.14}s`,
                              "@keyframes typingBounce": {
                                "0%, 80%, 100%": {
                                  transform: "translateY(0px)",
                                  opacity: 0.4,
                                },
                                "40%": {
                                  transform: "translateY(-4px)",
                                  opacity: 1,
                                },
                              },
                            }}
                          />
                        ))}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {typingLabel}
                      </Typography>
                    </Paper>
                  )}

                  <div ref={messagesEndRef} />
                </Box>

                <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

                <Box
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    bgcolor: alpha("#090d1a", 0.56),
                  }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={5}
                      placeholder="Type your message..."
                      value={message}
                      onChange={(event) => handleTyping(event.target.value)}
                      onKeyDown={handleKeyDown}
                      InputProps={{
                        sx: {
                          borderRadius: 4,
                          bgcolor: alpha("#ffffff", 0.06),
                          pr: 0.5,
                          alignItems: "flex-end",
                          color: "text.primary",
                        },
                      }}
                      sx={{
                        flex: 1,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "rgba(255,255,255,0.08)",
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleSendMessage}
                      endIcon={<SendRoundedIcon />}
                      onMouseEnter={() => setHoverSend(true)}
                      onMouseLeave={() => setHoverSend(false)}
                      onMouseDown={() => setHoverSend(false)}
                      sx={{
                        px: { xs: 2.5, md: 3 },
                        py: { xs: 1.4, sm: "auto" },
                        minWidth: { xs: "100%", sm: 120 },
                        borderRadius: 3,
                        background:
                          "linear-gradient(135deg, #7c3aed 0%, #ec4899 55%, #14b8a6 100%)",
                        boxShadow: "0 18px 40px rgba(124,58,237,0.32)",
                        whiteSpace: "nowrap",
                        transition: "transform 180ms ease, box-shadow 180ms ease",
                        "&:hover": {
                          transform: "translateY(-1px)",
                          boxShadow: "0 24px 44px rgba(124,58,237,0.38)",
                        },
                        "&:active": {
                          transform: "scale(0.97)",
                        },
                        "& .MuiButton-endIcon": {
                          transform: hoverSend ? "rotate(-18deg)" : "rotate(0deg)",
                          transition: "transform 180ms ease",
                        },
                      }}
                    >
                      Send
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
