import { PrismaClient } from "@prisma/client";
import { EVM_BASE_COIN, TRON_BASE_COIN, STATUS_ACTIVE, STATUS_PENDING, SOLANA_BASE_COIN } from "../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../utils/commonObject";
import { getEthBalance, estimateEthFee, sendEthCoin, waitForTxConfirmedForGas, getGasPrice, getDepositLatestBlockNumber, estimateEthFeeWithoutChecking } from "./evm/erc20.web3.service";
import { custome_decrypt, createUniqueCode, customFromWei, multiplyNumbers } from "../utils/helper";
import { NATIVE_COIN } from "../utils/coreConstant";
import { sendErc20Token, getERC20tokenTransactionDetails, getContractDetails as getEvmContractDetails, estimateEthTokenFee, estimateEthTokenFeeWithoutChecking, getEthTokenBalance, getAddressByKey } from "./evm/erc20.token.service";
import { sendTrxCoin, getTrxBalance, getTrxTransactionBlock, getTrcLatestBlockNumber, estimateTransactionFee, getTronAddressByKey } from "./evm/trx.tron-web.service";
import { sendTrxToken, getTrxEstimateGas, getContractDetails, getTrc20TokenBalance } from "./evm/trx.token.service";
import { getLatestBlockNumber, getSolanaContractDetails, getSolanaTransactionByTrx, takeCoinFromSolanaNetwork, getSolAddressByKey } from "./evm/solana.service";
//@ts-ignore
import TronWeb from "tronweb";
import { number } from "joi";


const prisma = new PrismaClient();

const receiveDepositCoinProcess = async(request:any) => {
    try {
        if(request.transaction_id) {
            const transaction = await prisma.deposite_transactions.findFirst({
                where:{
                    AND:{
                        id:Number(request.transaction_id),
                        status:STATUS_ACTIVE,
                        is_admin_receive:STATUS_PENDING
                    }
                }
            });
            if(transaction && transaction.network_id) {
                console.log('transaction amount = ',transaction.amount);
                const network_id = transaction.network_id;
                const coin_id = transaction.coin_id;
                const coinNetwork:any = await prisma.$queryRaw`
                SELECT * FROM coin_networks
                JOIN networks ON networks.id = coin_networks.network_id
                where coin_networks.network_id = ${network_id} and coin_networks.currency_id = ${coin_id}`;

                const coin:any = await prisma.coins.findFirst({ where:{ id:Number(coin_id) } });
                if(!coin) return generateErrorResponse('Coin not found');

                let coinNetworkData:any= {}
                if (coinNetwork.length){

                    const supported_network:any = await prisma.supported_networks.findFirst({ where:{ AND :{ slug:coinNetwork[0].slug }} });
                    if(!supported_network) return generateErrorResponse('Supported network not found');


                    coinNetworkData = coinNetwork[0]; // Extract the first item from the array

                    coinNetworkData.transaction_id  = transaction.id;
                    coinNetworkData.id              = coinNetwork[0]?.id?.toString();
                    coinNetworkData.network_id      = coinNetwork[0]?.network_id?.toString();
                    coinNetworkData.currency_id     = coinNetwork[0]?.currency_id?.toString();
                    coinNetworkData.coin_type       = coin.coin_type;
                    coinNetworkData.native_coin_type= supported_network.native_currency;
                    coinNetworkData.decimal         = coin.decimal;
                    coinNetworkData.gas_limit       = supported_network.gas_limit ?? 0;
                    coinNetworkData.from_address    = transaction.from_address;
                    coinNetworkData.amount          = transaction.amount;
                    coinNetworkData.blockConfirm    = coinNetwork[0]?.block_confirmation ?? 1;
                    coinNetworkData.is_native       = (coinNetwork[0]?.type == NATIVE_COIN) ? true : false;
                    coinNetworkData.contractAddress = coinNetwork[0]?.contract_address ?? null;
                                   
                    const systemWallet = await prisma.admin_wallet_keys.findFirst({
                        where:{
                            network_id:Number(coinNetworkData.network_id)
                        }
                    });
                    const userWallet = await prisma.wallets.findFirst({
                        where:{
                            id:transaction.receiver_wallet_id
                        }
                    });
                    const userWalletAddress =  await prisma.wallet_address_histories.findFirst({
                        where:{
                            address:transaction.address,
                            wallet_id:transaction.receiver_wallet_id,
                            coin_id: Number(coinNetworkData?.currency_id),
                            user_id:Number(userWallet?.user_id)
                        }
                    })

                    if(!systemWallet) return generateErrorResponse('System wallet not found');
                    if(!userWallet) return generateErrorResponse('Deposited wallet not found');
                    if(!userWalletAddress) return generateErrorResponse('Deposited wallet address not found');

                    // console.log('systemWallet', systemWallet);
                    // console.log('coinNetworkData', coinNetworkData);
                    if (coinNetworkData.base_type == EVM_BASE_COIN) 
                        return await takeCoinFromEvmNetwork(coinNetworkData, systemWallet, userWalletAddress);
                    
                    if (coinNetworkData.base_type == TRON_BASE_COIN) 
                        return await takeCoinFromTronNetwork(coinNetworkData, systemWallet, userWalletAddress);
                    
                    if (coinNetworkData.base_type == SOLANA_BASE_COIN) 
                        return await takeCoinFromSolanaNetwork(coinNetworkData, systemWallet, userWalletAddress);
                    
                    return generateErrorResponse('Transaction network not found');
                } 
                return generateErrorResponse('Network not found');
            } 
            return generateErrorResponse('Transaction or network not found');
        } 
        return generateErrorResponse('Transaction id not found');
    } catch (err:any) {
        console.log('receiveDepositCoinProcess',err);
        return generateErrorResponse(err.message ?? "Something went wrong");
    }
}

