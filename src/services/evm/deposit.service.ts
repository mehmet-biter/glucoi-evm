import { PrismaClient } from "@prisma/client";
import Web3 from "web3";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import { ADDRESS_TYPE_EXTERNAL, EVM_BASE_COIN, NATIVE_COIN, TOKEN_COIN, TRON_BASE_COIN } from "../../utils/coreConstant";
import { getLatestTransaction, getLatestWeb3BlockNumber, getPastTransaction } from "./erc20.web3.service";
import { number } from "joi";
import { decodeContractInputParameter, decodeInputParameter } from "./erc20.token.service";
import { addNumbers, createUniqueCode } from "../../utils/helper";
import { checkTrxDepositByBlockNumber, convertAddressAmount, getTrxCurrentBlockNumberByRpcUrl, getTrxTransactionBlock, getTrxTransactionBlockRange, initializeTronWeb } from "./trx.tron-web.service";

const ethers = require('ethers');
const prisma = new PrismaClient();

const checkCoinDeposit = async() => {
    try {
        let resultData: any = [];
        const networkData:any = await prisma.$queryRaw`
        SELECT * 
        FROM networks 
        JOIN notified_blocks ON networks.id = notified_blocks.network_id
        WHERE networks.status = 1`;

        if(networkData && networkData.length > 0) {
            for(let x = 0; x < networkData.length; x++) {
                if (networkData[x].rpc_url) {
                    console.log("checkCoinDeposit url:", networkData[x].rpc_url);
                    let requestedBlockNumber = networkData[x].block_number;
                    console.log("checkCoinDeposit requestedBlockNumber:", requestedBlockNumber);
                    if(networkData[x].base_type == EVM_BASE_COIN) {
                        console.log('EVM_BASE_COIN deposit', 'started')
                        const currentBlockNumber = await getLatestWeb3BlockNumber(networkData[x].rpc_url);
                        if (!currentBlockNumber) {
                            console.log("currentBlockNumber getting failed:", currentBlockNumber);
                        }
                        if (currentBlockNumber){
                        let blockNumber = currentBlockNumber;
                        console.log("checkCoinDeposit currentBlockNumber:", currentBlockNumber);
                        // const toBlockNumber = currentBlockNumber;
                        // const fromBlockNumber = currentBlockNumber - 50;
                        // const transactions = await getPastTransaction(networkData[x].rpc_url,fromBlockNumber,toBlockNumber);
                        //     if (transactions && transactions.data.result.length > 0) {
                        //         // console.log('deposit transactions', 'found');
                        //         const promises = transactions.data.result.map(async (res: any) => {
                        //             if (res) {
                        //                 const checkDeposit: any = await checkNativeDepositAddress(networkData[x].rpc_url,res);
                        //                 if (checkDeposit) {
                        //                 resultData.push(checkDeposit);
                        //                 }
                        //             }
                                    
                        //         });
                        //         await Promise.all(promises);
                        //     }
                            if (requestedBlockNumber && requestedBlockNumber > 0) {
                                blockNumber = requestedBlockNumber;
                            }    
                        if (blockNumber <= currentBlockNumber) {
                            let setBlockNumber = blockNumber;
                            const transactions = await getLatestTransaction(networkData[x].rpc_url,blockNumber);
                            // console.log('transactions...',transactions)
                            if (transactions && transactions.data.length > 0) {
                                console.log('deposit transactions getLatestTransaction', 'found');
                                const promises = transactions.data.map(async (res: any) => {
                                    const checkDeposit: any = await checkEVMbaseDepositAddress(networkData[x].rpc_url,res,blockNumber);
                                    // console.log('checkNativeDepositAddress data', checkDeposit);
                                    if (checkDeposit) {
                                    resultData.push(checkDeposit);
                                    }
                                    // console.log('res.block_number',res.block_number)
                                    setBlockNumber = blockNumber
                                });
                                await Promise.all(promises);
                                }
                            await updateNetworkBlockNumber(networkData[x].network_id,setBlockNumber); 
                        }
                    }
                           
                    } else if (networkData[x].base_type == TRON_BASE_COIN) {

                        console.log("start TRON_BASE_COIN",' deposit checking');
                       
                        const currentBlockNumber = await getTrxCurrentBlockNumberByRpcUrl(networkData[x].rpc_url);
                        console.log(' currentBlockNumber => ', currentBlockNumber);
                        const toBlockNumber = currentBlockNumber;
                        const fromBlockNumber = currentBlockNumber - 50;
                        const transactions = await getTrxTransactionBlockRange(networkData[x].rpc_url,fromBlockNumber,toBlockNumber);
                            // console.log('transactions => ', transactions);
                        
                            if(! (transactions.hasOwnProperty("success") && transactions.success)) {
                                console.log(transactions.message);
                                // return generateErrorResponse(transactions.message ?? "Block data not found by block range");
                            }
                                
                            if (transactions && transactions.data.transactions) {
                                const promises = transactions?.data?.transactions?.map(async (res: any) => {
                                    
                                    const checkDeposit: any = await checkTronNativeDepositAddress(networkData[x].rpc_url,res,1);
                                    // console.log("checkDeposit data:", checkDeposit);
                                    
                                    
                                    if (checkDeposit && checkDeposit.hasOwnProperty("address")) 
                                        resultData.push(checkDeposit);
                                });
                                if(! (promises == undefined)) await Promise.all(promises);
                            }
                            if (transactions && transactions.data.blockData) {
                                await updateBlockNumberNetwork(networkData[x].id,
                                    transactions.data.blockData?.from_block_number,
                                    transactions.data.blockData?.to_block_number,
                                    );
                            }
                        // let blockNumber = currentBlockNumber;
                        // if (requestedBlockNumber && requestedBlockNumber > 0) {
                        //     blockNumber = requestedBlockNumber;
                        // }
                        // if (blockNumber <= currentBlockNumber) {
                        //     let setBlockNumber = blockNumber;
                        //     const transactions = await checkTrxDepositByBlockNumber(networkData[x].rpc_url,blockNumber);
                        //     // console.log('transactions => ', transactions);
                        //     if(! (transactions.hasOwnProperty("success") && transactions.success))
                        //         return generateErrorResponse(transactions.message ?? "Block not found by block number");

                        //     if (transactions && transactions.data) {
                        //         setBlockNumber = transactions?.data?.block_number;
                        //         const promises = transactions?.data?.transactions?.map(async (res: any) => {
                                    
                        //             const checkDeposit: any = await checkTronNativeDepositAddress(networkData[x].rpc_url,res,transactions?.data?.block_number);
                        //             // console.log("checkDeposit data:", checkDeposit);
                                    
                                    
                        //             if (checkDeposit && checkDeposit.hasOwnProperty("address")) 
                        //                 resultData.push(checkDeposit);
                        //         });
                        //         if(! (promises == undefined)) await Promise.all(promises);
                        //     }
                        //     await updateNetworkBlockNumber(networkData[x].network_id,setBlockNumber);   
                        // }            

                    }
                }
            }
        }
        
        console.log('resultData.....', resultData)
        if (resultData && resultData.length > 0 ) {
            await depositUserWallet(resultData);
        }
        return [];
    } catch (err:any) {
        console.log('checkDeposit',err.stack);
        return generateErrorResponse(err.stack)
    }
}

