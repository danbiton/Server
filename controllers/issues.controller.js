import employeeModel from "../models/employee.model.js";
import issueModel from "../models/issues.model.js";
import issuesHistoryModel from "../models/issuesHistory.model.js";
import cloudinary from "../service/cloudinary.service.js";
import pLimit from "p-limit";
import transporter from "../service/nodemailer.service.js";

export default {
  addIssues: async (req, res) => {
    try {
      const {
        issue_building,
        issue_floor,
        issue_apartment,
        issue_description,
        issue_urgency,
        issue_profession,
      } = req.body;
      if (
        !issue_building ||
        !issue_floor ||
        !issue_apartment ||
        !issue_description ||
        !issue_urgency ||
        !issue_profession ||
        !req.files ||
        req.files.length === 0
      )
        throw new Error("all fields required!");

      const limit = pLimit(5);

      const images = req.files.map((file) =>
        limit(async () => await cloudinary.uploader.upload(file.path))
      );

      const results = await Promise.all(images);

      req.body.issue_images = results.map((result) => result.secure_url);

      console.log(req.body);
      const issue = await issueModel.create(req.body);

      res.status(200).json({
        success: true,
        message: "Success add issue",
        issue,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        massege: "not Success add new issue",
      });
    }
  },

  getAllIssues: async (req, res) => {
    try {
      const {
        page,
        limit,
        search = "all",
        status = "all",
        profession = "all",
      } = req.query;

      const filterObject = {
        ...(search !== "all" && { issue_urgency: search }),
        ...(status !== "all" && { issue_status: status }),
        ...(profession !== "all" && { issue_profession: profession }),
      };

      const count = await issueModel.countDocuments(filterObject);

      const skip = (page - 1) * limit;

      const allIssues = await issueModel
        .find(filterObject)
        .populate(["issue_profession", "employees"])
        .skip(skip)
        .limit(limit);

      res.status(200).json({
        success: true,
        message: true,
        data: allIssues,
        count: count,
      });
    } catch (error) {
      console.log(error);
      res.status(401).json({
        success: false,
        message: false,
        error: error || error.message,
      });
    }
  },

  autocompleteIssue: async (req, res) => {
    const INDEX_NAME = "autocomplete";
    try {
      const SearchQuery = req.query.query;

      const pipeline = [];
      pipeline.push({
        $search: {
          index: INDEX_NAME,
          autocomplete: {
            query: SearchQuery,
            path: "issue_building",
            tokenOrder: "sequential",
          },
        },
      });
      pipeline.push({ $limit: 7 });
      pipeline.push({
        $project: {
          _id: 1,
          score: { $meta: "searchScore" },
          issue_building: 1,
          issue_floor: 1,
          issue_apartment: 1,
          issue_description: 1,
          issue_images: 1,
        },
      });

      const result = await issueModel.aggregate(pipeline).sort({ score: -1 });
      res.json({
        success: true,
        message: "the issue is found successfully",
        result,
      });
    } catch (error) {
      res.json({
        success: false,
        message: "the issue is not found successfully",
      });
    }
  },




      


  //Client
  associateEmployeeWithIssue: async (req, res) => {
    try {
      const { employees, issues } = req.body;
      console.log(employees, issues);
      const employeeUpdated = await issueModel.findByIdAndUpdate(
        issues,
        { employees },
        {
          new: true,
        }
      );

      const issueUpdated = await employeeModel.updateOne(
        { _id: employees },
        { $addToSet: { issues } }
      );

      res.status(200).json({
        success: true,
        message: true,
        data: issueUpdated,
        data2: employeeUpdated,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: false,
        error: error || error.message,
      });
    }
  },

  // unassociateEmployeeFromIssue: async (req, res) => {
  //   try {
  //     const { employees, issues } = req.body;

  //     const issueUpdated = await issueModel.findByIdAndUpdate(
  //       issues,
  //       { $unset: { employees: "" } },
  //       { new: true }
  //     );

  //     const employeeUpdated = await employeeModel.updateOne(
  //       { _id: employees },
  //       { $pull: { issues: issues } }
  //     );

  //     res.status(200).json({
  //       success: true,
  //       message: "Employee successfully unassociated from the issue",
  //       data: issueUpdated,
  //       data2: employeeUpdated,
  //     });
  //   } catch (error) {
  //     res.status(500).json({
  //       success: false,
  //       message: "Failed to unassociate employee from issue",
  //       error: error || error.message,
  //     });
  //   }
  // },

  allIssuesByProfession: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(id);
      const allIssues = await issueModel
        .find({ issue_profession: id })
        .populate(["employees", "issue_profession"]);
      console.log(allIssues);
      res.json({
        success: true,
        message: true,
        data: allIssues,
      });
    } catch (error) {
      res.json({
        success: false,
        message: false,
        error: error || error.message,
      });
    }
  },
};