// receive evm base coin and token
const receiveEthCoinOrTokenToSystemWallet = async () => {
    try {

    } catch(err:any) {
        console.log('receiveEthCoinOrTokenToSystemWallet',err);
        return generateErrorResponse(err.stack)
    }
}

const takeCoinFromEvmNetwork = async (network:any, systemWallet:any, userWallet:any ):Promise<any> => {

    let userBalance = 0;
    let gas:any = 0;
    let sendAmount:any = 0;
    let needGas = true;

    // console.log('network => ', network);
    console.log('db amount =>', network.amount);
    // system wallet balance
    let systemWalletBalance = await getEthBalance(network.rpc_url, systemWallet.address);
    if(!(systemWalletBalance.hasOwnProperty("success") && systemWalletBalance.success))
            return generateErrorResponse(systemWalletBalance?.message ?? "System wallet balance check failed");

    // system wallet balance check
    if(!(Number(systemWalletBalance?.data) > 0)) 
            return generateErrorResponse("System wallet dose not have enough balance");

    // check user wallet balance
    let userWalletBalance = await getEthBalance(network.rpc_url, userWallet.address);
    if(!(userWalletBalance.hasOwnProperty("success") && userWalletBalance.success))
            return generateErrorResponse(userWalletBalance?.message ?? "User wallet balance check failed");
    userBalance = userWalletBalance?.data;

    
    if (network.base_type == EVM_BASE_COIN) {
        
        if(network.is_native) {
            // native coin 
            if (network.amount > userBalance) {
                return generateErrorResponse('User address has not enough coin. current network balance is '+userBalance);
            }
        } else {
            // token 
            
            // check user address token balance
            let userTokenBalance = await getEthTokenBalance(network.rpc_url,userWallet.address,network.contractAddress);
            if (!userTokenBalance.success) {
                return generateErrorResponse(userTokenBalance?.message ?? "Token balance calculate failed");
            }
            // console.log('userTokenBalance => ',userTokenBalance);
            // console.log('network.amount', network.amount);
            // console.log('Number(userTokenBalance.data)', Number(userTokenBalance.data));
            if (network.amount > Number(userTokenBalance.data)) {
                return generateErrorResponse('User address has not enough token. current network balance is '+userTokenBalance.data);
            }
        }

        let feesNeed = false;
        let feesAmount:any = 0;
        // check estimate gas for taking token from user to admin
        if(!network.is_native) {
            let checkEstimateGasCal:any = await checkEstimateGas(network,userWallet.address,systemWallet.address);
            console.log(checkEstimateGasCal);
            
            if (checkEstimateGasCal?.success) {
                let calEstFees = checkEstimateGasCal.data;
                console.log('calEstFees ->', calEstFees);
                
                calEstFees = parseFloat(calEstFees.toString()).toFixed(18);
                console.log('balance = ',userBalance);
                console.log('calEstFees = ',calEstFees);
                
                if (calEstFees > userBalance) {

                    feesNeed = true;
                    feesAmount  = calEstFees - userBalance;
                    feesAmount  = parseFloat(feesAmount.toString()).toFixed(18);
                    // console.log('feesAmount = ',feesAmount);
                    console.log('need some fees feesAmount = ',feesAmount)
                } else {
                    console.log('enough fees');
                }
            } else {
                return checkEstimateGasCal;
            }
        }
        

        console.log('feesAmount => ', feesAmount);
        if(feesNeed && feesAmount > 0 && !network.is_native) {
            console.log('need to send fees to user address from system wallet', 'fees = '+feesAmount);
            // need to send fees to user address from system wallet
            const sendNativeCoin = await sendEthCoin(
                network.rpc_url, 
                network.coin_type, 
                18, 
                network.gas_limit,
                systemWallet.address,
                userWallet.address,  
                feesAmount, 
                await custome_decrypt(systemWallet.pv)
            );
            console.log('sendNativeCoin', sendNativeCoin);
            if(!(sendNativeCoin.hasOwnProperty("success") && sendNativeCoin.success))
                return generateErrorResponse(sendNativeCoin?.message ?? "Gas sending failed");

            let gasTransactionHistory = await prisma.estimate_gas_fees_transaction_histories.create({
                data:{
                    unique_code: createUniqueCode(),
                    wallet_id: Number(userWallet.wallet_id),
                    deposit_id: Number(network.transaction_id),
                    amount: feesAmount,
                    coin_type: network.coin_type,
                    admin_address: systemWallet.address,
                    user_address: userWallet.address,
                    transaction_hash: sendNativeCoin.data.transaction_id,
                    status: STATUS_ACTIVE,
                    type: 1, // 1 = deposit type
                }
            });
        } else {
            console.log('no fees need');
        }
        let sendableAmount = network.amount;
        if(network.is_native) {
            let generateNativeEstimateGas = await estimateEthFeeWithoutChecking(
                network.rpc_url,
                network.coin_type,
                18,
                network.gas_limit,
                userWallet.address,
                systemWallet.address,
                network.amount
            );
            console.log('generateNativeEstimateGas',generateNativeEstimateGas);
            if (!generateNativeEstimateGas.success) {
                return generateErrorResponse(generateNativeEstimateGas.message);
            }
            sendableAmount = generateNativeEstimateGas.data.sendable_amout
        }
        console.log('sendableAmount => ',sendableAmount);
        // return generateErrorResponse( "Working in progress");
        // now time to get token from user address to admin address
        let sendToWystemWallet = (network.is_native) 
        ?  await sendEthCoin(
            network.rpc_url, 
            network.coin_type, 
            18, 
            network.gas_limit,
            userWallet.address,  
            systemWallet.address, 
            sendableAmount, 
            await custome_decrypt(userWallet.wallet_key)
        )
        : await sendErc20Token(
            network.rpc_url, 
            network.contractAddress, 
            network.coin_type, 
            network.native_coin_type, 
            network.decimal ? network.decimal : 18, // native coin decimal
            network.gas_limit,
            userWallet.address,
            systemWallet.address,
            await custome_decrypt(userWallet.wallet_key),
            network.amount,
        ) ;

        if(!(sendToWystemWallet.hasOwnProperty("success") && sendToWystemWallet.success))
            return generateErrorResponse(sendToWystemWallet?.message ?? "Coins received Failed");

        const transaction = await prisma.deposite_transactions.update({
            where:{ id: network.transaction_id  },
            data: { status : STATUS_ACTIVE, is_admin_receive: STATUS_ACTIVE, transaction_id: sendToWystemWallet.data.transaction_id}
        });

        const adminTokenReceive = await prisma.admin_receive_token_transaction_histories.create({
            data: {
                unique_code: createUniqueCode(),
                amount: network.amount,
                deposit_id: Number(network.transaction_id),
                fees: "0",
                to_address: systemWallet.address,
                from_address: userWallet.address,
                transaction_hash: sendToWystemWallet.data.transaction_id,
                status: STATUS_ACTIVE,
                type: 1, // 1 = deposit type
            }
        });

        return generateSuccessResponse("Coins received successfully");
    } else {
        return generateErrorResponse("Invalid network "+network.base_type);
    }
}


