import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { EVM_BASE_COIN, STATUS_ACTIVE } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ERC20_ABI } from "../../contract/erc20.token.abi";
import { REGEX, addNumbers, convertCoinAmountFromInt, convertCoinAmountToInt, customFromWei, customToWei, divideNumbers, minusNumbers, multiplyNumbers, sleep } from "../../utils/helper";
import { TransactionConfig, TransactionReceipt, Transaction } from 'web3-core';


const prisma = new PrismaClient();

// initialize web3
const initializeWeb3 = async (rpcUrl:string) => { 
   const connectWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
  
  return connectWeb3;
};

// create eth address
const createEthAddress = async (rpcUrl: string) => {
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);
    let wallet = await connectWeb3.eth.accounts.create();
    if (wallet) {
      const data = {
        address:wallet.address,
        pk:wallet.privateKey,
      }
      return generateSuccessResponse("Wallet created successfully", data);
    } else {
      return generateErrorResponse("Wallet not generated");
    }
  } catch(err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

// get eth balance
const getEthBalance = async (rpcUrl: string, address:string) => {
  let balance:any = 0;
  try {
    const connectWeb3: any = await initializeWeb3(rpcUrl);

    if(!(Web3.utils.isAddress(address)))
      return generateErrorResponse("Invalid address provided");
    // console.log('address => ', address);
    const netBalance = await connectWeb3.eth.getBalance(address);
    // console.log('netBalance from web3 = ', netBalance);
    if (netBalance) {
      balance = Web3.utils.fromWei(netBalance.toString(), 'ether');
      // console.log('balance after convert = ', balance);
      return generateSuccessResponse("Balance get successfully", balance);
    } else {
      return generateErrorResponse("Balance get failed", balance);
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong", balance);
  }
}

// get estimate fees for eth without check condition
const estimateEthFeeWithoutChecking = async (
  rpcUrl: string, 
  coinType:string, 
  coinDecimal:any, 
  gasLimit:any, 
  fromAddress:string, 
  toAddress:string,
  amount:number
  ) => {
  try {
    coinDecimal = 18;
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();

    let message = '';
    console.log('estimateEthFee gasLimit =', gasLimit);
    console.log('estimateEthFee gasPrice =', gasPrice);
    console.log('estimateEthFee amount =', amount);
    // console.log('customToWei(amount,coinDecimal) =', customToWei(amount,coinDecimal));
    ;
    // const maxFee = Number(convertCoinAmountToInt(
    //   multiplyNumbers(gasLimit,Number(gasPrice)),coinDecimal,)
    // );
    // console.log('multiplyNumbers(gasLimit, Number(gasPrice))', multiplyNumbers(gasLimit, Number(gasPrice)))
    let maxFee = customFromWei(multiplyNumbers(gasLimit, Number(gasPrice)),coinDecimal);

    // console.log('1st maxFee', maxFee);
    maxFee = parseFloat(maxFee.toString()).toFixed(coinDecimal);
    console.log('maxFee', maxFee);
    // console.log('amount', amount);
    const balanceRequired = parseFloat((addNumbers(Number(maxFee),amount)).toString()).toFixed(coinDecimal);
    const sendableAmout = parseFloat((minusNumbers(amount,Number(maxFee))).toString()).toFixed(coinDecimal);
    console.log('getEthBalance from address = ', fromAddress)
    const balanceData:any = await getEthBalance(rpcUrl,fromAddress);
    const balance = balanceData['data'];
    console.log('balance', balance)
    console.log('balanceRequired', balanceRequired)
    console.log('gas', 'calculation')
    console.log('sendableAmout', sendableAmout)
    // const tx: TransactionConfig = {
    //   from: Web3.utils.toChecksumAddress(fromAddress),
    //   to: Web3.utils.toChecksumAddress(toAddress),
    //   value: Web3.utils.toWei(sendableAmout.toString(), 'ether'),
    //   gasPrice: gasPrice.toString(),
    //   gas: gasLimit.toString()
    // };
    // console.log('TransactionConfig', tx)
    // const gas = await connectWeb3.eth.estimateGas(tx);
    // console.log('gas result', gas);
    // const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gasPrice)),coinDecimal);
    // const nowFees = parseFloat(estimatedFee.toString()).toFixed(coinDecimal);
    // const netSendableAmout = parseFloat((minusNumbers(amount,Number(nowFees))).toString()).toFixed(coinDecimal);
    // const addTwoAmount = parseFloat((addNumbers(Number(netSendableAmout),Number(sendableAmout))).toString()).toFixed(coinDecimal);
    // const avgAmount = parseFloat((divideNumbers(Number(addTwoAmount),2)).toString()).toFixed(coinDecimal);

    // console.log('estimatedFee =', estimatedFee);
    // console.log('nowFees =', nowFees);
    // console.log('netSendableAmout =', netSendableAmout);
    return generateSuccessResponse('success', {
      fee:maxFee,
      sendable_amout:sendableAmout,
      // est_fees:nowFees,
      // net_sendable_amout:netSendableAmout,
      // avarage_mount: avgAmount
    })

  } catch( err:any ) {
    console.log('estimateEthFeeWithoutChecking ex',err);
    return generateErrorResponse(err?.message);
  }
} 

// get estimate fees for eth
const estimateEthFee = async (
  rpcUrl: string, 
  coinType:string, 
  coinDecimal:any, 
  gasLimit:any, 
  fromAddress:string, 
  toAddress:string,
  amount:number
  ) => {
  try {
    coinDecimal = 18;
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();

    let message = '';
    console.log('estimateEthFee gasPrice =', gasPrice);
    console.log('estimateEthFee amount =', amount);
    console.log('customToWei(amount,coinDecimal) =', customToWei(amount,coinDecimal));
    const tx: TransactionConfig = {
      from: Web3.utils.toChecksumAddress(fromAddress),
      to: Web3.utils.toChecksumAddress(toAddress),
      value: customToWei(amount,coinDecimal),
      gasPrice: gasPrice.toString(),
      gas: gasLimit.toString()
    };

    // const maxFee = Number(convertCoinAmountToInt(
    //   multiplyNumbers(gasLimit,Number(gasPrice)),coinDecimal,)
    // );
    console.log('multiplyNumbers(gasLimit, Number(gasPrice))', multiplyNumbers(gasLimit, Number(gasPrice)))
    let maxFee = customFromWei(multiplyNumbers(gasLimit, Number(gasPrice)),coinDecimal);

    console.log('1st maxFee', maxFee);
    maxFee = parseFloat(maxFee.toString()).toFixed(coinDecimal);
    console.log('maxFee', maxFee);
    console.log('amount', amount);
    const balanceRequired = parseFloat((addNumbers(Number(maxFee),amount)).toString()).toFixed(coinDecimal);
    console.log('getEthBalance from address = ', fromAddress)
    const balanceData:any = await getEthBalance(rpcUrl,fromAddress);
    const balance = balanceData['data'];
    console.log('balance', balance)
    console.log('balanceRequired', balanceRequired)

    if (Number(balanceRequired) > Number(balance)) {
      const balanceShortage = minusNumbers(
        Number(balanceRequired),
        Number(balance),
      );
      message = `${'Insufficient '} ${coinType} ${
        'balance including fee'}!!\n
       ${'balance required'}: ${balanceRequired} ${coinType},\n
       ${'balance exists'}: ${balance} ${coinType},\n
       ${'balance shortage'}: ${balanceShortage.toFixed(
        12,
      )} ${coinType}.\n
       ${'Try less amount.'}`;
      console.log(message);
      // console.log('\n');
      return generateErrorResponse(message);
    }

    const gas = await connectWeb3.eth.estimateGas(tx);
    console.log('gas ', gas);
    if (gas > gasLimit) {
      message = `Network is too busy now, Fee is too high. ${
        'Sending'
      } ${coinType} ${'coin .'}
      ${'it will ran out of gas. gas needed'}=${gas}, ${
        'gas limit we are sending'}=${gasLimit}`;
      // console.log(message);
      // console.log('\n');
      return generateErrorResponse(message);
    }
    const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gasPrice)),coinDecimal);
    const nowFees = parseFloat(estimatedFee.toString()).toFixed(coinDecimal);
    
    console.log('estimatedFee =', estimatedFee);
    return generateSuccessResponse('success', {
      fee:estimatedFee
    })

  } catch( err:any ) {
    console.log(err);
    return generateErrorResponse(err?.message);
  }
} 

