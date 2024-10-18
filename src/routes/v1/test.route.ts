import express from "express";
import auth from "../../middlewares/auth";
import evmController from "../../controllers/wallet.controller";
import validate from "../../middlewares/validate";
import evmValidation from "../../validations/wallet.validation";
import testController from "../../controllers/test.controller";

const router = express.Router();

// router.post("/send-eth", testController.sendEth);
// router.get("/check-deposit", testController.checkDeposit);
// router.get("/check-trx-deposit", testController.checkTrxDeposit);
// router.get("/send-trx", testController.sendTrx);
// router.get("/send-tokentrx", testController.sendTokenTrx);
// router.get("/check-address", testController.checkTrxAddressPk);

router.post("/send-sol",        testController.sendSol);
router.post("/send-sol-token",  testController.sendSolToken);
router.get ("/get-estimate",    testController.getEstimate);
router.get ("/get-transactions",testController.getTransactionsOfAccount);
router.post("/get-transaction", testController.getSolTransaction);

export default router;