// check estimate gas fees get value from user to admin
const checkEstimateGas = async (network:any,fromAddress:any,toAddress:any) => {
    try {
        let ethEstimateGas = await estimateEthTokenFeeWithoutChecking(
            network.rpc_url,
            network.contractAddress,
            network.coin_type,
            network.native_coin_type,
            18,
            network.gas_limit,
            fromAddress,
            toAddress,
            network.amount
        );
        if (ethEstimateGas.success == true) {
            let fees = ethEstimateGas.data.fee;
            return generateSuccessResponse('success',fees);
        }
        console.log('checkEstimateGas => ',ethEstimateGas);
        return ethEstimateGas;
        
        
    } catch(err:any) {
        console.log('checkEstimateGas ex',err);
        return generateErrorResponse(err.stack);
    }
}

const takeCoinFromTronNetwork = async (network:any, systemWallet:any, userWallet:any):Promise<any> => {

    let userBalance = 0;
    let gas:any = 0;
    let sendAmount:any = 0;
    let needGas = true;
    const decimal = 6;
    try {
        // system wallet balance
        let systemWalletBalance = await getTrxBalance(network.rpc_url, systemWallet.address);
        // console.log('systemWalletBalance => ' +systemWallet.address, systemWalletBalance);
        if(!(systemWalletBalance.hasOwnProperty("success") && systemWalletBalance.success)) {
            return generateErrorResponse(systemWalletBalance?.message ?? "System wallet balance check failed");
        }
        const systemBalance = Number(systemWalletBalance?.data);
        console.log('systemBalance =>', systemBalance);
        // system wallet balance check
        if(!(Number(systemWalletBalance?.data) > 0)) {
            console.log('System wallet dose not have enough balance');
            return generateErrorResponse("System wallet dose not have enough balance");
        }       

        // check user wallet balance
        let userWalletBalance = await getTrxBalance(network.rpc_url, userWallet.address);
        // console.log('userWalletBalance => ' +userWallet.address, userWalletBalance);

        if(!(userWalletBalance.hasOwnProperty("success") && (userWalletBalance.success || userWalletBalance.data === 0))) {
            return generateErrorResponse(userWalletBalance?.message ?? "User wallet balance check failed");
        }
            
        userBalance = Number(userWalletBalance?.data);
        console.log('userBalance =>', userBalance);
        
        if(network.is_native) {
            if (network.amount > userBalance) {
                return generateErrorResponse("User native wallet does not have enough balance. Deposited balance is "+network.amount+ " network wallet balance is "+userBalance);
            }
        } else {
            // check token balance
            const checkTokenBalance = await getTrc20TokenBalance(network.rpc_url,network.contractAddress,userWallet.address);
            console.log('checkTokenBalance', checkTokenBalance.data);
            if (network.amount > checkTokenBalance.data) {
                return generateErrorResponse("Insufficient token balance , current balance is "+ checkTokenBalance.data);
            }
        }
        
        // Check Estimate Gas
            console.log("Estimate gas limit");
            if(network.is_native){
                sendAmount = 0;
            }else{
                console.log('est gas', 'calculating...')
                let ethEstimateGas = await getTrxEstimateGas(
                    network.rpc_url,
                    userWallet.address,
                    systemWallet.address,
                    network.contractAddress,
                    network.amount,
                );
                console.log('ethEstimateGas', ethEstimateGas)
                if(!(ethEstimateGas.hasOwnProperty("success") && ethEstimateGas.success))
                    return generateErrorResponse(ethEstimateGas?.message ?? "Estimate gas check failed");

                gas = Number(ethEstimateGas?.data?.gas + 3); 
                sendAmount = gas; console.log("sendAmount", sendAmount)
            }
        

        // user wallet balance check and gas set
        if((userBalance > 0)){
            if(network.is_native) {
                userBalance = (userBalance > network.amount) ? (userBalance - network.amount) : (network.amount - userBalance);
            }
            console.log("User Balance Has:", userBalance.toFixed(decimal));
            console.log("Estimate Gas Fee:", gas.toFixed(decimal));

            if((userBalance >= gas)){
                console.log("User Balance > Gas", true);
                console.log("Gas no need to send");
                needGas = false;
            }else{
                console.log("User Balance > Gas", false);
                sendAmount = gas - userBalance;
                console.log("Gas need to send:", sendAmount.toFixed(decimal));
            }
        }

        // return generateErrorResponse( "User balance checking");
        // send gas to user if necessary
        if(needGas){
            if (!network.is_native) {
                sendAmount = Number(sendAmount.toFixed(decimal));
                if (sendAmount >= systemBalance) {
                    return generateErrorResponse("System wallet does not have enough balance to send fees.Fees needed "+sendAmount+ " and system balance has "+systemBalance);
                }
                console.log('need gas amount = >', sendAmount);
                let sendNativeCoin = await sendTrxCoin(
                        network.rpc_url, 
                        userWallet.address, 
                        sendAmount, 
                        await custome_decrypt(systemWallet.pv)
                );
                if(!(sendNativeCoin.hasOwnProperty("success") && sendNativeCoin.success))
                    return generateErrorResponse(sendNativeCoin?.message ?? "Gas sending failed");

                console.log("Gas sending success", sendNativeCoin.data);

                let gasTransactionHistory = await prisma.estimate_gas_fees_transaction_histories.create({
                    data:{
                        unique_code: createUniqueCode(),
                        wallet_id: Number(userWallet.wallet_id),
                        deposit_id: Number(network.transaction_id),
                        amount: sendAmount,
                        coin_type: network.coin_type,
                        admin_address: systemWallet.address,
                        user_address: userWallet.address,
                        transaction_hash: sendNativeCoin.data.hash,
                        status: STATUS_ACTIVE,
                        type: 1, // 1 = deposit type
                    }
                });
                console.log('gasTransactionHistory', gasTransactionHistory);
            }
            
        }
        // return generateSuccessResponse("Coins received testing");
        if (!network.is_native) {
            // check user wallet balance
            let userWalletBalanceAgain = await getTrxBalance(network.rpc_url, userWallet.address);
            console.log('userWalletBalanceAgain => ' +userWallet.address, userWalletBalance);

            if(!(userWalletBalanceAgain.hasOwnProperty("success") && (userWalletBalanceAgain.success || userWalletBalanceAgain.data === 0))) {
                return generateErrorResponse(userWalletBalanceAgain?.message ?? "User wallet balance check failed");
            }
            // gas checking again
            console.log('needed gas was '+gas);
            console.log('now user trx balance is '+userWalletBalanceAgain.data);
            if (gas > userWalletBalanceAgain.data) {
                return generateErrorResponse("User wallet has not enough gas . Needed gas is "+gas+ " but trx balance is "+userWalletBalanceAgain.data+ " .Try again ");
            }
        }

        // if (network.is_native) {
        //     const checkGas = await estimateTransactionFee(network.rpc_url,systemWallet.address,network.amount);
        //     console.log('checkGas',checkGas);
        // }
        // return generateErrorResponse("checking transaction");
        // send coins to system wallet from user
        let sendToWystemWallet = (network.is_native) 
            ?  await sendTrxCoin(
                network.rpc_url, 
                systemWallet.address, 
                network.amount, 
                await custome_decrypt(userWallet.wallet_key)
            )
            : await sendTrxToken(
                network.rpc_url, 
                network.contractAddress, 
                await custome_decrypt(userWallet.wallet_key),
                systemWallet.address,
                network.amount,
            ) ;

        console.log('sendToWystemWallet', sendToWystemWallet)    
        if(sendToWystemWallet.success) {
            console.log("token or coin received success", sendToWystemWallet.data)

            const transaction = await prisma.deposite_transactions.update({
                where:{ id: network.transaction_id  },
                data: { status : STATUS_ACTIVE, is_admin_receive: STATUS_ACTIVE}
            });
            // console.log('transaction', transaction);
            const adminTokenReceive = await prisma.admin_receive_token_transaction_histories.create({
                data: {
                    unique_code: createUniqueCode(),
                    amount: network.amount,
                    deposit_id: Number(network.transaction_id),
                    fees: "0",
                    to_address: systemWallet.address,
                    from_address: userWallet.address,
                    transaction_hash: sendToWystemWallet.data.hash,
                    status: STATUS_ACTIVE,
                    type: 1, // 1 = deposit type
                }
            });
            console.log('adminTokenReceive', adminTokenReceive);

            return generateSuccessResponse("Coins received successfully");
        } else {
            console.log('coin send failed',sendToWystemWallet?.message);
            return generateErrorResponse(sendToWystemWallet?.message ?? "Coins received Failed");
        }
        
    } catch(err:any) {
        console.log(err);
        return generateErrorResponse(err.stack);
    } 
}