// send eth coin
const sendEthCoin = async (
  rpcUrl:string,
  coinType:string, 
  coinDecimal:any, 
  gasLimit:number,
  from_address:string,
  to_address:string,
  amount:number,
  pk:string
) => {
  try {
    console.log('sendEthCoin amount = ',amount);
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();
    const fromAddress = Web3.utils.toChecksumAddress(from_address)

    const tx: TransactionConfig = {
      from: fromAddress,
      to: Web3.utils.toChecksumAddress(to_address),
      value: customToWei(amount, coinDecimal),
      gasPrice: gasPrice.toString(),
      gas: gasLimit.toString(),
    };

    const response = await estimateEthFee(rpcUrl,
      coinType, 
      coinDecimal, 
      gasLimit,
      from_address,
      to_address,
      amount);
    console.log('estimateEthFee res', response);  
    if (response.success == false) {
      return generateErrorResponse(response.message);
    }  

    let nonce = (await connectWeb3.eth.getTransactionCount(fromAddress,'latest'));
    tx.nonce = nonce;
    const txObj = await executeEthTransaction(
      tx,
      connectWeb3,
      pk,
      coinType,
    );
    return txObj; 

  } catch(err:any) {
    console.log(err); 
    return generateErrorResponse(err?.message ?? "Something went wrong")
  }
}

