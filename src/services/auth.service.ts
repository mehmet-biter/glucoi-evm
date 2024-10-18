import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import {
  ResponseData,
  JwtResponseData,
  generateSuccessResponse,
  generateErrorResponse,
} from "../utils/commonObject";
import { Request, Response } from "express";
import { number, string } from "joi";

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET ?? "";
interface JwtResponse {
  code: number;
  message: string;
}

const loginUserWithEmail = async (email: string) => {
  var responseData: ResponseData;
  var statusCode;
  var message;
  var data = {};

  try {
    const userDetails = await prisma.users.findUnique({
      where: {
        email: email,
      },
    });

    if (userDetails) {
      var userData = {
        id: userDetails.id.toString(),
        first_name: userDetails.first_name,
        last_name: userDetails.last_name,
        nick_name: userDetails.nickname,
        email: userDetails.email,
        role: userDetails.role,
        role_id: userDetails.role_id,
        super_admin: userDetails.super_admin,
        status: userDetails.status,
      };

      var token = jwt.sign(
        {
          user_details: userData,
        },
        secret
      );

      data = {
        user_details: userData,
        token: token,
      };

      return generateSuccessResponse(
        "User login token is generated successfully!",
        data
      );
    } else {
      return generateErrorResponse("User login token is not generated!");
    }
  } catch (error) {
    console.log('loginUserWithEmail err', error);
    return generateErrorResponse("Something went wrong!");
  }
};
function verifyTokenAndGetResponse(
  token: string,
  secret: string
): JwtResponseData {
  try {
    const decoded = jwt.verify(token, secret);
    return {
      code: 200,
      message: "Token is Verified!",
    };
  } catch (err) {
    return {
      code: 403,
      message: "Unauthorized!",
    };
  }
}

const verifyToken = async (request: Request) => {
  var statusCode;
  var message;

  try {
    const { token } = request.headers;

    const jwtResponse = verifyTokenAndGetResponse(<string>token, secret);

    statusCode = jwtResponse.code;
    message = jwtResponse.message;
  } catch (error) {
    statusCode = 500;
    message = "Something went wrong!";
  }
  return generateSuccessResponse(message);
};
/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
const logout = async (refreshToken: string): Promise<void> => {};

export default {
  loginUserWithEmail,
  logout,
  verifyToken,
};
