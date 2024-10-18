import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ERC20_ABI } from "../../contract/erc20.token.abi";
import { REGEX, addNumbers, convertCoinAmountFromInt, convertCoinAmountToInt, customFromWei, customToWei, minusNumbers, multiplyNumbers, sleep, rawDecimal } from "../../utils/helper";
import { TransactionConfig, TransactionReceipt, Transaction } from 'web3-core';
import { executeEthTransaction, getEthBalance, getLatestBlockNumber, getTransaction, validateTxHash } from "./erc20.web3.service";
import { number } from "joi";


const prisma = new PrismaClient();

// initialize web3
const initializeWeb3 = async (rpcUrl:string) => { 
   const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

// initialize contract
const initializeErc20Contact = async (web3:any, contractAddress:string) => {
  const tokenContract = new (await initializeWeb3(web3)).eth.Contract(JSON.parse(ERC20_ABI), contractAddress);
  return tokenContract;
}

// get contract decimal
const contractDecimal = async (tokenContract:any) => {
  return await tokenContract.methods.decimals().call();
}

// get contract symbol
const getContractSymbol = async(contractInstance:any) => {
  return await contractInstance.methods.symbol().call();
}

// get contract name
const getContractName = async(contractInstance:any) => {
  return await contractInstance.methods.name().call();
}


// get eth token balance
const getEthTokenBalance = async (rpcUrl: string, address:string, contractAddress:string) => {
  let balance:any = 0;
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);
    const tokenContract = await initializeErc20Contact(rpcUrl, contractAddress)
    
    const tokenBalance = await tokenContract.methods.balanceOf(address).call();
    // console.log('web3 tokenBalance =>', tokenBalance);
    
    const tokenDecimal = await contractDecimal(tokenContract);
    if (tokenBalance) {
      // console.log('web3 tokenDecimal =>', tokenDecimal);
      balance = customFromWei(tokenBalance, tokenDecimal);
      return generateSuccessResponse("Balance get successfully", balance);
    } else {
      return generateErrorResponse("Balance get failed", balance);
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong",balance);
  }
}

// get estimate fees for eth token
const estimateEthTokenFee = async (
  rpcUrl: string, 
  contractAddress:string,
  coinType:string,
  nativeCurrency:string, 
  nativeDecimal:number, 
  gasLimit:number, 
  fromAddress:string, 
  toAddress:string,
  amount_value:number
  ) => {
    let message = '';
  try {
    nativeDecimal = 18;
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gas_limit = Number(gasLimit);
    const gas_price = await connectWeb3.eth.getGasPrice();
    const to_address = Web3.utils.toChecksumAddress(toAddress);
    const from_address = Web3.utils.toChecksumAddress(fromAddress);
    const initializeContract = await initializeErc20Contact(rpcUrl,contractAddress);
    const decimalValue = await contractDecimal(initializeContract);
    let amount:any = amount_value;
    const tokenAmount = customToWei(amount_value, decimalValue);

    const balanceRequired = amount_value;
    const getTokenBalance = await getEthTokenBalance(rpcUrl,from_address,contractAddress);
    const balance = getTokenBalance['data'];

    console.log('balance => ', balance)
    if (Number(balanceRequired) > Number(balance)) {
      const balanceShortage = minusNumbers(
        Number(balanceRequired),
        Number(balance),
      );
      message = `${'Insufficient '} ${coinType} ${' balance'}!!\n
      ${'balance required'}: ${balanceRequired} ${coinType},\n
      ${'balance exists'}: ${balance} ${coinType},\n
      ${'balance shortage'}: ${balanceShortage} ${coinType}.\n
      ${'Try less amount. Or, '}`;
      // console.log(message);
      return generateErrorResponse(message);
    }

    //  fee balance checking 
    const maxFee = customFromWei(multiplyNumbers(gas_limit, Number(gas_price)),nativeDecimal);
    
    console.log('maxFee => ', maxFee)
    const feeBalanceRequired = parseFloat(maxFee.toString()).toFixed(nativeDecimal);
    console.log('feeBalanceRequired => ', feeBalanceRequired)
    const getFeesBalance = await getEthBalance(rpcUrl,fromAddress);
    const feeBalance = getFeesBalance['data'];
    console.log('feeBalance => ', feeBalance)
    if (Number(feeBalanceRequired) > Number(feeBalance)) {
      const feeBalanceShortage = minusNumbers(
        Number(feeBalanceRequired),
        Number(feeBalance),
      );
      message = `${'Insufficient '} ${nativeCurrency} ${' Fee balance'}!!\n
       ${'Fee balance required '}: ${feeBalanceRequired} ${nativeCurrency},\n
       ${'Fee balance exists'}: ${feeBalance} ${nativeCurrency},\n
       ${'Fee balance shortage '}: ${feeBalanceShortage} ${nativeCurrency}`;
      // console.log(message);
      return generateErrorResponse(message, { maxFee: maxFee });
    }

    const call = await initializeContract.methods.transfer(to_address,tokenAmount);

    const gas = await call.estimateGas({from:from_address});
    
    if (gas > gasLimit) {
      message = `Network is too busy now, Fee is too high. ${
        'Sending'
      } ${coinType} ${ 'coin in' } ${rpcUrl} 
      ${'will ran out of gas. gas needed'}=${gas}, ${
        'gas limit we are sending'
      }=${gas_limit}`;
      // console.log(message);
      return generateErrorResponse(message);
    }

    const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gas_price)),nativeDecimal);
    const nowFees = parseFloat(estimatedFee.toString()).toFixed(nativeDecimal);
    return generateSuccessResponse('success', {
      fee: nowFees,
    });
  } catch(err:any) {
    console.log(err)
    return generateErrorResponse(err.stack);
  }
}