const checkBlockCoinDeposit = async() => {
    try {
        let resultData: any = [];
        const networkData:any = await prisma.networks.findMany({
            where:{
                status:1
            }
        })

        if(networkData && networkData.length > 0) {
            for(let x = 0; x < networkData.length; x++) {
                if (networkData[x].rpc_url) {
                    console.log("checkBlockCoinDeposit url:", networkData[x].rpc_url);
                    let fromBlockNumber = Number(networkData[x].from_block_number);
                    let toBlockNumber = Number(networkData[x].to_block_number);
                    
                    

                    if(networkData[x].base_type == EVM_BASE_COIN) {
                        let block_differenceData = await prisma.admin_settings.findFirst({
                            where:{ slug: "erc_block_difference" }
                        });

                        let block_difference = Number(block_differenceData.value || 100);
                        // console.log('EVM_BASE_COIN deposit started block diff =>', block_difference);
                        const currentBlockNumber = await getLatestWeb3BlockNumber(networkData[x].rpc_url);
                        if(!currentBlockNumber) {
                            console.log('currentBlockNumber  not found=>',currentBlockNumber);
                        }
                        if (currentBlockNumber){
                        // toBlockNumber = currentBlockNumber;
                        // fromBlockNumber = currentBlockNumber - block_difference;


                        if (!(toBlockNumber > 0) && !(fromBlockNumber > 0)) {
                            toBlockNumber = currentBlockNumber;
                            fromBlockNumber = currentBlockNumber - block_difference;
                        } else {
                        let compareBlock = currentBlockNumber - toBlockNumber;
                        fromBlockNumber = toBlockNumber;
                        toBlockNumber = currentBlockNumber;
                
                        if (compareBlock > block_difference)
                            toBlockNumber = fromBlockNumber + block_difference;
                        }

                        // console.log("checkBlockCoinDeposit from block numberrrr:", fromBlockNumber);
                        // console.log("checkBlockCoinDeposit to block number:", toBlockNumber);
                        // if (fromBlockNumber == 0 && toBlockNumber == 0) {
                        //     toBlockNumber = currentBlockNumber;
                        //     fromBlockNumber = currentBlockNumber - block_difference;
                            
                        // } else {
                        //     fromBlockNumber = toBlockNumber;
                        //     toBlockNumber = fromBlockNumber + block_difference;
                        //     if(toBlockNumber > currentBlockNumber) {
                        //         toBlockNumber = currentBlockNumber;
                        //     }
                        // }
                        if (fromBlockNumber <= toBlockNumber) {
                            // to do processing
                            const transactions = await getPastTransaction(networkData[x].rpc_url,fromBlockNumber,toBlockNumber);
                            if (transactions && transactions.data.result.length > 0) {
                                console.log('deposit transactions', 'found');
                                const promises = transactions.data.result.map(async (res: any) => {
                                    const checkDeposit: any = await checkNativeDepositAddress(networkData[x].rpc_url,res);
                                    if (checkDeposit) {
                                    resultData.push(checkDeposit);
                                    }
                                });
                                await Promise.all(promises);
                            }
                            if (transactions && transactions.data.blockData) {
                                await updateBlockNumberNetwork(networkData[x].id,
                                    transactions.data.blockData?.from_block_number,
                                    transactions.data.blockData?.to_block_number,
                                    );
                            }  
                        }
                    }
                           
                    } else if (networkData[x].base_type == TRON_BASE_COIN) {
                        let block_difference = process.env.TRC_BLOCK_NUMBER ? Number(process.env.TRC_BLOCK_NUMBER) : 25; 
                        console.log('TRON_BASE_COIN deposit started block diff =>', block_difference);

                        const currentBlockNumber = await getTrxCurrentBlockNumberByRpcUrl(networkData[x].rpc_url);
                        if(!currentBlockNumber) {
                            // console.log('currentBlockNumber =>',currentBlockNumber);
                        }
                        // console.log('currentBlockNumber =>',currentBlockNumber);
                        if (fromBlockNumber == 0 && toBlockNumber == 0) {
                            toBlockNumber = currentBlockNumber;
                            fromBlockNumber = currentBlockNumber - block_difference;
                            
                        } else {
                            fromBlockNumber = toBlockNumber;
                            toBlockNumber = fromBlockNumber + block_difference;
                            if(toBlockNumber > currentBlockNumber) {
                                toBlockNumber = currentBlockNumber;
                            }
                        }
                        if (fromBlockNumber <= toBlockNumber) {
                            const transactions = await getTrxTransactionBlockRange(networkData[x].rpc_url,fromBlockNumber,toBlockNumber);
                            // console.log('transactions => ', transactions);
                        
                            if(! (transactions.hasOwnProperty("success") && transactions.success)) {
                                console.log(transactions.message);
                                // return generateErrorResponse(transactions.message ?? "Block data not found by block range");
                            }
                                
                            // console.log('txxx',transactions.success);
                            if (transactions && transactions.data.transactions) {
                                const promises = transactions?.data?.transactions?.map(async (res: any) => {
                                    
                                    const checkDeposit: any = await checkTronNativeDepositAddress(networkData[x].rpc_url,res,1);
                                    // console.log("checkDeposit data:", checkDeposit);
                                    
                                    
                                    if (checkDeposit && checkDeposit.hasOwnProperty("address")) 
                                        resultData.push(checkDeposit);
                                });
                                if(! (promises == undefined)) await Promise.all(promises);
                            }
                            if (transactions && transactions.data.blockData) {
                                await updateBlockNumberNetwork(networkData[x].id,
                                    transactions.data.blockData?.from_block_number,
                                    transactions.data.blockData?.to_block_number,
                                    );
                            }
                               
                        }            

                    }
                }
            }
        }
        
        console.log('resultData.....', resultData)
        if (resultData && resultData.length > 0 ) {
            await depositUserWallet(resultData);
        }
        return [];
    } catch (err:any) {
        console.log('checkBlockCoinDeposit',err.stack);
        console.log('checkBlockCoinDeposit details',err);
        return generateErrorResponse(err.stack)
    }
}



