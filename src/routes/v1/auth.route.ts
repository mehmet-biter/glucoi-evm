import express from "express";
import validate from "../../middlewares/validate";
import authValidation from "../../validations/auth.validation";
import auth from "../../middlewares/auth";
import { authController } from "../../controllers";

const router = express.Router();

router.get("/test", auth(), authController.test);
router.post("/login", validate(authValidation.login), authController.login);
router.get("/verify-token", authController.verifyToken);
router.post("/logout", validate(authValidation.logout), authController.logout);

export default router;
