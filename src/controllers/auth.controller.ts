import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import { authService } from "../services";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { ResponseData } from "../utils/commonObject";
import jwt from "jsonwebtoken";
import {
  errorResponse,
  processException,
  successResponse,
} from "../utils/common";

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET ?? "";

const test = catchAsync(async (req, res) => {
  const message = "api worked fine";

  return successResponse(res, message, req.user);
});

type Login = { email: String };

const login = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const response: ResponseData = await authService.loginUserWithEmail(email);
    if(response.success) {
      return successResponse(res, response.message, response.data);
    } else {
      return errorResponse(res, response.message, response.data);
    }  
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const verifyToken = async (req: Request, res: Response) => {
  try {
    const response: ResponseData = await authService.verifyToken(req);
    res.status(200).json({ response });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const authorizationCheck = async (req: Request, res: Response) => {
  const { token } = req.headers;
  try {
    const decoded = jwt.verify(<string>token, secret, (err, user) => {
      if (err) return errorResponse(res, "Unauthorised!");
    });
    return successResponse(res, "Token is verified!");
  } catch (err) {
    processException(res, err);
  }
};

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

export default {
  test,
  login,
  logout,
  verifyToken,
  authorizationCheck,
};