// get estimate fees for eth token without balance checking
const estimateEthTokenFeeWithoutChecking = async (
  rpcUrl: string, 
  contractAddress:string,
  coinType:string,
  nativeCurrency:string, 
  nativeDecimal:number, 
  gasLimit:number, 
  fromAddress:string, 
  toAddress:string,
  amount_value:number
  ) => {
    let message = '';
  try {
    console.log('amount_value => ',amount_value);
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gas_limit = Number(gasLimit);
    const gas_price = await connectWeb3.eth.getGasPrice();
    const to_address = Web3.utils.toChecksumAddress(toAddress);
    const from_address = Web3.utils.toChecksumAddress(fromAddress);
    const initializeContract = await initializeErc20Contact(rpcUrl,contractAddress);
    const decimalValue = await contractDecimal(initializeContract);
    let amount:any = amount_value;
    const tokenAmount = customToWei(amount_value, decimalValue);

    console.log('tokenAmount => ',tokenAmount);
    console.log('gas_limit => ',gas_limit);
    console.log('gas_price => ',gas_price);
    //  fee balance checking 
    const maxFee = customFromWei(multiplyNumbers(gas_limit, Number(gas_price)),nativeDecimal);
    
    console.log('maxFee => ', maxFee)
    const feeBalanceRequired = parseFloat(maxFee.toString()).toFixed(nativeDecimal);
    console.log('feeBalanceRequired => ', feeBalanceRequired)
    
    // return generateErrorResponse('error');
    const call = await initializeContract.methods.transfer(to_address,tokenAmount);

    const gas = await call.estimateGas({from:from_address});
    console.log('gas => ', gas)
    if (gas > gasLimit) {
      message = `Network is too busy now, Fee is too high. ${
        'Sending'
      } ${coinType} ${ 'coin in' } ${rpcUrl} 
      ${'will ran out of gas. gas needed'}=${gas}, ${
        'gas limit we are sending'
      }=${gas_limit}`;
      // console.log(message);
      return generateErrorResponse(message);
    }

    const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gas_price)),nativeDecimal);
    const nowFees = parseFloat(estimatedFee.toString()).toFixed(nativeDecimal);
    return generateSuccessResponse('success', {
      fee: maxFee,
    });
  } catch(err:any) {
    console.log(err)
    return generateErrorResponse(err.stack);
  }
}

