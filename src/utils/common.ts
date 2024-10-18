import { Response } from "express";

interface ErrorResponse {
  success: false;
  message: string;
}
export const separateToken = (authorization: string | undefined) => {
  return authorization ? authorization.split(" ")[1] : null;
};

export const successResponse = (
  res: Response,
  message?: string,
  data?: any
) => {
  res.json({
    success: true,
    message: message ? message : "Response successful",
    data,
  });
};

export const errorResponse = (res: Response, message: string, data?: any) => {
  res.json({
    success: false,
    message: message ? message : "Something went wrong",
    data,
  });
};
export function processException(res: Response, error: any) {
  const message = error.message || "Internal Server Error"; // Default to 'Internal Server Error' if message is not available

  res.json({
    success: false,
    message: message ? message : "Something went wrong",
    data: null,
  });
}
