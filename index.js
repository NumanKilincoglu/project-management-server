import dotenv from "dotenv";
import express from "express";
import router from "./router.js";
import cors from "cors";
import { Server } from "socket.io";
import http from "http";
import { verifyJWTToken } from "./utils/jwt.js";
import ProjectService from "./service/project-service.js";

import morgan from "morgan";
import bodyParser from "body-parser";
const app = express();

dotenv.config();
app.use(morgan("dev"));

const allowedOrigins = ["*"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
router(app);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

let connectedUsers = new Map();
let userRoom = new Map();

io.on("connect", (socket) => {
  console.log("burda");
  socket.on("login", async (data) => {
    const userID = verifyJWTToken(data.token);
    console.log("User Connected: UserID->", userID);

    if (userID) {
      connectedUsers.set(userID, socket.id);
    }
  });

  socket.on("create_project", async (data) => {
    const { project, token } = data;
    const userID = verifyJWTToken(token);
    if (!userID) {
      socket.emit("create_project", { success: false });
      return;
    }
    const createdProject = await ProjectService.createProject(userID, project);
    const tokenResponse = createdProject.token;
    const createChatRoom = await ProjectService.createChatRoom(
      createdProject.id
    );
    const projects = await ProjectService.getProjects(userID);
    socket.emit("create_project", { success: true, tokenResponse });
    socket.emit("my_projects", projects);
  });

  socket.on("join_project", async (data) => {
    const { join_token, token } = data;

    const userID = verifyJWTToken(token);
    if (!userID) {
      socket.emit("join_project", { success: false });
      return;
    }

    const joinedProject = await ProjectService.joinProject(userID, join_token);

    const projects = await ProjectService.getProjects(userID);
    socket.emit("join_project_response", { success: true, joinedProject });
    socket.emit("my_projects", projects);
  });

  socket.on("project_users", async (data) => {
    const { projectID, token } = data;

    const userID = verifyJWTToken(token);
    if (!userID) {
      socket.emit("project_users", { success: false });
      return;
    }

    const users = await ProjectService.getProjectUsers(projectID);
    if (users) {
      users.forEach((user) => {
        if (connectedUsers.has(user.id)) {
          user.status = "Online";
        } else {
          user.status = "Offline";
        }
      });
    }

    socket.emit("project_users", users);
  });

  socket.on("join_room", async (data) => {
    const { previousRoomID, roomID, token } = data;
    const userID = verifyJWTToken(token);
    if (!userID) return socket.emit("join_room_failed", { success: false });

    if (previousRoomID) {
      socket.leave(previousRoomID);
    }

    socket.join(roomID);
    const messages = await ProjectService.getRoomChat(roomID);

    io.to(roomID).emit("previous_messages", {
      roomID: roomID,
      messages: messages,
    });
  });

  socket.on("send_message", async (data) => {
    const { roomID, message, fileData, token } = data;

    const userID = verifyJWTToken(token);

    if (!userID) return socket.emit("send_message_failed", { success: true });

    const user = await ProjectService.getUser(userID);

    const res = await ProjectService.sendRoomMessage(
      userID,
      roomID,
      message,
      fileData
    );

    if (fileData) {
      io.to(roomID).emit("receive_message", {
        sender: user,
        content: message,
        file: fileData,
      });
      return;
    }

    io.to(roomID).emit("receive_message", {
      sender: user,
      content: message,
      file: null,
    });
  });

  socket.on("send_private_message", async (data) => {
    const { recipientID, senderName, message, token, fileData } = data;
    const senderID = verifyJWTToken(token);

    if (!senderID) {
      socket.emit("send_private_message_response", { success: false });
      return;
    }

    const response = await ProjectService.sendPrivateMessage(
      senderID,
      recipientID,
      message,
      fileData
    );

    let messageData = null;
    if (response) {
      messageData = {
        sender: senderName,
        content: response.message,
        file: response.file,
        created_at: response.created_at,
      };
    }

    const recipientSocket = findSocketByUserID(recipientID);

    if (recipientSocket) {
      recipientSocket.emit("private_message", messageData);
    }
  });

  socket.on("load_private_message", async (data) => {
    const { recipientID, token } = data;
    const senderID = verifyJWTToken(token);

    if (!senderID) {
      socket.emit("send_private_message_response", { success: false });
      return;
    }

    const messages = await ProjectService.getPrivateChat(senderID, recipientID);

    socket.emit("get_private_messages", {
      messages,
    });
  });

  socket.on("my_projects", async (data) => {
    const { token } = data;
    const userID = verifyJWTToken(token);

    if (!userID) socket.emit("my_projects", false);
    const tokenResponse2 = await ProjectService.getProjects(userID);
    socket.emit("my_projects", tokenResponse2);
  });

  socket.on("disconnect", async () => {
    const socketUserID = getUserIdFromSocket(socket);
    if (socketUserID) {
      connectedUsers.delete(socketUserID);
      console.log("User Disconnected: UserID->", socketUserID);
    }
  });
});

io.engine.on("connection_error", (err) => {
  console.log(err.req); // the request object
  console.log(err.code); // the error code, for example 1
  console.log(err.message); // the error message, for example "Session ID unknown"
  console.log(err.context); // some additional error context
});

function getUserIdFromSocket(socket) {
  for (const [userID, socketID] of connectedUsers.entries()) {
    if (socketID === socket.id) {
      return userID;
    }
  }
  return null;
}

function findSocketByUserID(userID) {
  const socketID = connectedUsers.get(userID);
  const socket = io.sockets.sockets.get(socketID);
  return socket;
}

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
