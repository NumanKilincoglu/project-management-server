import { executeQuery } from "../utils/databaseUtil.js";
import { createJWTToken } from "../utils/jwt.js";

export async function login(req, res) {
  try {
    const sqlQuery = "SELECT * FROM user WHERE username = ? AND password = ?";
    const params = [req.body.username, req.body.password];

    const result = await executeQuery(sqlQuery, params);

    if (result && result.length > 0) {
      const token = createJWTToken(result[0]);
      return res
        .status(200)
        .send({ success: true, message: "Created.", token: token, userID: result[0].id, userName: result[0].username });
    }

    return res.status(200).send({ success: false, message: "Error." });
  } catch (error) {
    console.error("Hata:", error);
    res.status(200).send({ success: false, message: "Error." });
  }
}

export async function register(req, res) {
  try {
    const sqlQuery = "INSERT INTO user (username, password) VALUES (?, ?)";
    const params = [req.body.username, req.body.password];

    const result = await executeQuery(sqlQuery, params);
    console.log(result)
    if (result && result.affectedRows > 0) {
      const token = createJWTToken(result);
      return res
        .status(200)
        .send({ success: true, message: "Created.", token: token, userName: result[0].userName  });
    }

    res.status(200).send({ success: false, message: "Exist." });
  } catch (error) {
    console.error("Hata:", error);
    res.status(200).send({ success: false, message: "Error." });
  }
}
