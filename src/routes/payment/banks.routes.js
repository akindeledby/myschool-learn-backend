import express from "express";
import { getNigerianBanks, resolveBankAccount } from "../../controllers/payment/banks.controller.js";

const router = express.Router();

router.get(
  "/get-banks",
  getNigerianBanks
);

router.post(
  "/resolve-bank-account",
  resolveBankAccount
);

export default router;