const checkTrxDeposit = async( rpc_url:string  ) => {
    try {
        let resultData: any = [];
        const networkData:any = await prisma.$queryRaw`
            SELECT * 
            FROM networks 
            JOIN notified_blocks ON networks.id = notified_blocks.network_id
            WHERE networks.status = 1`;

        if(networkData && networkData.length > 0) {
            for(let x = 0; x < networkData.length; x++) {
                if (networkData[x].rpc_url) {
                    console.log(networkData[x].rpc_url);
                    console.log(networkData[x].block_number);
                    if(networkData[x].base_type == TRON_BASE_COIN) {
                        console.log("start proccess");
                        let firstBlockNumber = networkData[x].block_number;
                        let setBlockNumber = networkData[x].block_number;

                        const transactions = await checkTrxDepositByBlockNumber(networkData[x].rpc_url,networkData[x].block_number);
                        if(! (transactions.hasOwnProperty("success") && transactions.success))
                            return generateErrorResponse(transactions.message ?? "Block not found by block number");

                        if (transactions && transactions.data) {
                            const promises = transactions?.data?.transactions?.map(async (res: any) => {
                                const checkDeposit: any = await checkTronNativeDepositAddress(networkData[x].rpc_url,res,networkData[x].block_number);
                                console.log("checkDeposit data:", checkDeposit);
                                if (checkDeposit && checkDeposit.hasOwnProperty("address")) {
                                    resultData.push(checkDeposit);
                                    setBlockNumber = res.block_number;
                                }
                            });
                            if(! (promises == undefined)) await Promise.all(promises);
                        }
                        if(firstBlockNumber == setBlockNumber)
                        await updateNetworkBlockNumber(networkData[x].network_id,setBlockNumber);    
                    }
                }
            }
        }
        // console.log('resultData.....', resultData, (resultData && resultData.length > 0 ))
        if (resultData && resultData.length > 0 )
            await depositUserWallet(resultData);
        
        return [];
    } catch (err:any) {
        console.log('checkTrxDeposit',err);
        return generateErrorResponse(err.stack);
    }
}

