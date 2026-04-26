import { Router, type IRouter } from "express";
import {
  decodeInvoice,
  resolveLnurl,
  lnurlPayCallback,
  getLightningNetworkStats,
} from "../lib/lightning";

const router: IRouter = Router();

router.get("/lightning/network", async (_req, res, next) => {
  try {
    const data = (await getLightningNetworkStats()) ?? { stats: null, topNodes: [] };
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/lightning/decode", (req, res, next) => {
  try {
    const data = decodeInvoice(String(req.body?.invoice ?? ""));
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/lightning/lnurl", async (req, res, next) => {
  try {
    const data = await resolveLnurl(String(req.body?.lnurl ?? ""));
    res.json(data);
  } catch (err) { next(err); }
});

router.post("/lightning/lnurl-pay", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const data = await lnurlPayCallback(b.callback, Math.floor(b.amountSats), b.comment);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
