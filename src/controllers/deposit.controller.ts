import { checkBlockCoinDeposit, checkCoinDeposit } from "../services/evm/deposit.service";
import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";
import { errorResponse, processException, successResponse } from "../utils/common";
import { sendErc20Token } from "../services/evm/erc20.token.service";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import prisma from "../client";
import { STATUS_ACTIVE, STATUS_PENDING } from "../utils/coreConstant";
import { receiveDepositCoinProcess, checkDepositByTxService, checkEvmCurrentBlock, checkContractInfo, checkWalletAddressByKey } from "../services/user.deposit.service";


const checkEvmDeposit = async(req: Request, res: Response) => {
    console.log('checkEvmDeposit','starting......')
    const response = await checkCoinDeposit();
    return successResponse(res,'executed',response);
}
const sendTokenTest = async(req: Request, res: Response) => {
    let request:any = req.body;
    console.log(request);
    const response = await sendErc20Token (
        request.rpcUrl,
        request.contract_address,
        request.coinType, 
        request.native_currency, 
        request.coinDecimal, 
        request.gasLimit,
        request.from_address,
        request.to_address,
        request.pk,
        request.amount,
    );
    // console.log(response);
    if(response.success) {
        return successResponse(res,response.message,response.data);
    } else {
        return errorResponse(res,response.message,response.data);
    }
}

// receive deposit coin from user address to admin address
const receiveDepositCoin = async(req: Request, res:Response) => {
    try {
        const response = await receiveDepositCoinProcess(req.body);   
        if(response.success) {
            return successResponse(res,response.message,response.data);
        } else {
            return errorResponse(res, response.message,response.data)
        }
    } catch(err:any) {
        console.log(err);
        return processException(res, err);
    }
}

const checkDepositByTx = async(req: Request, res:Response) => {
    try {
        const response = await checkDepositByTxService(req.body);   
        if(response.success) {
            return successResponse(res,response.message,response.data);
        } else {
            return errorResponse(res, response.message,response.data)
        }
    } catch(err:any) {
        console.log(err);
        return processException(res, err);
    }
}

const checkCurrentBlock = async(req: Request, res:Response) => {
    try {
        const response = await checkEvmCurrentBlock(req.body);   
        if(response.success) {
            return successResponse(res,response.message,response.data);
        } else {
            return errorResponse(res, response.message,response.data)
        }
    } catch(err:any) {
        console.log(err);
        return processException(res, err);
    }
}

const checkBlockEvmDeposit = async(req: Request, res: Response) => {
    console.log('checkBlockCoinDeposit', 'starting.....')
    const response = await checkBlockCoinDeposit();
    return successResponse(res,'executed',response);
}

const getContractInfo = async(req: Request, res: Response) => {
    const response = await checkContractInfo(req.body);

    if(response.success)
        return successResponse(res, response.message,response.data);
    return errorResponse(res, response.message,response.data);
}

const checkWalletAddress = async(req: Request, res: Response) => {
    const response = await checkWalletAddressByKey(req.body);

    if(response.success)
        return successResponse(res, response.message,response.data);
    return errorResponse(res, response.message,response.data);
}

export default {
    checkBlockEvmDeposit,
    checkEvmDeposit,
    sendTokenTest,
    receiveDepositCoin,
    checkDepositByTx,
    checkCurrentBlock,
    getContractInfo,
    checkWalletAddress
}