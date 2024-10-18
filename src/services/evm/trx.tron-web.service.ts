//@ts-ignore
import TronWeb from "tronweb";
import { PrismaClient } from "@prisma/client";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../../utils/commonObject";
import { customFromWei, powerOfTen, rawDecimal } from "../../utils/helper";
import { error } from "console";
import { getTransactionDetailsData } from "./deposit.service";
import { getContractDetails } from "./trx.token.service";

const prisma = new PrismaClient();
const initializeTronWeb = async (rpcUrl: string) => {
  
  const tronGirdApiKey = await prisma.admin_settings.findFirst({
    where:{ slug: "TRON_GRID_API_KEY" }
  });

  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    headers: {
      "TRON-PRO-API-KEY": tronGirdApiKey.value || "",
    },
  });
  return tronWeb;
};

const amountConvertToSun = async (tronWeb: any, amount: number) => {
  return parseFloat(tronWeb.toSun(amount));
};

const createTrxAddress = async (rpcUrl: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    const response = await tronWeb.createAccount();

    if (response) {
      const data = {
        address: response.address.base58,
        pk: response.privateKey,
        //publicKey: response.publicKey,
      };

      return generateSuccessResponse("TRC Wallet created successfully", data);
    } else {
      return generateErrorResponse("TRC Wallet not generated");
    }
  } catch (err:any) {
    console.log(err);
    return generateErrorResponse(err.stack);
  }
};

const getTrxBalance = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    let balance = await tronWeb.trx.getBalance(address);

    balance = balance > 0 ? parseFloat(tronWeb.fromSun(balance)) : balance;
    return generateSuccessResponse("Balance get successfully", balance);

  } catch (err:any) {
    console.log(err);
    return generateErrorResponse(err.stack);
  }
};

// get estimate transaction fees
const estimateTransactionFee = async(rpcUrl:string, toAddress:string, amountTrx:number) => {
  try {
    console.log('rpcUrl', rpcUrl);
      const tronWebInstance = await initializeTronWeb(rpcUrl);
      console.log('amount', amountTrx);
      const amountSun = await amountConvertToSun(tronWebInstance, amountTrx);
      console.log('amountSun', amountSun);
      // Encode transaction data to calculate size
      const transactionData = await tronWebInstance.transactionBuilder.sendTrx('TVd7XaUGURP8hgKEj8GU69S6tFarktV6s4', amountSun);
      const transactionDataSize = Buffer.byteLength(transactionData, 'utf8');
      console.log('transactionDataSize', transactionDataSize);
      // Retrieve current fee rate
      const feeRate = await tronWebInstance.trx.getFee();

      // Calculate fee
      const estimatedFee = feeRate * transactionDataSize;

      console.log('Estimated fee:', estimatedFee, 'SUN');

      return generateSuccessResponse('Gas calculation success',estimatedFee);
  } catch (error:any) {
      console.log('Error estimating transaction fee:', error);
      return generateErrorResponse(error.stack);
  }
}

// send trx coin
const sendTrxCoin = async (
  rpcUrl: string,
  toAddress: string,
  amount: number,
  privateKey: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    console.log('amount', amount);
    const amountSun = await amountConvertToSun(tronWeb, amount);
    console.log('amountSun', amountSun);
    const checkAddress = await tronWeb.isAddress(toAddress);
    
    if (checkAddress) {
      // return generateSuccessResponse("Send trx success testing", []);
      const response = await tronWeb.trx.sendTransaction(
        toAddress,
        amountSun,
        privateKey,
        );

      console.log('sendTrxCoin response', response);
      if (response && response.result == true) {
        const data = {
          hash: response.txid,
        };
        return generateSuccessResponse("Send trx success", data);
      } else {
        return generateErrorResponse("Send trx failed");
      }
    } else {
      return generateErrorResponse("Invalid address");
    }
  } catch (err:any) {
    console.log(err);
    return generateErrorResponse(err.stack);
  }
};

const getTrxAddressByPk = async (rpcUrl: string, privateKey: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (privateKey) {
      const response = await tronWeb.address.fromPrivateKey(privateKey);

      if (response) {
        const data = {
          address: response,
        };
        return generateSuccessResponse("TRC data get successfully", data);
      } else {
        return generateErrorResponse("Data get failed");
      }
    } else {
      return generateErrorResponse("Pk is required");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return generateErrorResponse(error.stack);
  }
};

const getTrxAccount = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (address) {
      const response = await tronWeb.trx.getAccount(address);

      if (response) {
        return generateSuccessResponse("TRC data get successfully");
      } else {
        return generateErrorResponse("Data get failed");
      }
    } else {
      return generateErrorResponse("Address is required");
    }
  } catch (error) {
    return generateErrorResponse(error.stack);
  }
};

const checkTrxAddress = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (address) {
      const response = await tronWeb.isAddress(address);
      if (response) {
        return generateSuccessResponse("Address valid", response);
      } else {
        return generateErrorResponse("Address not found");
      }
    } else {
      return generateErrorResponse("Address is required");
    }
  } catch (error) {
    return generateErrorResponse(error.stack);
  }
};

