import jwt, { Secret } from "jsonwebtoken";
import config from "../config";
import { v4 as uuidv4 } from "uuid";

const createToken = (user: { id: string; role: string }) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
      tokenVersion: config.jwt.tokenVersion,
      jti: uuidv4(), // for logout
    },
    config.jwt.jwt_secret as Secret,
    {
      expiresIn: config.jwt.jwt_expire_in,
      algorithm: "HS256" as const,
    }
  );
};

// Refresh Token create
const createRefreshToken = (userId: string) => {
  return jwt.sign(
    {
      id: userId,
      jti: uuidv4(),
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
    },
    config.jwt.jwtRefreshSecret as Secret,
    {
      expiresIn: config.jwt.jwtRefreshExpiresIn,
    }
  );
};

// Verify Access Token (full strict check)
const verifyToken = (token: string) => {
  return jwt.verify(token, config.jwt.jwt_secret as Secret, {
    algorithms: ["HS256"],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    maxAge: config.jwt.jwt_expire_in,
  }) as jwt.JwtPayload;
};

// Verify Refresh Token
const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, config.jwt.jwtRefreshSecret as Secret, {
    algorithms: ["HS256"],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  }) as jwt.JwtPayload;
};

export const jwtHelper = {
  createToken,
  verifyToken,
  createRefreshToken,
  verifyRefreshToken,
};
