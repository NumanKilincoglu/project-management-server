import { verifyJWTToken } from "../utils/jwt.js";
import { Server } from "socket.io";
import ProjectService from "../service/project-service.js";

const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

io.listen(3001);
let connectedUsers = new Map();
let userRoom = new Map();

io.on("connect", (socket) => {
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
  console.log(err.req);      // the request object
  console.log(err.code);     // the error code, for example 1
  console.log(err.message);  // the error message, for example "Session ID unknown"
  console.log(err.context);  // some additional error context
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

export default io;
