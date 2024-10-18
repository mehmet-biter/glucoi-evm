import express from "express";
import auth from "../../middlewares/auth";
import evmController from "../../controllers/wallet.controller";
import validate from "../../middlewares/validate";
import evmValidation from "../../validations/wallet.validation";
import depositController from "../../controllers/deposit.controller";

const router = express.Router();

router.post("/create-wallet", auth(), validate(evmValidation.walletCreate), evmController.createWallet);
router.post("/create-system-wallet", auth(), evmController.createSystemWallet);
router.post("/wallet-withdrawal-process", auth(), evmController.walletWithdrawalProcess);

// check evm deposit
router.post("/current-block", depositController.checkCurrentBlock);
router.get("/block-deposit-check", depositController.checkBlockEvmDeposit);
router.get("/check-deposit", depositController.checkEvmDeposit);
router.post("/send-token", depositController.sendTokenTest);
router.post("/withdrawal-approve-by-admin", auth(), evmController.walletWithdrawalApprove);
router.post("/receive-deposit-coin",depositController.receiveDepositCoin);
router.post("/check-deposit-coin",depositController.checkDepositByTx);
router.post("/check-contract-address",depositController.getContractInfo);
router.post("/check-address",depositController.checkWalletAddress);

export default router;
