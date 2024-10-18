import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { errorResponse, processException } from "../utils/common";

const auth = () => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.headers;
    const secret = process.env.JWT_SECRET ?? "";
    if (!token) {
      return errorResponse(res, "Access denied!");
    }
    return new Promise((resolve, reject) => {
      jwt.verify(<string>token, secret, (err, user) => {
        if (err) return reject(errorResponse(res, "Token invalid"));
        req.user = user;
      });

      next();
    });
  } catch (error) {
    processException(res, error);
  }
};
export default auth;