// execute eth transaction
const executeEthTransaction = async(
  tx:TransactionConfig,
  connectWeb3:any,
  pk:string,
  coin_type:string,
  blockConfirmation = 0,
  waitForConfirm = false,
) => {
  const signedTx = await connectWeb3.eth.accounts.signTransaction(tx, pk);
  let txObj: TransactionReceipt = {
    status: false,
    transactionHash: '',
    transactionIndex: 0,
    blockHash: '',
    blockNumber: 0,
    from: '',
    to: '',
    cumulativeGasUsed: 0,
    gasUsed: 0,
    logs: [],
    logsBloom: '',
  };
  
  try {
    txObj = await connectWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('txObj', txObj)
  } catch(e:any) {
    console.log('executeEthTransaction ex', e);
    if (!e.message.includes('Transaction was not mined within')) {
      console.error(
        `coin send error on network: ${coin_type}, tx hash: ${signedTx.transactionHash}`,
      );
      console.error(e.stack);
      return generateErrorResponse(e.message,"");
    } else {
      txObj.transactionHash = signedTx.transactionHash;
      return generateErrorResponse(e.message,txObj);
    }
  }
  if (waitForConfirm) {
    await waitForTxConfirmed(txObj, connectWeb3, blockConfirmation);
  }
  const data = {
    block_hash:txObj.blockHash,
    block_number:txObj.blockNumber,
    contract_address:txObj.contractAddress,
    from_address:txObj.from,
    used_gas:txObj.gasUsed,
    to:txObj.to,
    transaction_id:txObj.transactionHash,
    status:txObj.status,
  }
  return generateSuccessResponse('Coin send successfully',data);
}


// wait for tx confirmed
const waitForTxConfirmed = async(
  txObj: TransactionReceipt,
  connectWeb3:any,
  blockConfirmation:number
) => {
  try {
    let confirmations = 0;
    while (confirmations < blockConfirmation) {
      await sleep(15000); // sleep 15 sec

      const currentBlock = await connectWeb3.eth.getBlockNumber();
      confirmations = currentBlock - txObj.blockNumber;
    }
    const tx = await connectWeb3.eth.getTransaction(txObj.transactionHash);
    if (!tx) return generateErrorResponse(`Transaction Failed: ${txObj.transactionHash}`);
    return;
  } catch(e:any) {
    console.log(e.stack)
  }
}

const getTransaction = async(rpcUrl:string,txHash:string): Promise<any> => {
  try {
    const web3 = await initializeWeb3(rpcUrl);
    const txObj:any = await web3.eth.getTransaction(txHash);
    if(txObj){
      txObj.amount = 0;
      txObj.address = txObj.to;
      txObj.confirmations = 1;
      return generateSuccessResponse("Transaction infromation get successfully", txObj);
    }
    return generateErrorResponse(`Faild to get transaction information`);
  } catch(e:any) {
    console.log('Error getTransaction',e);
    return generateErrorResponse(e.message ?? `Faild to get transaction information`);
  }
}