const checkTrxNativeDeposit = async(rpcUrl:any,blockNumber?:number) => {
    try {
        const transactions = await checkTrxDepositByBlockNumber(rpcUrl,blockNumber);
        if(transactions.hasOwnProperty("success") && transactions.success)
            return transactions;
        return generateErrorResponse(transactions.message ?? "Deposit check failed");
    } catch(err:any) {
        console.log('checkTrxNativeDeposit err', err);
        return generateErrorResponse(err.message ?? 'Something went wrong');
    }
}

const checkTrxTokenDeposit = async(network:any) => {
    // const transactions = await 
}

// check deposit addrees
const checkNativeDepositAddress = async(rpcUrl:string,res:any) => {
    // console.log('checkNativeDepositAddress res => ', res);
    let walletAddressData:any = null;
    try {
        if(res) {
            let address = res.to_address;
            let tx = res.tx_hash;
            let inputs = res.input;
            let amount = res.amount
            let walletAddress:any = null;
        
            if(address) {
                walletAddress = await prisma.wallet_address_histories.findMany({
                    where:{
                        address:address
                    }
                });
                
                if (walletAddress && walletAddress.length > 0) {
                    // console.log('checkNativeDepositAddress','address found');
                    for(let i=0; i<walletAddress.length; i++) {
                        const wallet:any = walletAddress[i];
                        
                        const checkNative = await prisma.coin_networks.findFirst({
                            where:{
                                network_id:Number(wallet.network_id),
                                currency_id:Number(wallet.coin_id),
                                type: NATIVE_COIN
                            }
                        });
                        // console.log('checkNative',checkNative);
                        
                        if (checkNative) {
                            
                            const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                                where:{
                                    address:address,
                                    transaction_id: tx,
                                    coin_id : Number(wallet.coin_id)
                                }
                            });
                            if (!checkDepositTransaction) {
                                walletAddressData = {
                                    address : address,
                                    receiver_wallet_id : Number(wallet.wallet_id),
                                    address_type : ADDRESS_TYPE_EXTERNAL,
                                    coin_type : wallet.coin_type,
                                    amount : amount,
                                    transaction_id : tx,
                                    status : 1,
                                    confirmations : 1,
                                    from_address : res.from_address,
                                    network_type : Number(wallet.network_id),
                                    network_id : Number(wallet.network_id),
                                    block_number : res.block_number,
                                    coin_id :Number(wallet.coin_id),
                                }
                            }
                        } 
                    }
                } else {
                    const checkContractAddresses = await prisma.coin_networks.findMany({
                        where:{
                            contract_address:address
                        }
                    });
                    
                    
                    // console.log('length => ', checkContractAddresses.length);
                    if(checkContractAddresses && checkContractAddresses.length > 0) {
                        for(let j=0; j<checkContractAddresses.length; j++) {
                            let checkContractAddress = checkContractAddresses[j];
                            // console.log('checkContractAddress => ',checkContractAddress);
                            const contractData = await decodeInputParameter(rpcUrl,address,inputs)
                            // console.log('contractData => ', contractData)
                            // console.log('network id => ', Number(checkContractAddress.network_id))
                            // console.log('currency id => ', Number(checkContractAddress.currency_id))
                            if(contractData.to_address) {
                                walletAddress = await prisma.wallet_address_histories.findFirst({
                                    where:{
                                        address:contractData.to_address,
                                        network_id: Number(checkContractAddress.network_id),
                                        coin_id:Number(checkContractAddress.currency_id)
                                    }
                                });
                                if(walletAddress) {
                                    // console.log('walletAddress => ',walletAddress);
                                    const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                                        where:{
                                            address:contractData.to_address,
                                            transaction_id: tx,
                                            coin_id : Number(walletAddress.coin_id)
                                        }
                                    });
                                    if (!checkDepositTransaction) {
                                        walletAddressData = {
                                            address : contractData.to_address,
                                            receiver_wallet_id : Number(walletAddress.wallet_id),
                                            address_type : ADDRESS_TYPE_EXTERNAL,
                                            coin_type : walletAddress.coin_type,
                                            amount : contractData.amount,
                                            transaction_id : tx,
                                            status : 1,
                                            confirmations : 1,
                                            from_address : res.from_address,
                                            network_type : Number(walletAddress.network_id),
                                            network_id : Number(walletAddress.network_id),
                                            block_number : res.block_number,
                                            coin_id : Number(walletAddress.coin_id),
                                        }
                                        // console.log('walletAddressData', walletAddressData)
                                    }
                                }
                            }
                        }
                        
                        
                    }
                }
            }
        }
        
    // console.log('walletAddressData => ',walletAddressData)
    
    } catch(err:any) {
        // console.log('checkNativeDepositAddress err',err.stack);
    }
    return walletAddressData;
}