const getTrxTransactionBlock = async (
  rpcUrl: string,
  txId: string | null = "trx_hash",
  contract: string|null,
  decimal:number = 6
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    const transaction = await tronWeb.trx.getTransaction(txId);
    console.log('transaction = ', transaction);
    if (transaction) {
      const txData:any = await getTransactionDetailsData(rpcUrl,transaction,0);
      if(contract && txData.contract_address) {
        if (contract != txData.contract_address) {
          return generateErrorResponse('This Transaction ID does not belong to the selected Coin/Token');
        }
      }
      return generateSuccessResponse(
        "Transaction details get successfully",
        txData
      );
    } else {
      return generateErrorResponse('Transaction getting failed');
    }
  } catch (error:any) {
    console.log(error);
    return generateErrorResponse(error.stack);
  }
};

const checkTrxDepositByBlockNumber = async(rpcUrl:string,blockNumber?:number) => {
  const tronWeb = await initializeTronWeb(rpcUrl);
  let blockNum:any = blockNumber;
  if(!blockNumber || blockNumber == 0) {
    blockNum = await getTrxCurrentBlockNumber(tronWeb);
  } 
  return await getTrxTransactionByBlockNumber(tronWeb,blockNum);
}

const getTrxTransactionByBlockNumber = async(tronWeb:any,blockNumber:number) => {
  try {
    // let block = await tronWeb.trx.getBlockByNumber(blockNumber);
    let block = await tronWeb.trx.getBlockByNumber(blockNumber);
    // console.log('transactions getBlock =>', block);
    if (!block) generateErrorResponse('Failed to get block');
    block.block_number = blockNumber;
    return generateSuccessResponse("Block get successfully", block);
  } catch(err:any) {
    console.log('getBlockByNum ex =>' , error)
    return generateErrorResponse(err.stack ?? "Something went wrong");
  }
}

const getTrxCurrentBlockNumber = async(tronWeb:any) => {
  let latestBlockNumber = 0;
  const block = await tronWeb.trx.getCurrentBlock();
  if (block && block.block_header) {
     latestBlockNumber = block.block_header.raw_data.number; 
  }
  return latestBlockNumber;
}

// get web3 block number
const getTrcLatestBlockNumber = async(rpcUrl:any) => {
  const tronWeb = await initializeTronWeb(rpcUrl);
  let blockNumber = await getTrxCurrentBlockNumber(tronWeb);
  return blockNumber;
}

const getTrxCurrentBlockNumberByRpcUrl = async(rpcUrl:any) => {
  let latestBlockNumber = 0;
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    
    const block = await tronWeb.trx.getCurrentBlock();
    if (block && block.block_header) {
      latestBlockNumber = block.block_header.raw_data.number; 
    }
    
  } catch(err:any) {
    console.log('getTrxCurrentBlockNumberByRpcUrl err', err.stack);
  }
  return latestBlockNumber;
}

const convertAddressAmount = async(rpcUrl:any,type:any,fromAddress:any,toAddress:any,amountVal:any,contractAddress?:any) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    const from_address = tronWeb.address.fromHex(fromAddress);
    let to_address = toAddress;
    let contract_address = '';
    let amount = 0;
    if (type == 'token') {
      to_address = tronWeb.address.fromHex(tronWeb.address.toHex(toAddress))
      if (contractAddress) {
        contract_address = tronWeb.address.fromHex(contractAddress);
      }
      const contactData = await getContractDetails(rpcUrl,contract_address);
      let decimal = 18;
      decimal = contactData.data.decimal;
      amount = customFromWei(amountVal,decimal);
    } else {
      to_address = tronWeb.address.fromHex(toAddress);
      amount = parseFloat(tronWeb.fromSun(amountVal));
    }
      
    return {
      from_address:from_address,
      to_address:to_address,
      contract_address:contract_address,
      amount:amount,
    }
  } catch (err) {
    console.log('ex err', err);
    return {
      from_address:0,
      to_address:0,
      contract_address:0,
      amount:0,
    }
  }
  
}

const getTrxTransactionBlockRange = async(rpcUrl:string,fromBlockNumber:number,toBlockNumber:number) => {
  const blockData = {
    from_block_number:fromBlockNumber,
    to_block_number:toBlockNumber,
  }
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    const transactions = await tronWeb.trx.getBlockRange(fromBlockNumber, toBlockNumber);
    let data = [];
    if (transactions.length > 0) {
      transactions.forEach( (transaction:any) => {
        if (transaction.transactions && transaction.transactions.length > 0) {
            data = [...data, ...transaction.transactions]
        }
      })
    }
    const result = {
      transactions:data,
      blockData: blockData
    }
    return generateSuccessResponse("Block get successfully", result);
  } catch(err:any) {
    console.log('getTrxTransactionBlockRange ex =>' , err.stack)
    return generateErrorResponse(err.stack ?? "Something went wrong");
  }
}

const getTronAddressByKey = async(rpcUrl:string,pk:string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    let address = tronWeb.address.fromPrivateKey(pk);
    if(address){
      return {
          address: address
      };
    }
    return {};
  } catch(err:any) {
    console.log('getTronAddressByKey ex', err.stack);
    return {};
  }
}

export {
  initializeTronWeb,
  amountConvertToSun,
  createTrxAddress,
  getTrxBalance,
  sendTrxCoin,
  getTrxAddressByPk,
  getTrxAccount,
  checkTrxAddress,
  getTrxTransactionBlock,
  checkTrxDepositByBlockNumber,
  getTrcLatestBlockNumber,
  getTrxCurrentBlockNumberByRpcUrl,
  convertAddressAmount,
  getTrxTransactionBlockRange,
  estimateTransactionFee,
  getTronAddressByKey
};