const checkDepositByTxService = async (request:any) => {

    const network = await prisma.networks.findUnique({ where: { id: Number(request.network) } });
    if(!network) return generateErrorResponse("Network not found");

    const supported_network = await prisma.supported_networks.findFirst({ where: { AND: { slug: network.slug} } });
    if(!supported_network) return generateErrorResponse("This network not supported");

    const coin_network:any = await prisma.coin_networks.findUnique({ where: { id: Number(request.coin_network)} });
    if(! coin_network) return generateErrorResponse("Coin network not found");

    const coin = await prisma.coins.findUnique({ where: { id: Number(coin_network?.currency_id) } });
    if(!coin) return generateErrorResponse("Coin not found");
    
    if(!(Number(coin.decimal) > 0)) return generateErrorResponse("Coin Decimal is invalid");

    if(coin_network.type == NATIVE_COIN){        
        if(! (coin.coin_type == supported_network.native_currency))
            return generateErrorResponse("Coin is not match with supported native coin");
    }else{
        if(! (coin_network.contract_address))
            return generateErrorResponse("Contact address not found");

        if(network.base_type == EVM_BASE_COIN){
            let contact:any = await getEvmContractDetails((network?.rpc_url ?? ""), coin_network.contract_address);
            if(! (contact.hasOwnProperty("success") && contact.success))
                return generateErrorResponse(contact.message ?? "Faild to get token contract details in evm network");

            if(! (contact.data.symbol == coin.coin_type))
                return generateErrorResponse("Selected coin is invalid");
        }else if(network.base_type == TRON_BASE_COIN){
            let contact:any = await getContractDetails((network?.rpc_url ?? ""), coin_network.contract_address);
            if(! (contact.hasOwnProperty("success") && contact.success))
                return generateErrorResponse(contact.message ?? "Faild to get token contract details in tron network");

            if(! (contact.data.coin_type == coin.coin_type))
                return generateErrorResponse("Selected coin is invalid");
        }else if(network.base_type == SOLANA_BASE_COIN){
            // let contact:any = await getSolanaContractDetails((network?.rpc_url ?? ""), "BEmUSjqs7mpgaSXw6QdrePfTsD8aQHbdtnqUxa63La6E", coin_network.contract_address);
            // if(! (contact.hasOwnProperty("success") && contact.success))
            //     return generateErrorResponse(contact.message ?? "Faild to get token contract details in tron network");

            // if(! (contact.data.coin_type == coin.coin_type))
            //     return generateErrorResponse("Selected coin is invalid");
        }
    }

    if(network.base_type == EVM_BASE_COIN){
        let response = await getERC20tokenTransactionDetails((network?.rpc_url ?? ""), request.transaction_id, coin_network.contract_address, coin.decimal);
        // console.log("evm transaction response", response);
        if(response.hasOwnProperty("success") && response.success) {
            response.data.coin_type = coin.coin_type;
            response.data.address = response.data.toAddress;
            response.data.from = response.data.fromAddress;
            response.data.confirmations = 1;
            
            console.log("evm transaction response", response);
            return generateSuccessResponse("Transaction information get successfully", response.data);
        }
        return generateErrorResponse("Failed to get transaction information");
    }
    
    if(network.base_type == TRON_BASE_COIN){
        let response = await getTrxTransactionBlock((network?.rpc_url ?? ""), request.transaction_id, coin_network.contract_address, coin.decimal);
        // console.log('response data', response.data);
        if(response.hasOwnProperty("success") && response.success) {
            const resData = {
                hash: response.data.transaction_id,
                gas_used: response.data.fee_limit,
                txID: response.data.transaction_id,
                amount: response.data.amount,
                toAddress: response.data.to_address,
                fromAddress: response.data.from_address,
                coin_type: coin.coin_type,
                address: response.data.to_address,
                from: response.data.from_address,
                confirmations: 1,
            }
            // console.log('resdata', resData)
            return generateSuccessResponse("Transaction information get successfully", resData);
        }
        return generateErrorResponse("Failed to get transaction information");
    }

    if(network.base_type == SOLANA_BASE_COIN){
        let response = await getSolanaTransactionByTrx((network?.rpc_url ?? ""), request.transaction_id);
        console.log('response data sol', JSON.stringify(response.data));
        if(response.hasOwnProperty("success") && response.success) {
            const resData = {
                hash: response.data.transaction_id,
                gas_used: response.data.fee_limit,
                txID: response.data.transaction_id,
                amount: response.data.amount,
                toAddress: response.data.to_address,
                fromAddress: response.data.from_address,
                coin_type: coin.coin_type,
                address: response.data.to_address,
                from: response.data.from_address,
                confirmations: 1,
            }
            // console.log('resdata', resData)
            return generateSuccessResponse("Transaction information get successfully", resData);
        }
        return generateErrorResponse("Failed to get transaction information");
    }

    return generateErrorResponse("Invalid coin network");
    // const transactionData = getTransactionData(data);
}