const checkEVMbaseDepositAddress = async(rpcUrl:string,res:any,blockNumber:number) => {
    // console.log('checkNativeDepositAddress res => ', res);
    let walletAddressData:any = null;
    try {
        if(res) {
            let address = res.to;
            let tx = res.hash;
            let inputs = res.input;
            let fromAddress = res.from;
            
            let amount = Web3.utils.fromWei(res.value, 'ether')
            let walletAddress:any = null;
        
            if(address) {
                walletAddress = await prisma.wallet_address_histories.findMany({
                    where:{
                        address:address
                    }
                });
                
                if (walletAddress && walletAddress.length > 0) {
                    // console.log('checkNativeDepositAddress','address found');
                    for(let i=0; i<walletAddress.length; i++) {
                        const wallet:any = walletAddress[i];
                        
                        const checkNative = await prisma.coin_networks.findFirst({
                            where:{
                                network_id:Number(wallet.network_id),
                                currency_id:Number(wallet.coin_id),
                                type: NATIVE_COIN
                            }
                        });
                        // console.log('checkNative',checkNative);
                        
                        if (checkNative) {
                            
                            const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                                where:{
                                    address:address,
                                    transaction_id: tx,
                                    coin_id : Number(wallet.coin_id)
                                }
                            });
                            if (!checkDepositTransaction) {
                                walletAddressData = {
                                    address : address,
                                    receiver_wallet_id : Number(wallet.wallet_id),
                                    address_type : ADDRESS_TYPE_EXTERNAL,
                                    coin_type : wallet.coin_type,
                                    amount : amount,
                                    transaction_id : tx,
                                    status : 1,
                                    confirmations : 1,
                                    from_address : fromAddress,
                                    network_type : Number(wallet.network_id),
                                    network_id : Number(wallet.network_id),
                                    block_number : blockNumber,
                                    coin_id :Number(wallet.coin_id),
                                }
                            }
                        } 
                    }
                } else {
                    const checkContractAddresses = await prisma.coin_networks.findMany({
                        where:{
                            contract_address:address
                        }
                    });
                    
                    
                    // console.log('length => ', checkContractAddresses.length);
                    if(checkContractAddresses && checkContractAddresses.length > 0) {
                        for(let j=0; j<checkContractAddresses.length; j++) {
                            let checkContractAddress = checkContractAddresses[j];
                            // console.log('checkContractAddress => ',checkContractAddress);
                            const contractData = await decodeContractInputParameter(rpcUrl,address,inputs,checkContractAddress)
                            // console.log('contractData => ', contractData)
                            // console.log('network id => ', Number(checkContractAddress.network_id))
                            // console.log('currency id => ', Number(checkContractAddress.currency_id))
                            if(contractData.to_address) {
                                walletAddress = await prisma.wallet_address_histories.findFirst({
                                    where:{
                                        address:contractData.to_address,
                                        network_id: Number(checkContractAddress.network_id),
                                        coin_id:Number(checkContractAddress.currency_id)
                                    }
                                });
                                if(walletAddress) {
                                    // console.log('walletAddress => ',walletAddress);
                                    const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                                        where:{
                                            address:contractData.to_address,
                                            transaction_id: tx,
                                            coin_id : Number(walletAddress.coin_id)
                                        }
                                    });
                                    if (!checkDepositTransaction) {
                                        walletAddressData = {
                                            address : contractData.to_address,
                                            receiver_wallet_id : Number(walletAddress.wallet_id),
                                            address_type : ADDRESS_TYPE_EXTERNAL,
                                            coin_type : walletAddress.coin_type,
                                            amount : contractData.amount,
                                            transaction_id : tx,
                                            status : 1,
                                            confirmations : 1,
                                            from_address : fromAddress,
                                            network_type : Number(walletAddress.network_id),
                                            network_id : Number(walletAddress.network_id),
                                            block_number : blockNumber,
                                            coin_id : Number(walletAddress.coin_id),
                                        }
                                        // console.log('walletAddressData', walletAddressData)
                                    }
                                }
                            }
                        }
                        
                        
                    }
                }
            }
        }
        
    // console.log('walletAddressData => ',walletAddressData)
    
    } catch(err:any) {
        // console.log('checkNativeDepositAddress err',err.stack);
    }
    return walletAddressData;
}
// get details from transaction block
const getTransactionDetailsData = async (rpcUrl:any,transaction:any,resBlockNumber:number) => {
    let data = {};
    const rawData = transaction.raw_data;
    const contractType = rawData.contract[0].type;
    const rawTransactionData = rawData.contract[0].parameter;
    if (contractType === 'TransferContract') {
    
        const convertData = await convertAddressAmount(rpcUrl,'native',rawTransactionData.value.owner_address,rawTransactionData.value.to_address,rawTransactionData.value.amount);
        const fromAddress = convertData.from_address;
        const toAddress = convertData.to_address;
        const amount = convertData.amount;
        let tx_type = 'native';
        data = {
            'tx_type': tx_type,
            'from_address': fromAddress,
            'to_address': toAddress,
            'amount': amount,
            'block_number': resBlockNumber,
            'transaction_id' : transaction.txID,
            'contract_address' : '',
            'fee_limit': rawData.fee_limit ? rawData.fee_limit : 0
            
        }
        
    } else if(contractType === 'TriggerSmartContract') {
        const valueData = rawTransactionData.value.data;
            const method = valueData.slice(0, 10);
            if (method === 'a9059cbb00') {
            const toAddress = '0x' + valueData.slice(32, 72); 
            let amountData = '0x' + valueData.slice(74);
            const amount = parseInt(amountData, 16);
            const convertData = await convertAddressAmount(rpcUrl,'token',rawTransactionData.value.owner_address,toAddress,amount,rawTransactionData.value.contract_address);
            const fromAddress = convertData.from_address;
            const to_address = convertData.to_address;
            const amountVal = convertData.amount;
            const contract_address = convertData.contract_address;

            data = {
                'tx_type': 'token',
                'from_address': fromAddress,
                'to_address': to_address,
                'amount': amountVal,
                'block_number': resBlockNumber,
                'transaction_id' : transaction.txID,
                'contract_address' : contract_address,
                'fee_limit': rawData.fee_limit ? rawData.fee_limit : 0
            }
        }
    }
   
    return data;
}
// check deposit addrees
const checkTronNativeDepositAddress = async(rpcUrl:string,res:any,resBlockNumber:number) => {
    // console.log('checkTronNativeDepositAddress','start process')

    const txData:any = await getTransactionDetailsData(rpcUrl,res,resBlockNumber);
    let walletAddressData:any = null;
    // console.log('txData => ',txData)
    if(txData) {
        let address = txData.to_address;
        let blockNumber = txData.block_number;
        let tx = txData.transaction_id;
        let amount = txData.amount;
        let walletAddress:any = null;
        
        if (address) {
            if (txData.tx_type == 'native') {
                // native tron coin deposit
                walletAddress = await prisma.wallet_address_histories.findMany({
                    where:{
                        address:address
                    }
                });
                if (walletAddress && walletAddress.length > 0) {
                    for(let i=0; i<walletAddress.length; i++) {
                        const wallet:any = walletAddress[i];
                        const checkNative = await prisma.coin_networks.findFirst({
                            where:{
                                network_id:Number(wallet.network_id),
                                currency_id:Number(wallet.coin_id),
                                type: NATIVE_COIN
                            }
                        });
                        if (checkNative) {
                        
                            const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                                where:{
                                    address:address,
                                    transaction_id: tx,
                                    coin_id : Number(wallet.coin_id)
                                }
                            });
                            if (!checkDepositTransaction) {
                                walletAddressData = {
                                    address : address,
                                    receiver_wallet_id : Number(wallet.wallet_id),
                                    address_type : ADDRESS_TYPE_EXTERNAL,
                                    coin_type : wallet.coin_type,
                                    amount : amount,
                                    transaction_id : tx,
                                    status : 1,
                                    confirmations : 1,
                                    from_address : txData.from_address,
                                    network_type : Number(wallet.network_id),
                                    network_id : Number(wallet.network_id),
                                    block_number : blockNumber,
                                    coin_id :Number(wallet.coin_id),
                                }
                            }
                        } 
                    }
                }
            } else {
                // token deposit check
                const checkContractAddresses = await prisma.coin_networks.findMany({
                    where:{
                        contract_address:txData.contract_address
                    }
                });
                
                if(checkContractAddresses && checkContractAddresses.length > 0) {
                    
                    for(let j=0; j<checkContractAddresses.length; j++) {
                        let checkContractAddress = checkContractAddresses[j];
                        
                        walletAddress = await prisma.wallet_address_histories.findFirst({
                            where:{
                                address:address,
                                network_id: Number(checkContractAddress.network_id),
                                coin_id:Number(checkContractAddress.currency_id)
                            }
                        });
                        
                        if(walletAddress) {
                            // console.log('walletAddress => ',walletAddress);
                            const checkDepositTransaction = await prisma.deposite_transactions.findFirst({
                                where:{
                                    address:address,
                                    transaction_id: tx,
                                    coin_id : Number(walletAddress.coin_id)
                                }
                            });
                            if (!checkDepositTransaction) {
                                walletAddressData = {
                                    address : address,
                                    receiver_wallet_id : Number(walletAddress.wallet_id),
                                    address_type : ADDRESS_TYPE_EXTERNAL,
                                    coin_type : walletAddress.coin_type,
                                    amount : amount,
                                    transaction_id : tx,
                                    status : 1,
                                    confirmations : 1,
                                    from_address : txData.from_address,
                                    network_type : Number(walletAddress.network_id),
                                    network_id : Number(walletAddress.network_id),
                                    block_number : blockNumber,
                                    coin_id : Number(walletAddress.coin_id),
                                }
                                // console.log('walletAddressData', walletAddressData)
                            }
                        }
                        
                    } 
                }
            }      
        }
    }

   
    // console.log('walletAddressData => ',walletAddressData)
    return walletAddressData;
}

