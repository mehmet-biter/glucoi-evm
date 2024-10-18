import { checkCoinDeposit, checkTrxNativeDeposit, checkTrxDeposit as checkTronDeposit } from "../services/evm/deposit.service";
import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/common";
import { getTrxAddressByPk, sendTrxCoin } from "../services/evm/trx.tron-web.service";
import { sendTrxToken } from "../services/evm/trx.token.service";
import solana from "@solana/web3.js";
import { transfer as Spl_transfer, getOrCreateAssociatedTokenAccount, createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import bs58 from "bs58";

const sendEth = async (req: Request, res: Response) => {
    let request:any = req.body;
    console.log(request);
    const response = await sendEthCoin (
        request.rpcUrl,
        request.coinType, 
        request.coinDecimal, 
        request.gasLimit,
        request.from_address,
        request.to_address,
        request.amount,
        request.pk
    );
    console.log(response);
    if(response.success) {
        return successResponse(res,response.message,response.data);
    } else {
        return errorResponse(res,response.message,response.data);
    }
}

const checkDeposit = async(req: Request, res: Response) => {
    const response = await checkCoinDeposit();
    console.log('checkDeposit', 'executed');
    // console.log(response)
    return successResponse(res,'executed',response);
}

const checkTrxDeposit = async (req: Request, res: Response) => {
    const rpcUrl = 'https://nile.trongrid.io';
    const blockNumber = 0;
    const response = await checkTronDeposit(rpcUrl);
    //console.log('response', response);
    return successResponse(res,'executed',response);
}

const sendTrx = async () => {
    const rpcUrl = 'https://api.trongrid.io';
    const toAddress = 'TVEUeTmj7KcMzbex9yN4WKk9u977x9muRk';
    const amount = 1;
    const privateKey = 'b90678e6f22c71a3b96d8fc61f4847642ba5a7de7125f50c1f34ffd9736d9d2c';
    const response = await sendTrxCoin(rpcUrl,
        toAddress,
        amount,
        privateKey);
    console.log(response);
}

const sendTokenTrx = async () => {
    console.log('sendTokenTrx', 'processing');
    const rpcUrl = 'https://nile.trongrid.io';
    const toAddress = 'TXb1BUzS8xvm9Ffo522hDPMBM1Vn7gRJBQ';
    const contractAddress = 'TUp1utP6HmKyC4Y5T6oDmEndcKQ2ARGNMU'
    const amount = 1;
    const privateKey = '4581e660c85f589fb2b5d52b9294d16ce53dee136941770a7e85628cf8b3c9f5';
    const response = await sendTrxToken(
        rpcUrl,
        contractAddress,
        privateKey,
        toAddress,
        amount
      )
    console.log('test',response);
}

const checkTrxAddressPk = async () => {
    console.log('checkTrxAddress', 'processing');
    const rpcUrl = 'https://nile.trongrid.io';
    const privateKey = 'b90678e6f22c71a3b96d8fc61f4847642ba5a7de7125f50c1f34ffd9736d9d2c';
    
    const response = await getTrxAddressByPk(
        rpcUrl,
        privateKey,
      )
    console.log('test',response);
}

const sendSol = async (req: Request, res: Response) => {

    let payerSecretKey = "4esPoJhn3QqrJqc6BXePoVtXrds6MEb2rp5DPPUwBddYezmeekhDQ9aeeWLEtVi9qa6S8kgfGAz2m5vjxEqtPJia";
    let payerSecretUnitArray = bs58.decode(payerSecretKey);

    let rpcTestNet  = solana.clusterApiUrl('devnet');
    let connection  = new solana.Connection(rpcTestNet);
    let payer       = solana.Keypair.fromSecretKey(payerSecretUnitArray);
    let toAccount   = (new solana.PublicKey("6BjY9T8TuMNK5EFXiJdMtARPwDUQ3yhx5ezbcwk1nU38"));
    let transaction = new solana.Transaction();
 
    try{
        transaction.add(
            solana.SystemProgram.transfer( {
                fromPubkey: payer.publicKey,
                toPubkey: toAccount,
                lamports: solana.LAMPORTS_PER_SOL * 0.0001,
            }),
        );

        let confirmed = await solana.sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log("confirmed", confirmed);

        if(confirmed){
            return successResponse(res,'executed',confirmed);
        }
        return errorResponse(res,'executed');
    } catch (e) {
        console.log("sol send error", e.message);
        return errorResponse(res,'executed');
    }
}

const sendSolToken = async (req: Request, res: Response) => {

    let payerSecretKey = "4esPoJhn3QqrJqc6BXePoVtXrds6MEb2rp5DPPUwBddYezmeekhDQ9aeeWLEtVi9qa6S8kgfGAz2m5vjxEqtPJia";
    let payerSecretUnitArray = bs58.decode(payerSecretKey);

    let rpcTestNet  = solana.clusterApiUrl('devnet');
    let connection  = new solana.Connection(rpcTestNet);
    let payer       = solana.Keypair.fromSecretKey(payerSecretUnitArray);
    let toAccount   = (new solana.PublicKey("5U3bH5b6XtG99aVWLqwVzYPVpQiFHytBD68Rz2eFPZd7"));

    const mintAddress = new solana.PublicKey(
        "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
    );

    const PRIORITY_RATE = 12345; // MICRO_LAMPORTS

    const PRIORITY_FEE_INSTRUCTIONS = solana.ComputeBudgetProgram.setComputeUnitPrice({microLamports: PRIORITY_RATE});

    let sourceAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintAddress,
        payer.publicKey
    );
    console.log(`Source Account: ${sourceAccount.address.toString()}`);

    let destinationAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mintAddress,
        toAccount
    );

    console.log(`Destination Account: ${destinationAccount.address.toString()}`);
    console.log("----------------------------------------");

    const transferAmountInDecimals = 2 * Math.pow(10, 6);
  
    const transferInstruction = createTransferInstruction(
      sourceAccount.address,
      destinationAccount.address,
      payer.publicKey,
      transferAmountInDecimals
    );
    console.log(`Transaction instructions: ${JSON.stringify(transferInstruction)}`);
    console.log("----------------------------------------");

    let latestBlockhash = await connection.getLatestBlockhash("finalized");
    console.log("latestBlockhash: ", latestBlockhash);
    console.log("----------------------------------------");

    const messageV0 = new solana.TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [PRIORITY_FEE_INSTRUCTIONS, transferInstruction],
    }).compileToV0Message();

    const versionedTransaction = new solana.VersionedTransaction(messageV0);
    versionedTransaction.sign([payer]);
    console.log("Transaction Signed. Preparing to send...");

    try {
        const txid = await connection.sendTransaction(versionedTransaction);
        console.log(`Transaction Submitted: ${txid}`);
    
        const confirmation = await connection.confirmTransaction(
          {
            signature: txid,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed"
        );
        if (confirmation.value.err) {
          throw new Error("🚨Transaction not confirmed.");
        }
        console.log(`Transaction Successfully Confirmed! 🎉 View on SolScan: https://solscan.io/tx/${txid}`);
    } catch (error) {
    console.error("Transaction failed", error);
    }

}

