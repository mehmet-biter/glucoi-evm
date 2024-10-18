import { PrismaClient } from "@prisma/client";
import { custome_decrypt, createUniqueCode } from "../../utils/helper";
import { EVM_BASE_COIN, TRON_BASE_COIN, STATUS_ACTIVE, STATUS_PENDING, SOLANA_BASE_COIN } from "../../utils/coreConstant";
import { generateErrorResponse, generateSuccessResponse } from "../../utils/commonObject";
import solanaWeb from "@solana/web3.js";
import { Keypair as KeyPair, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getTokenMetadata, getMint, TOKEN_PROGRAM_ID, getExtensionData, ExtensionType } from "@solana/spl-token";
import  {Metadata}  from "@metaplex-foundation/mpl-token-metadata";
import { transfer as Spl_transfer, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import bs58 from "bs58";

const prisma = new PrismaClient();
const createSolAddress = async (rpc?: string) => {
    try {
        // let rpcTestNet = solanaWeb.clusterApiUrl('testnet');
        // new Connection(rpcTestNet);
        let keyPair = KeyPair.generate();
        if (keyPair) {
            let address = keyPair.publicKey.toBase58();
            let secretKey = bs58.encode(keyPair.secretKey);
            const data = {
                address: address,
                pk: secretKey,
            }
            return generateSuccessResponse("Wallet created successfully", data);
        } 
        return generateErrorResponse("Wallet not generated");
    } catch(err) {
        console.log("createSolAddress service", err);
        return generateErrorResponse(err.message || "Something went wrong");
    }
};

const sendSol = async (
    rpcUrl: string,
    toAddress: string,
    amount: number,
    privateKey: string
) => {
    try {
        let connection  = new Connection(rpcUrl);

        let payerSecretUnitArray = bs58.decode(privateKey);
        let payer       = KeyPair.fromSecretKey(payerSecretUnitArray);
        let toAccount   = (new PublicKey(toAddress));
        let transaction = new Transaction();

        let accountBalance = await connection.getBalance(payer.publicKey);
        let systemBalance  = accountBalance / solanaWeb.LAMPORTS_PER_SOL;

        if(amount > systemBalance){
            return generateErrorResponse("System wallet dose not have enough SOL to send");
        }

        transaction.add(
            solanaWeb.SystemProgram.transfer({
                fromPubkey: payer.publicKey,
                toPubkey: toAccount,
                lamports: solanaWeb.LAMPORTS_PER_SOL * amount,
            }),
        );

        let transaction_hash = await solanaWeb.sendAndConfirmTransaction(connection, transaction, [payer]);
        //console.log("SOL transaction_hash", transaction_hash);

        if(transaction_hash){
            return generateSuccessResponse('SOL transaction successfully',{
                transaction_id: transaction_hash,
                used_gas: 0
            });
        }
        return generateErrorResponse('SOL Transaction failed');

    } catch (error) {
        console.log("sendSol service", error);
        return generateErrorResponse(error.message || "Something went wrong");
    }
}

const sendSolanaToken = async (
    rpcUrl: string,
    tokenAddress: string,
    toAddress: string,
    decimal: number,
    amount: number,
    privateKey: string
) => {

    try {
        let payerSecretUnitArray = bs58.decode(privateKey);

        let connection  = new Connection(rpcUrl);
        let payer       = KeyPair.fromSecretKey(payerSecretUnitArray);
        let toAccount   = new PublicKey(toAddress);
        const mintAddress = new PublicKey(tokenAddress);

        const PRIORITY_RATE = 12345; // MICRO_LAMPORTS
        const PRIORITY_FEE_INSTRUCTIONS = solanaWeb.ComputeBudgetProgram.setComputeUnitPrice({microLamports: PRIORITY_RATE});

        let sourceAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mintAddress,
            payer.publicKey
        );

        let accountBalance = await connection.getTokenAccountBalance(sourceAccount.address);
        let accountBalanceAmount = Number(accountBalance?.value?.amount || 0);
        let accountBalanceDecimals = Number(accountBalance?.value?.decimals || 0);
        let systemBalance  = accountBalanceAmount / Math.pow(10, accountBalanceDecimals);

        if(amount > systemBalance){
            return generateErrorResponse("System wallet dose not have enough token to send");
        }

        let destinationAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mintAddress,
            toAccount
        );

        const transferAmountInDecimals = amount * Math.pow(10, decimal);
    
        const transferInstruction = createTransferInstruction(
            sourceAccount.address,
            destinationAccount.address,
            payer.publicKey,
            transferAmountInDecimals
        );

        let latestBlockhash = await connection.getLatestBlockhash("finalized");
        const messageV0 = new solanaWeb.TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [PRIORITY_FEE_INSTRUCTIONS, transferInstruction],
        }).compileToV0Message();

        const versionedTransaction = new solanaWeb.VersionedTransaction(messageV0);
        versionedTransaction.sign([payer]);

        const transaction_hash = await connection.sendTransaction(versionedTransaction);
        //console.log(`Transaction Submitted: ${transaction_hash}`);

        const confirmation = await connection.confirmTransaction({
            signature: transaction_hash,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, "confirmed");

        if (confirmation.value.err) {
            return generateErrorResponse("Transaction failed");
        }
        return generateSuccessResponse("Transaction successful", {
            transaction_id: transaction_hash,
            used_gas: 0
        });
    } catch (error) {
        console.log("sendSolanaToken service", error);
        return generateErrorResponse(error.message || "Something went wrong");
    }
}

