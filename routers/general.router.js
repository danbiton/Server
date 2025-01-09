import { Router } from "express";
import queries from "../controllers/general.controller.js";

const router = Router();
const { getAlllength } = queries;

router.get("/getalllength", getAlllength);

export default router;