const getEstimate = async (req: Request, res: Response) => {

    let rpcTestNet  = solana.clusterApiUrl('devnet');
    let connection  = new solana.Connection(rpcTestNet);
    let blockhash = await connection.getLatestBlockhash();

    let payerSecretKey = "4esPoJhn3QqrJqc6BXePoVtXrds6MEb2rp5DPPUwBddYezmeekhDQ9aeeWLEtVi9qa6S8kgfGAz2m5vjxEqtPJia";
    let payerSecretUnitArray = bs58.decode(payerSecretKey);
    let payer       = solana.Keypair.fromSecretKey(payerSecretUnitArray);
    let toAccount   = (new solana.PublicKey("5U3bH5b6XtG99aVWLqwVzYPVpQiFHytBD68Rz2eFPZd7"));

    // const mintAddress = new solana.PublicKey(
    //     "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
    // );

    // let sourceAccount = await getOrCreateAssociatedTokenAccount(
    //     connection,
    //     payer,
    //     mintAddress,
    //     payer.publicKey
    // );
    // let destinationAccount = await getOrCreateAssociatedTokenAccount(
    //     connection,
    //     payer,
    //     mintAddress,
    //     toAccount
    // );
    // console.log(`Source Account: ${sourceAccount.address.toString()}`);
    // const transferAmountInDecimals = 20 * Math.pow(10, 6);
    // const transferInstruction = createTransferInstruction(
    //     sourceAccount.address,
    //     destinationAccount.address,
    //     payer.publicKey,
    //     transferAmountInDecimals
    //   );
    //   console.log(`Transaction instructions: ${JSON.stringify(transferInstruction)}`);
    //   console.log("----------------------------------------");

    let transaction = new solana.Transaction( {
        feePayer: payer.publicKey,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight
    });


    transaction.add(
        solana.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: toAccount,
            lamports: solana.LAMPORTS_PER_SOL * 10.0000001,
        }),
    );

    let estimateFee = await transaction.getEstimatedFee(connection);

    // Estimate fees based on the number of instructions
    // const fee = await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');
    // const fee = await connection.getRecentPrioritizationFees();
    // console.log('fee', fee);
    console.log('estimateFee', estimateFee);
    if(estimateFee)
        return successResponse(res, "Estimate get successfully", estimateFee);
    return errorResponse(res, "Estimate not found");

}

