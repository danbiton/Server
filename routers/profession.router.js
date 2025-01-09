import { Router } from "express";
import query from "../controllers/professions.controller.js";
const router = Router();
const { getAllProfessions, addProfession, deleteProfession } = query;

router.get("/getallprofessions", getAllProfessions);
router.post("/addprofession", addProfession);
router.delete("/deleteprofession/:id", deleteProfession);
export default router;