const getLatestBlockNumber = async (rpc: string) => {
    try {
        let connection  = new Connection(rpc);
        let blockNumber = await connection.getLatestBlockhash();

        // get a block data
        // const slot = await connection.getSlot();
        // const block = await connection.getBlock(slot, {
        //     maxSupportedTransactionVersion: 0,
        // });
        
        return blockNumber.lastValidBlockHeight || 0;
    } catch (error) {
        console.log("getLatestBlockNumber service", error);
        return 0;
    }
}

const getSolanaTransactionByTrx = async (rpc: string, transaction_hash: string) => {
    try {
        let connection  = new Connection(rpc);

        // get a transaction data
        const transaction = await connection.getParsedTransaction(
            transaction_hash,
            { maxSupportedTransactionVersion: 0 }
        );

        if(!transaction) return generateErrorResponse("Transaction details not found");

        let tokenMetaData = transaction?.meta?.postTokenBalances;
        let instructions:any = transaction?.transaction?.message?.instructions;
        let parsedData = instructions[instructions.length - 1]?.parsed;

        let tx_type = 'native';
        let from_address = '';
        let to_address = '';
        let amount = '';
        let block_number = '';
        let transaction_id = transaction_hash;
        let contract_address = '';
        let fee_limit = transaction?.meta?.fee || 0;
        
        if(tokenMetaData && tokenMetaData.length){
            tx_type = 'token';
            from_address = tokenMetaData[0].owner;
            to_address = tokenMetaData[1].owner;
            contract_address = tokenMetaData[1].mint;

            let mint = await getMint(connection, new PublicKey(contract_address), "finalized");
            console.log("mint", mint);

            let info = parsedData?.info;
            if(info && mint.decimals){
                let amountInNumber = Number(info.amount || info.tokenAmount.amount || 0) / Math.pow(10, mint.decimals);
                amount = amountInNumber.toString();
            }            
        }else{
            let info = parsedData?.info;
            if(info){
                let amountInNumber = Number(info.lamports) / solanaWeb.LAMPORTS_PER_SOL;
                amount = amountInNumber.toString();
                from_address = info.source;
                to_address = info.destination;
            }
        }

        let transactionInfo = {
            tx_type : tx_type,
            from_address : from_address,
            to_address : to_address,
            amount : amount,
            block_number : block_number,
            transaction_id : transaction_id,
            contract_address : contract_address,
            fee_limit : fee_limit,
        }
        // console.log("transaction info", transactionInfo);
        if(transactionInfo)
            return generateSuccessResponse("Transaction get successfully", transactionInfo);
        return generateErrorResponse("Transaction not found");

    } catch (error) {
        console.log("getTransactionByTrx service", error);
        return generateErrorResponse(error.message || "Something went wrong");
    }
}

