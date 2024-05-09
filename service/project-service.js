import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function createToken(length = 20) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

function compareTokens(token1, token2) {
  return crypto.timingSafeEqual(Buffer.from(token1), Buffer.from(token2));
}

async function getUser(userID) {
  try {
    const res = await prisma.user.findUnique({
      where: {
        id: userID,
      },
    });
    return res;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function createProject(userID, project) {
  try {
    const token = createToken();

    const res = await prisma.project.create({
      data: {
        content: project.content,
        name: project.name,
        token: token,
        creator_id: userID,
        users: {
          connect: [{ id: userID }],
        },
      },
    });

    return res;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function createChatRoom(projectID) {
  try {
    const chatRoom = await prisma.chat_room.create({
      data: {
        project: { connect: { id: projectID } },
      },
    });

    return chatRoom;
  } catch (error) {
    console.log("Error creating chat room:", error);
    return null;
  }
}

async function joinProject(userID, token) {
  try {
    const project = await prisma.project.findFirst({
      where: {
        token: token,
      },
    });

    if (!project) {
      console.log("Project not found or invalid token");
      return false;
    }

    const updatedProject = await prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        users: {
          connect: {
            id: userID,
          },
        },
      },
    });
    return updatedProject.token;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function getProjects(userID) {
  try {
    const res = await prisma.user.findUnique({
      select: {
        username: true,
        projects: true,
      },
      where: {
        id: userID,
      },
    });

    let projects = [];
    if (res && res.projects) {
      res.projects.forEach((e) => {
        projects.push({
          id: e.id,
          name: e.name,
          token: userID == e.creator_id ? e.token : null,
          content: e.content,
          creator_id: e.creator_id,
          role: userID == e.creator_id ? "Creator" : "Member",
        });
      });
    }

    return projects;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function getProjectUsers(projectID) {
  try {
    const res = await prisma.project.findUnique({
      select: {
        users: {
          select: {
            username: true,
            id: true,
          },
        },
      },
      where: {
        id: projectID,
      },
    });
    return res.users || [];
  } catch (error) {
    console.log(error);
    return false;
  }
}

const ProjectService = {
  getUser,
  createProject,
  getProjects,
  joinProject,
  getProjectUsers,
  createChatRoom,
};

export default ProjectService;