// send erc20 token
const sendErc20Token = async(
  rpcUrl:string,
  contractAddress:string,
  coin_type:string,
  native_currency:string,
  nativeDecimal:number,
  gas_limit:number,
  from_address:string,
  to_address:string,
  pk:string,
  amount_value:number
  ) => {
  try {
    let amount:any = amount_value;
    console.log('requested amount =', amount);
    const web3 = await initializeWeb3(rpcUrl);

    const validateToAddress = Web3.utils.isAddress(to_address);
    if (validateToAddress) {
      let gasPrice =  await web3.eth.getGasPrice();
      console.log('gasPrice', gasPrice)
      // gasPrice = Web3.utils.fromWei(gasPrice.toString(), 'ether');
      const initializeContract = await initializeErc20Contact(rpcUrl,contractAddress);
      const decimalValue = await contractDecimal(initializeContract);
      amount = customToWei(amount_value, decimalValue);
      console.log("sendable amount =", amount);

      const toAddress = Web3.utils.toChecksumAddress(to_address);
      const fromAddress = Web3.utils.toChecksumAddress(from_address);

      const call = await initializeContract.methods.transfer(toAddress, amount);

      const response = await estimateEthTokenFee(
        rpcUrl,
        contractAddress,
        coin_type,
        native_currency,
        nativeDecimal,
        gas_limit,
        fromAddress,
        toAddress,
        amount_value
        );
        console.log('estimateEthTokenFee res => ', response)
      if (response.success == false) {
        return response;
      }  
      let nonce = await web3.eth.getTransactionCount(fromAddress,'latest');

      const tx:TransactionConfig = {
        from: fromAddress,
        nonce: nonce,
        to: Web3.utils.toChecksumAddress(contractAddress),
        data: call.encodeABI(),
        gasPrice: gasPrice.toString(),
        gas: gas_limit.toString(),
      }

      const transaction = await executeEthTransaction(
        tx,
        web3,
        pk,
        coin_type,
      );

      return transaction;

    } else {
      return generateErrorResponse("Invalid address");
    }
  } catch(err:any) {
    console.log(err);
    return generateErrorResponse(err.stack)
  }
}

// get token transaction details
const getERC20tokenTransactionDetails = async(
  rpcUrl:string,
  tx:string,
  contractAddress:string|null,
  decimal:number = 18
) => {
  try {
    const web3 = await initializeWeb3(rpcUrl);
    const checkHash = await validateTxHash(tx);
    if (checkHash) {
      const response = await getTransaction(rpcUrl,tx);
      if (response) {
        let amount = response.data.value / rawDecimal(decimal);
        let toAddress = response.data.to ?? "";


        if(contractAddress){
            if (toAddress != contractAddress) {
              return generateErrorResponse('This Transaction ID does not belong to the selected Coin/Token', []);
            }
            const contract = await initializeErc20Contact(rpcUrl,contractAddress);
            // Decode the input data using the ERC20 token ABI
            const types = ["address", "uint256"];
            console.log("response", response);
            // Decode the input data using the types of the function arguments
            const input = web3.eth.abi.decodeParameters(
              types,
              response.data.input.substring(10)
            );
              console.log("input", input);
            // The amount of tokens transferred is the second parameter
             amount = input[1];
             toAddress = input[0];
             console.log('amount1111=> ',amount);
             const tokenDecimal = await contractDecimal(contract);
             amount = Number(customFromWei(amount, tokenDecimal));
             console.log('amount22=> ',amount);
        }else{

        }
        
        
        const data = {
          hash: response.data.hash,
          gas_used: response.data.gas / response.data.gasPrice,
          txID: response.data.hash,
          amount:  Number(amount),
          toAddress: toAddress,
          fromAddress: response.data.from,
        }
        console.log('ffffff =>', data);

        return generateSuccessResponse('Transaction details', data);
      } else {
        return generateErrorResponse('Get transaction failed');
      }
    } else {
      return generateErrorResponse('Invalid transaction hash')
    }
    // const response = web3.eth.getTransaction(tx);
  } catch(err:any) {
    console.log('getERC20tokenTransactionDetails',err);
    return generateErrorResponse(err.stack)
  }
}

// get contract details
const getContractDetails = async(
  rpcUrl:string,
  contractAddress:string
) => {
  try {
    const data = {
      chain_id: 0,
      symbol: '',
      name: '',
      token_decimal: 18
    }
    const web3 = await initializeWeb3(rpcUrl);
    
    const contract = await initializeErc20Contact(rpcUrl,contractAddress);
    
    data.chain_id = await web3.eth.net.getId();
    data.symbol = await getContractSymbol(contract);
    data.name = await getContractName(contract);
    data.token_decimal = await contractDecimal(contract);

    console.log("contract details", data);
    return generateSuccessResponse("Success", data);
  } catch(err:any) {
    console.log('getContractDetails',err);
    return generateErrorResponse(err.stack)
  }
}