const checkEvmCurrentBlock = async(request:any) => {
    try {
        const network = await prisma.networks.findFirst({
            where:{
                id:Number(request.id)
            }
        });
        let blockNumber = 0;
        if (network) {
            if (network.rpc_url) {
                var types = {};

                types[TRON_BASE_COIN]   = getTrcLatestBlockNumber;
                types[EVM_BASE_COIN]    = getDepositLatestBlockNumber;
                types[SOLANA_BASE_COIN] = getLatestBlockNumber;

                if (typeof types[network.base_type] == 'function') {
                    blockNumber = await types[network.base_type](network.rpc_url);
                }else{
                    return generateErrorResponse('Nothing found');
                }
                // if (network.base_type == TRON_BASE_COIN) {
                //     blockNumber = await getTrcLatestBlockNumber(network.rpc_url);
                // } else if(network.base_type == EVM_BASE_COIN) {
                //     blockNumber = await getDepositLatestBlockNumber(network.rpc_url);
                // } else {
                //     return generateErrorResponse('Nothing found');
                // }
            } else {
                return generateErrorResponse('Before check current block, Please add rpc url first');
            }
        } else {
            return generateErrorResponse('Network not found');
        }
        return generateSuccessResponse('Latest block number', blockNumber);
    } catch(err:any) {
        console.log('checkEvmCurrentBlock',err);
        return generateErrorResponse(err.stack)
    }
}

