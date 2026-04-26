import { Router, type IRouter } from "express";
import { getOnchainAssets } from "../lib/onchain";

const router: IRouter = Router();

router.get("/onchain/assets/:address", async (req, res, next) => {
  try {
    const data = await getOnchainAssets(req.params.address);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
