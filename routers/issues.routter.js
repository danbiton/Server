import { Router } from "express";
import queries from "../controllers/issues.controller.js";
import queriesHistory from "../controllers/issuesHistory.controller.js";
import upload from "../middleware/upload.js";
const router = Router();
const {
  addIssues,
  getAllIssues,
  autocompleteIssue,
  updateIssue,
  associateEmployeeWithIssue,
  allIssuesByProfession,
  deleteAndCreateIssue,
  // unassociateEmployeeFromIssue
 
} = queries;

const { getAllHistories, getHistoryById } = queriesHistory;

router.post("/addIssues", upload.array("issue_images", 12), addIssues);
router.get("/getallissues", getAllIssues);
router.get("/autocomplete", autocompleteIssue);
router.put("/updateissue", associateEmployeeWithIssue);
// router.post("/unassociateemployeefromissue",unassociateEmployeeFromIssue)
router.put("/update/:id", updateIssue);
router.get("/allissuesbyprofession/:id", allIssuesByProfession);
router.post("/deleteissue/:id", deleteAndCreateIssue);



//issuesHistory
router.get("/getallhistories", getAllHistories);
router.get("/gethistorybyid/:id", getHistoryById)

export default router;
