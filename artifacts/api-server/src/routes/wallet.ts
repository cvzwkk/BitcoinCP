import { Router, type IRouter } from "express";
import {
  createWallet,
  createMultisig,
  getAddressInfo,
  getWalletBalanceFromMnemonic,
  sendTransaction,
} from "../lib/wallet";

const router: IRouter = Router();

router.get("/wallet/address/:address", async (req, res, next) => {
  try {
    const network = (req.query.network as "mainnet" | "testnet") ?? "mainnet";
    const data = await getAddressInfo(req.params.address, network);
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/wallet/create", async (req, res, next) => {
  try {
    const data = createWallet(req.body ?? {});
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/wallet/multisig", async (req, res, next) => {
  try {
    const data = createMultisig(req.body ?? {});
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/wallet/balance", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const data = await getWalletBalanceFromMnemonic(
      b.mnemonic, b.bip,
      b.network ?? "mainnet",
      b.scanCount ?? 10,
      b.passphrase ?? "",
    );
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/wallet/send", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const data = await sendTransaction({
      mnemonic: b.mnemonic,
      bip: b.bip,
      network: b.network ?? "mainnet",
      passphrase: b.passphrase,
      toAddress: b.toAddress,
      amountSats: Math.floor(b.amountSats),
      feeRate: b.feeRate,
      scanCount: b.scanCount,
      changeIndex: b.changeIndex,
    });
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