// insert deposit to user wallet
const depositUserWallet = async(depositData:any) => {
    if (depositData && depositData.length > 0) {
        for(let x = 0; x < depositData.length; x++) {
            const checkTransaction = await prisma.deposite_transactions.findFirst({
                where:{
                    transaction_id: depositData[x].transaction_id,
                    address:depositData[x].address
                }
            });
            const checkSystemWallet = await prisma.admin_wallet_keys.findFirst({
                where:{
                    address:depositData[x].from_address
                }
            });
            if (!checkTransaction && !checkSystemWallet) {
                const date = new Date();
                let prepare = depositData[x]
                prepare.address_type = (depositData[x].address_type).toString();
                prepare.network_type = (depositData[x].network_type).toString();
                prepare.block_number = depositData[x].block_number ? (depositData[x].block_number).toString() : '';
                prepare.created_at = date.toISOString();
                prepare.updated_at = date.toISOString();
                const createDeposit = await prisma.deposite_transactions.create({
                    data:prepare
                });
                console.log('createDeposit',createDeposit);
                if (createDeposit) {
                    const senderWalletUpdate = await prisma.wallets.update({
                        where: { id: Number(createDeposit?.receiver_wallet_id) },
                        data: {
                          balance: {
                            increment: createDeposit?.amount
                          },
                        },
                      });
                      console.log('senderWalletUpdate', senderWalletUpdate)
                }
            }
        }
    }
}
// update coin block number
const updateNetworkBlockNumber = async(network_id:any,block_number:number) => {
    // let data:any=[];
    // console.log(' updateNetworkBlockNumber network_id =>', network_id)
    // console.log(' updateNetworkBlockNumber block_number =>', block_number)
    let blockNumber:any = addNumbers(block_number,1);
    // console.log('blockNumber', blockNumber)
    blockNumber = blockNumber.toString();
    // console.log(data,'updateNetworkBlockNumber')
    await prisma.notified_blocks.updateMany({
        where:{
            network_id:Number(network_id)
        },
        data:{
            block_number: blockNumber
        }
    })
}

// update coin block number
const updateBlockNumberNetwork = async(network_id:any,from_block_number:number,to_block_number:number) => {
    console.log('updateBlockNumberNetwork from_block_number',from_block_number);
    console.log('updateBlockNumberNetwork to_block_number',to_block_number);
    if (from_block_number && to_block_number) {
        const fromBlockNumber = from_block_number;
        const toBlockNumber = to_block_number;
        await prisma.networks.update({
            where:{
                id:Number(network_id)
            },
            data:{
                from_block_number: fromBlockNumber,
                to_block_number: toBlockNumber,
            }
        });
    }
    
}

export {
    checkCoinDeposit,
    checkTrxNativeDeposit,
    checkTrxDeposit,
    getTransactionDetailsData,
    checkBlockCoinDeposit,
}