const getConfirmedTransaction = async(rpcUrl:string,txHash: string): Promise<any> => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const txObj = await connectWeb3.eth.getTransactionReceipt(txHash);
    return txObj;
  } catch (e) {
    return null;
  }
}

const getTransactionReceipt = async(rpcUrl:string,txHash: string): Promise<any> => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const txObj = await connectWeb3.eth.getTransactionReceipt(txHash);
    return txObj;
  } catch (e) {
    return null;
  }
}

const getBlockNumber = async(rpcUrl:string): Promise<string | number>  => {
  const connectWeb3 = await initializeWeb3(rpcUrl);
  return await connectWeb3.eth.getBlockNumber();
}

const validateAddress = async (rpcUrl:string, address: string): Promise<boolean> => {
  const connectWeb3 = await initializeWeb3(rpcUrl);
  return Web3.utils.isAddress(address);
}

const validateTxHash = async (txHash: string): Promise<boolean> =>{
  return new RegExp(REGEX.ETH_TXHASH).test(txHash);
}

const getAddressByPrivateKey = async(rpcUrl:string, pk:string) => {
  try {
    const web3 = await initializeWeb3(rpcUrl);
    const response = await web3.eth.accounts.privateKeyToAccount(pk);
    if (response) {
      return generateSuccessResponse('Get address success', {address:response.address})
    } else {
      return generateErrorResponse('Get address failed');
    }
  } catch(err:any) {
    console.log(err);
    return generateErrorResponse(err.stack)
  }
}

// get web3 block number
const getDepositLatestBlockNumber = async(rpcUrl:any) => {
    const web3:any = await initializeWeb3(rpcUrl);
    let blockNumber = await getLatestBlockNumber(web3);
    return blockNumber;
}

// get latest block number
const getLatestBlockNumber = async(web3:any) => {
  return await web3.eth.getBlockNumber();
}
// get block 
const getBlockData = async(web3:any,blockNumber:number) => {
  return await web3.eth.getBlock(blockNumber, true);
}

// get block transaction count
const getBlockTransactionCount = async(web3:any,blockNumber:number) => {
  return await web3.eth.getBlockTransactionCount(blockNumber, true);
}

// get block number count
const getLatestWeb3BlockNumber = async(rpcUrl:string) => {
  try {
    const web3:any = await initializeWeb3(rpcUrl);
    const blockNumber = await getLatestBlockNumber(web3);
    return blockNumber;
  } catch(err){
    console.log(rpcUrl,'getLatestWeb3BlockNumber getting failed')
    // console.log('getLatestWeb3BlockNumber err',err)
  }
    
}

// get latest transaction
const getLatestTransaction = async(
  rpcUrl:string,
  blockNumber: number,
  ) => {
  try {
    // console.log('getLatestTransaction', 'called')
    const web3:any = await initializeWeb3(rpcUrl);

    let resultData:any = [];
    const blockData = await getBlockData(web3,blockNumber);
   
    if(blockData && blockData.transactions && blockData.transactions.length) {

      resultData = blockData.transactions;

      blockData.transactions.forEach((res:any) => {
        // console.log('res => ',res);

        let innerData = {
            tx_hash: res.hash,
            block_hash: res.blockHash,
            from_address: res.from,
            to_address: res.to,
            amount: Web3.utils.fromWei(res.value, 'ether'),
            block_number: blockData.number,
            gas: res.gas,
            gas_price: res.gasPrice,
            input:res.input,
            nonce:res.nonce,
            transactionIndex:res.transactionIndex,
            value: res.value,
            type:res.type,
            chain_id: res.chainId
        };
        resultData.push(innerData)
      
      });
    }
    
      // console.log('resultData', resultData)

    return generateSuccessResponse("success", resultData);  
  } catch(err:any) {
    console.log('getLatestTransaction err',err);
    return generateErrorResponse(err.stack)
  }
}

