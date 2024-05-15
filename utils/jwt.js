import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const secretKey = '9ea2809719447b61615417064bfca627aa48c07474753210d38710dea51085031db6812a8391822c04c3edc7decceb0ae1df2507d329731adb9a37fed59dabeq';
const expiresIn = 2 * 60 * 60 * 10;

export function createJWTToken(user) {
  const now = Date.now() / 1000;
  const expirationTime = now + 7200000;

  const payload = {
    userId: user.id,
    name: user.user_name,
    iat: now,
    exp: expirationTime,
  };

  const token = jwt.sign(payload, secretKey);
  return token;
}

export function verifyJWTToken(token) {
  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded.userId || null;
  } catch (err) {
    console.error("Token doğrulanamadı:", err);
    return null;
  }
}