const getSolTransaction = async (req: Request, res: Response) => {
    let trx_hash = req.body.transaction_hash;

    let rpcTestNet  = solana.clusterApiUrl('devnet');
    let connection  = new solana.Connection(rpcTestNet);

    const mintAddress = new solana.PublicKey(
        "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
    );

    try {
        const transaction = await connection.getParsedTransaction(
            trx_hash,
            { maxSupportedTransactionVersion: 0 }
        );

        if(!transaction) return errorResponse(res, "Transaction details not found");

        console.log(transaction);

        let tokenMetaData = transaction?.meta?.postTokenBalances;
        let instructions:any = transaction?.transaction?.message?.instructions;
        let parsedData = instructions[instructions.length - 1]?.parsed;

        let tx_type = 'native';
        let from_address = '';
        let to_address = '';
        let amount = '';
        let block_number = '';
        let transaction_id = trx_hash;
        let contract_address = '';
        let fee_limit = transaction?.meta?.fee || 0;
        
        if(tokenMetaData && tokenMetaData.length){
            tx_type = 'token';
            from_address = tokenMetaData[0].owner;
            to_address = tokenMetaData[1].owner;
            contract_address = tokenMetaData[1].mint;

            let info = parsedData?.info;
            if(info){
                amount = info.amount;
            }            
        }else{
            let info = parsedData?.info;
            if(info){
                let amountInNumber = Number(info.lamports) / solana.LAMPORTS_PER_SOL;
                amount = amountInNumber.toString();
                from_address = info.source;
                to_address = info.destination;
            }
        }

        let data = {
            tx_type : tx_type,
            from_address : from_address,
            to_address : to_address,
            amount : amount,
            block_number : block_number,
            transaction_id : transaction_id,
            contract_address : contract_address,
            fee_limit : fee_limit,
        }
        //console.log("transaction", transaction);
        return successResponse(res, "Transaction details found successfully", data);
    } catch (error) {
        console.log("getTransactionByTrx service", error);
        return errorResponse(res, error.message || "Something went wrong");
    }
}

const getTransactionsOfAccount = async (req: Request, res: Response) => {
    let rpcTestNet  = solana.clusterApiUrl('devnet');
    let connection  = new solana.Connection(rpcTestNet);
    let account   = (new solana.PublicKey("6BjY9T8TuMNK5EFXiJdMtARPwDUQ3yhx5ezbcwk1nU38"));

    let transactions = connection.getConfirmedSignaturesForAddress2(account);
    console.log("transactions", transactions);
    if(transactions)
        return successResponse(res, "Wallet created successfully", transactions);
    return errorResponse(res, "Wallet not generated");
}

export default {
    sendEth,
    checkDeposit,
    checkTrxDeposit,
    sendTrx,
    sendTokenTrx,
    checkTrxAddressPk,
    sendSol,
    sendSolToken,
    getEstimate,
    getSolTransaction,
    getTransactionsOfAccount
}