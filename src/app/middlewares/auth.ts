import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Secret } from "jsonwebtoken";
import config from "../../config";
import { jwtHelper } from "../../helpers/jwtHelper";
import ApiError from "../../errors/ApiErrors";

const auth =
  (...roles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "You are not authorized");
      }

      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        throw new ApiError(
          StatusCodes.UNAUTHORIZED,
          "Invalid authorization format"
        );
      }

      const token = parts[1];

      // verify token
      const verifyUser = jwtHelper.verifyToken(token);

      // attach user to request
      req.user = verifyUser;

      // role guard
      if (roles.length && !roles.includes(verifyUser.role)) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          "You don't have permission to access this api"
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export default auth;
