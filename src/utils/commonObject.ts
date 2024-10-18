export interface ResponseData {
    success: boolean;
    message: string;
    data: any;
}

export interface JwtResponseData {
    code: number;
    message: string;
}
  

export function generateSuccessResponse( message: string, data?: any): ResponseData {
    return {
      success: true,
      message: message,
      data: data ? data : {},
    };
}

export function generateErrorResponse( message: string, data?: any): ResponseData {
    return {
      success: false,
      message: message,
      data: data ? data : {},
    };
}