const getSolanaContractDetails = async (rpc: string, _tokenHolder: string, tokenAddress: string) => {
    try {
        let connection  = new Connection(rpc);

        let tokenHolder = new PublicKey(_tokenHolder);
        let mintAddress = new PublicKey(tokenAddress);
        // let metadata    = await connection.getTokenAccountsByOwner(tokenHolder, { mint: mintAddress });

        // if (metadata.value.length === 0) {
        //     throw new Error("No token accounts found for the provided mint address");
        // }

        // const tokenAccount = metadata.value[0].pubkey;

        // const PROGRAM_IDS:any = {
        //     metadata: new PublicKey(tokenAddress),
        // };
        // const metadataAddress:any = PublicKey.findProgramAddressSync(
        //     [
        //         Buffer.from("metadata"),
        //         // solanaWeb.SystemProgram.programId.toBuffer(),
        //         // tokenAccount.toBuffer()
        //     ], 
        //     // tokenAccount
        //     // new PublickKey(Metadata.MPL_TOKEN_METADATA_PROGRAM_ID)
        //     // solanaWeb.SystemProgram.programId
        //     PROGRAM_IDS.metadata
        // );

        let mint = await getMint(connection, mintAddress, "finalized");
        console.log("mint", mint);


        let metadataAddress1 = getAssociatedTokenAddressSync(mintAddress,tokenHolder);

        // console.log("metadataAddress", metadataAddress[0]);
        const metadataAccountInfo = await connection.getAccountInfo(metadataAddress1);
        console.log("metadataAccountInfo", metadataAccountInfo);

        if (!metadataAccountInfo || !metadataAccountInfo.data) {
            throw new Error("Failed to fetch metadata account data");
        }

        // let unmint = unpackMint(mintAddress, metadataAccountInfo);
        // console.log("unmint", unmint);
        console.log("unmint", metadataAccountInfo.data.toString());

        const metadata = await getTokenMetadata(connection, mintAddress, "confirmed", TOKEN_PROGRAM_ID);
        console.log("metadata", metadata);

        // return metadata;

        // const accountMetaData = JSON.parse(metadataAccountInfo.data.toString("utf8"));
        // const name   = accountMetaData.data.name;
        // const symbol = accountMetaData.data.symbol;
        // const supply = accountMetaData.data.supply;
      
        //   console.log(`Token Name: ${name}`);
        // console.log(`Token Symbol: ${symbol}`);
        // console.log(`Token Supply: ${supply}`);

        // console.log("metadata", metadata.value[0].account.data);
    } catch (error) {
        console.log("getSolanaContractDetails service", error);
        return generateErrorResponse("Something went wrong");
    }
}

