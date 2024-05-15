import dotenv from "dotenv";
import express from "express";
import router from "./router.js";
import cors from "cors";
import io from "./controller/socket-controller.js";
import morgan from "morgan";
import bodyParser from "body-parser";
const app = express();

dotenv.config();
app.use(morgan("dev"));

const allowedOrigins = ["http://localhost:8080"];

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

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