const checkContractInfo = async(request:any) => {
    try {
        const network = await prisma.networks.findFirst({
            where:{
                id:Number(request.id)
            }
        });
        let contractDetails = null;
        if (network) {
            if (network.rpc_url) {
                if (network.base_type == TRON_BASE_COIN) {
                    let contract = await getContractDetails(network.rpc_url, request.contract_address);
                    console.log(contract);
                    if(contract.success) {
                        contractDetails = {
                            chain_id: 0,
                            symbol: contract.data.coin_type,
                            name: contract.data.name,
                            token_decimal: contract.data.decimal
                        };
                    }else{
                        return generateErrorResponse(contract.message || 'Contact address not found');
                    }
                } else if(network.base_type == EVM_BASE_COIN) {
                    let contract = await getEvmContractDetails(network.rpc_url, request.contract_address);
                    if(contract.success) contractDetails = contract.data;
                    else return generateErrorResponse(contract.message || 'Contact address not found');
                } else {
                    return generateErrorResponse('Base type not found');
                }
            } else {
                return generateErrorResponse('Invalid rpc url');
            }
        } else {
            return generateErrorResponse('Network not found');
        }
        // return success message if contract details found
        if(contractDetails)
        return generateSuccessResponse('Contract details get successfully', contractDetails);

        // return error message if contract details not found
        return generateErrorResponse('Contract details not found');
    } catch(err:any) {
        console.log('checkContractInfo',err);
        return generateErrorResponse(err.stack)
    }
}

const checkWalletAddressByKey = async(request:any) => {
    try {
        const network = await prisma.networks.findUnique({ where: { id: Number(request.network || 0) } });
        if(!network) return generateErrorResponse("Network not found");

        let addressResponse:any = {};
        if(network.base_type == EVM_BASE_COIN){
            addressResponse = await getAddressByKey((network?.rpc_url || ""), request.private_key || "");
        }else if(network.base_type == TRON_BASE_COIN){
            addressResponse = await getTronAddressByKey((network?.rpc_url || ""), request.private_key || "");
        }else{
            addressResponse = await getSolAddressByKey(request.private_key || "");
        }
        console.log("aa dfsfs", addressResponse);
        if(addressResponse.address)
        return generateSuccessResponse('Wallet address found successfully', addressResponse);
        return generateErrorResponse('Wallet address not found');
    } catch(err:any) {
        console.log('checkWalletAddressByKey info',err);
        return generateErrorResponse(err.stack)
    }
}

export {
    receiveDepositCoinProcess,
    takeCoinFromTronNetwork,
    checkDepositByTxService,
    checkEvmCurrentBlock,
    checkContractInfo,
    checkWalletAddressByKey
}