// get estimate fees for eth
const estimateGasFee = async (
  rpcUrl: string, 
  coinDecimal:any, 
  gasLimit:any, 
  toAddress:string,
  amount:number,
  contract:string|null
  ) => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    const gasPrice = await connectWeb3.eth.getGasPrice();

    let tx: TransactionConfig = {
      to: Web3.utils.toChecksumAddress(toAddress),
      value: customToWei(amount,coinDecimal),
      gasPrice: gasPrice.toString(),
      // gas: gasLimit.toString()
    };

    if(contract){
      //tx.to = contract;
      tx.data = connectWeb3.eth.abi.encodeFunctionCall({
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      }, [toAddress, customToWei(amount,coinDecimal)]);
    }
    
    const gas = await connectWeb3.eth.estimateGas(tx);
    const estimatedFee = customFromWei(multiplyNumbers(gas, Number(gasPrice)),coinDecimal);

    return generateSuccessResponse('success', {
      fee:estimatedFee //customToWei(Number(estimatedFee),coinDecimal)
    })

  } catch( err:any ) {
    console.log(err);
    return generateErrorResponse(err?.message);
  }
} 

// wait for tx confirmed
const waitForTxConfirmedForGas = async(
  rpcUrl: string,
  txObj: any,
  blockConfirmation:number
) => {
  try {
    const connectWeb3 = await initializeWeb3(rpcUrl);
    let confirmations = 0;
    while (confirmations < blockConfirmation) {
      await sleep(15000); // sleep 15 sec

      const currentBlock = await connectWeb3.eth.getBlockNumber();
      confirmations = currentBlock - txObj.block_number;
    }
    const tx = await connectWeb3.eth.getTransaction(txObj.transaction_id);
    if (!tx) return generateErrorResponse(`Transaction Failed: ${txObj.transaction_id}`);
    return generateSuccessResponse("Transaction Success");
  } catch(e:any) {
    console.log(e.stack)
    return generateSuccessResponse("Transaction Failed");
  }
}

const getGasPrice = async (rpcUrl:string)=>{
  let connectWeb3 = await initializeWeb3(rpcUrl);
  return await connectWeb3.eth.getGasPrice();
}

// get past transaction
const getPastTransaction = async(
  rpcUrl:string,
  fromBlockNumber: number,
  toBlockNumber: number,
  ) => {
  try {
    const web3:any = await initializeWeb3(rpcUrl);
    let resultData:any = [];
    console.log('fromBlockNumber', fromBlockNumber)
    console.log('toBlockNumber', toBlockNumber)
    for (let i = fromBlockNumber; i <= toBlockNumber; i++) {
      // console.log('block number calling',i);
      const getBlockData = await web3.eth.getBlock(i, true);
      if(getBlockData && getBlockData.transactions) {
        if (getBlockData.transactions.length && getBlockData.transactions.length > 0) {
          getBlockData.transactions.forEach((res:any) => {
  
            let innerData = {
                tx_hash: res.hash,
                block_hash: res.blockHash,
                from_address: res.from,
                to_address: res.to,
                amount: Web3.utils.fromWei(res.value, 'ether'),
                block_number: getBlockData.number,
                gas: res.gas,
                gas_price: res.gasPrice,
                input:res.input,
                nonce:res.nonce,
                transactionIndex:res.transactionIndex,
                value: res.value,
                type:res.type,
                chain_id: res.chainId
            };
            resultData.push(innerData)
          
          });
        }
        
      }
    }
    const filter = {
      from_block_number: fromBlockNumber,
      to_block_number: toBlockNumber,
    };
    
    
      // console.log('resultData', resultData)
    const result = {
      blockData : filter,
      result : resultData
    }  

    return generateSuccessResponse("success", result);  
  } catch(err:any) {
    console.log('getPastTransaction',err.stack);
    return generateErrorResponse(err.stack)
  }
}

export {
  initializeWeb3,
  createEthAddress,
  getEthBalance,
  estimateEthFee,
  sendEthCoin,
  getTransaction,
  getConfirmedTransaction,
  getTransactionReceipt,
  getBlockNumber,
  validateAddress,
  validateTxHash,
  executeEthTransaction,
  getAddressByPrivateKey,
  getLatestBlockNumber,
  getLatestTransaction,
  estimateGasFee,
  waitForTxConfirmedForGas,
  getGasPrice,
  getDepositLatestBlockNumber,
  getLatestWeb3BlockNumber,
  estimateEthFeeWithoutChecking,
  getPastTransaction
};