// get latest event
const getLatestEvent = async(
  rpcUrl: string,
  contractAddress: string,
  fromBlockNumber: number,
  block_count: number,
) => {
  try {
    const web3 = await initializeWeb3(rpcUrl);
    const contract = await initializeErc20Contact(rpcUrl,contractAddress);
    const decimalValue = await contractDecimal(contract);
    const latestBlockNumber = await getLatestBlockNumber(web3);
    let prevBlock = 100;
    if (block_count > 0) {
      prevBlock =  block_count;
    }
    let fromBlock = 0;
    if (fromBlockNumber > 0) {
      if ((latestBlockNumber - fromBlockNumber) > 5000) {
        fromBlock = latestBlockNumber - prevBlock;
      } else {
        fromBlock =  fromBlockNumber;
      }
    } else {
      fromBlock = latestBlockNumber - prevBlock;
    }
    const result = await getBlockDetails(contract,fromBlock,latestBlockNumber);
    if (result.success == true) {
      let resultData:any = [];
      result.data.forEach(function (res:any) {
          let innerData = {
              event: res.event,
              signature: res.signature,
              contract_address: res.address,
              tx_hash: res.transactionHash,
              block_hash: res.blockHash,
              from_address: res.returnValues.from,
              to_address: res.returnValues.to,
              amount: customFromWei(res.returnValues.value,decimalValue),
              block_number: res.blockNumber,
              block_timestamp: 0
          };
          resultData.push(innerData)
      });

      return generateSuccessResponse('success', resultData)
    } else {
      return result;
    }

  } catch(err:any) {
    console.log('getLatestEvent',err);
    return generateErrorResponse(err.stack)
  }
}

// get block details

const getBlockDetails = async(contract:any,fromBlockNumber:number,toBlockNumber:number) => {
  try {
    const response = await contract.getPastEvents("Transfer",
    {
        fromBlock: fromBlockNumber,
        toBlock: toBlockNumber // You can also specify 'latest'
    });
    if (response && response.length > 0) {
      return generateSuccessResponse('Found block', response)
    } else {
      return generateErrorResponse('nodatafound')
    }
  } catch(err:any) {
    console.log('getLatestEvent',err);
    return generateErrorResponse(err.stack)
  }
}

// decode input parameter for input
const decodeInputParameter = async(rpcUrl:string,contractAddress:string,inputs:any) => {
  try {
    // console.log('decodeInputParameter',rpcUrl);
    // console.log('contractAddress',contractAddress);
    // console.log('inputs',inputs);
    const web3 = await initializeWeb3(rpcUrl);
    // console.log('web3', 'ok');
    const contract = await initializeErc20Contact(rpcUrl,contractAddress);
    // console.log('contract', 'ok');
    const types = ["address", "uint256"];

    // Decode the input data using the types of the function arguments
    const input = web3.eth.abi.decodeParameters(
        types,
        inputs.substring(10)
    );
  // The amount of tokens transferred is the second parameter
    let amount = input[1];
    let toAddress = input[0];
    const tokenDecimal = await contractDecimal(contract);

    amount = customFromWei(amount, tokenDecimal);
    const data = {
      amount:amount,
      to_address : toAddress,
    }
    // console.log('decodeInputParameter data', data);
    return data;
  } catch(err:any) {
    // console.log('decodeInputParameter ex', err.stack);
    return {
      amount:"",
      to_address : "",
    }
  }
  
}

const decodeContractInputParameter = async(rpcUrl:string,contractAddress:string,inputs:any,network:any) => {
  try {
    // console.log('decodeInputParameter',rpcUrl);
    // console.log('contractAddress',contractAddress);
    // console.log('inputs',inputs);
    const web3 = await initializeWeb3(rpcUrl);
    // console.log('web3', 'ok');
    const contract = await initializeErc20Contact(rpcUrl,contractAddress);
    // console.log('contract', 'ok');
    const types = ["address", "uint256"];

    // Decode the input data using the types of the function arguments
    const input = web3.eth.abi.decodeParameters(
        types,
        inputs.substring(10)
    );
  // The amount of tokens transferred is the second parameter
    let amount = input[1];
    let toAddress = input[0];
    const tokenDecimal = network.token_decimal ? network.token_decimal : await contractDecimal(contract);

    amount = customFromWei(amount, tokenDecimal);
    const data = {
      amount:amount,
      to_address : toAddress,
    }
    // console.log('decodeInputParameter data', data);
    return data;
  } catch(err:any) {
    // console.log('decodeInputParameter ex', err.stack);
    return {
      amount:"",
      to_address : "",
    }
  }
  
}

const getAddressByKey = async(rpcUrl:string,pk:string) => {
  try {
    const web3 = await initializeWeb3(rpcUrl);
    return web3.eth.accounts.privateKeyToAccount(pk);
  } catch(err:any) {
    console.log('getAddressByKey ex', err.stack);
    return {};
  }
}

export {
  getEthTokenBalance,
  sendErc20Token,
  estimateEthTokenFee,
  getERC20tokenTransactionDetails,
  getContractDetails,
  getBlockDetails,
  getLatestEvent,
  decodeInputParameter,
  estimateEthTokenFeeWithoutChecking,
  decodeContractInputParameter,
  getAddressByKey
};