const takeCoinFromSolanaNetwork = async (network:any, systemWallet:any, userWallet:any):Promise<any> => {

    let userBalance = 0;
    let gas:any = 0;
    let sendAmount:any = 0;
    let needGas = true;
    const decimal = 9;
    try {
        let payerKey =  bs58.decode(await custome_decrypt(userWallet.wallet_key));
        let payer = KeyPair.fromSecretKey(payerKey);
        let systemWalletAddress = new PublicKey(systemWallet.address);
        let connection  = new Connection(network.rpc_url);
        // system wallet balance
        let accountBalance = await connection.getBalance(systemWalletAddress);
        let systemWalletBalance  = accountBalance / solanaWeb.LAMPORTS_PER_SOL;
        let mintAddress = network.contractAddress? new PublicKey(network.contractAddress) : null;

        if(systemWalletBalance < 0){
            return generateErrorResponse("System wallet dose not have enough SOL to send");
        }     
       
        // check user wallet balance
        let userWalletAddress  = new PublicKey(userWallet.address);
        let userAccountBalance = await connection.getBalance(userWalletAddress);
        let userBalance  = userAccountBalance / solanaWeb.LAMPORTS_PER_SOL;
        console.log('userBalance =>', userBalance);
        
        if(network.is_native) {
            if (network.amount > userBalance) {
                return generateErrorResponse("User native wallet does not have enough balance. Deposited balance is "+network.amount+ " network wallet balance is "+userBalance);
            }
        } else {

            let sourceAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                payer,
                mintAddress,
                userWalletAddress
            );
            // check token balance
            console.log("getTokenAccountBalance", userWalletAddress);
            let tokenBalance = await connection.getTokenAccountBalance(sourceAccount.address);
            let tokenBalanceAmount = Number(tokenBalance?.value?.amount || 0);
            let tokenBalanceDecimals = Number(tokenBalance?.value?.decimals || 0);
            let userTokenBalance  = tokenBalanceAmount / Math.pow(10, tokenBalanceDecimals);
            console.log("tokenBalance", tokenBalance);
            console.log("tokenBalanceDecimals", tokenBalanceDecimals);
            console.log('checkTokenBalance', userTokenBalance);
            if(network.amount > userTokenBalance){
                return generateErrorResponse("Insufficient token balance , current balance is "+ Number(userTokenBalance));
            }
        }
        
        // Check Estimate Gas
            console.log("Estimate gas limit");
            if(network.is_native){
                sendAmount = 0;
            }else{
                console.log('est gas', 'calculating...')
                let ethEstimateGas = await getEstmateFee(connection, systemWalletAddress, userWalletAddress);

                console.log('ethEstimateGas', ethEstimateGas);
                if(!ethEstimateGas.success)
                    return generateErrorResponse(ethEstimateGas.message ?? "Estimate gas check failed");

                gas = Number((ethEstimateGas?.data || 0) + 3);
                gas = gas / solanaWeb.LAMPORTS_PER_SOL;
                sendAmount = gas; console.log("sendAmount", sendAmount);
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
                if (sendAmount >= systemWalletBalance) {
                    return generateErrorResponse("System wallet does not have enough balance to send fees.Fees needed "+sendAmount+ " and system balance has "+systemWalletBalance);
                }
                console.log('need gas amount = >', sendAmount);
                let sendNativeCoin = await sendSol(
                        network.rpc_url, 
                        userWallet.address, 
                        sendAmount, 
                        await custome_decrypt(systemWallet.pv)
                );
                if(!sendNativeCoin.success)
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
            let userWalletBalanceAgain = await connection.getBalance(userWalletAddress);
            let userBalanceAgain  = userAccountBalance / solanaWeb.LAMPORTS_PER_SOL;
            console.log('userWalletBalanceAgain => ' +userWallet.address, userBalanceAgain);

            // gas checking again
            console.log('needed gas was '+gas);
            console.log('now user trx balance is '+userBalanceAgain);
            if (gas > userBalanceAgain) {
                return generateErrorResponse("User wallet has not enough gas . Needed gas is "+gas+ " but trx balance is "+userBalanceAgain+ " .Try again ");
            }
        }

        // send coins to system wallet from user
        let sendToSystemWallet = (network.is_native) 
            ?  await sendSol(
                network.rpc_url, 
                systemWallet.address, 
                network.amount, 
                await custome_decrypt(userWallet.wallet_key)
            )
            : await sendSolanaToken(
                network.rpc_url, 
                network.contractAddress,
                systemWallet.address,
                network.decimal,
                network.amount,
                await custome_decrypt(userWallet.wallet_key)
            ) ;

        console.log('sendToSystemWallet', sendToSystemWallet)    
        if(sendToSystemWallet.success) {
            console.log("token or coin received success", sendToSystemWallet.data)

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
                    transaction_hash: sendToSystemWallet.data.transaction_id,
                    status: STATUS_ACTIVE,
                    type: 1, // 1 = deposit type
                }
            });
            console.log('adminTokenReceive', adminTokenReceive);

            return generateSuccessResponse("Coins received successfully");
        } else {
            console.log('coin send failed',sendToSystemWallet?.message);
            return generateErrorResponse(sendToSystemWallet?.message ?? "Coins received Failed");
        }
        
    } catch(err:any) {
        console.log(err);
        return generateErrorResponse(err.stack);
    }

}

const getEstmateFee = async (connection: any, fromPublicKey: PublicKey, toPublicKey:PublicKey) => {

    try{
        let blockhash = await connection.getLatestBlockhash();
        let transaction = new solanaWeb.Transaction( {
            feePayer: fromPublicKey,
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight
        });

        transaction.add(
            solanaWeb.SystemProgram.transfer({
                fromPubkey: fromPublicKey,
                toPubkey: toPublicKey,
                lamports: solanaWeb.LAMPORTS_PER_SOL * 10.0000001,
            }),
        );

        let estimateFee = await transaction.getEstimatedFee(connection);

        if(estimateFee) return generateSuccessResponse("Estimate fees fetch successfully", estimateFee);
    } catch (error) {
        console.log("Solana getEstmateFee ", error);
        return generateErrorResponse("Estimate fee failed to fetch", 0);
    }
}

const getSolAddressByKey = async(pk:string) => {
    try {
        let secretUnitArray = bs58.decode(pk);
        let account = KeyPair.fromSecretKey(secretUnitArray);
        if(account){
            return {
                address: account.publicKey
            };
        }
        return {};
    } catch(err:any) {
      console.log('getTronAddressByKey ex', err.stack);
      return {};
    }
  }

export {
    createSolAddress,
    sendSol,
    sendSolanaToken,
    getLatestBlockNumber,
    getSolanaContractDetails,
    getSolanaTransactionByTrx,
    takeCoinFromSolanaNetwork,
    getSolAddressByKey
}