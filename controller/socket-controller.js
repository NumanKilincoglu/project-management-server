import { verifyJWTToken } from "../utils/jwt.js";
import { Server } from "socket.io";
import ProjectService from "../service/project-service.js";

const io = new Server({
  cors: {
    origin: "*",
  },
});

io.listen(3001);
let connectedUsers = new Map();

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

  socket.on("join_room", (data) => {
    const { roomID, token } = data;
    const userID = verifyJWTToken(token);

    // Kullanıcıyı ilgili odaya katılma işlemi
    socket.join(roomID);
    let previousRoomID = null;

    socket.on("send_message", (data) => {
      const { roomID, message, fileData } = data;

      if (fileData) {
        io.to(roomID).emit("receive_message", {
          sender: userID,
          content: message,
          file: fileData,
        });
        console.log("File gitti.*>>>");
        return;
      }

      io.to(roomID).emit("receive_message", {
        sender: userID,
        content: message,
        file: null,
      });
      console.log("Mesaj gitti.*>>>");
      previousRoomID = roomID;
    });

    socket.on("leave_room", (data) => {
      const { roomID } = data;
      socket.leave(roomID);
      console.log(`Kullanıcı odadan ayrıldı: ${roomID}`);

      if (previousRoomID) {
        socket.leave(previousRoomID);
        console.log(`Kullanıcı odadan ayrıldı: ${previousRoomID}`);
        previousRoomID = null;
      }
    });
  });

  socket.on("send_private_message", async (data) => {
    const { recipientID, senderName, message, token, fileData } = data;
    const senderID = verifyJWTToken(token);

    if (!senderID) {
      socket.emit("send_private_message_response", { success: false });
      return;
    }

    //const user = await ProjectService.getUser(senderID);

    // Mesajı alıcının socketine gönderme
    const recipientSocket = findSocketByUserID(recipientID);
    if (recipientSocket) {
      recipientSocket.emit("private_message", {
        sender: senderID, // Gönderen istemcinin kimliği
        senderName: senderName,
        content: message,
      });
    }
  });

  socket.on("my_projects", async (data) => {
    const { token } = data;
    const userID = verifyJWTToken(token);

    if (!userID) socket.emit("my_projects", false);
    const tokenResponse2 = await ProjectService.getProjects(userID);
    socket.emit("my_projects", tokenResponse2);

    console.log(connectedUsers);
  });

  socket.on("disconnect", async () => {
    const socketUserID = getUserIdFromSocket(socket);
    if (socketUserID) {
      connectedUsers.delete(socketUserID);
      console.log("User Disconnected: UserID->", socketUserID);
    }
    console.log("User Disconnected: UserID-> Unknown");
  });
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
