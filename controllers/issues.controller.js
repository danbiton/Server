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

 updateIssue: async (req, res) => {
    try {
      const { id } = req.params;
      const issue = req.body;
      const issueUpdated = await issueModel
        .findByIdAndUpdate(id, issue, {
          new: true,
        })
        .populate("employees");

      if (issueUpdated.issue_status === "Done") {
        const emailTemplate = `
        <!DOCTYPE html>
     <html dir="rtl" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fault Pending Approval</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; background-color: #f3f4f6; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 20px auto; background: linear-gradient(to bottom right, #fff8f1, #fff3e6, #fff8f1); border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="background-color: rgba(255, 255, 255, 0.8); padding: 12px; border-radius: 50%; display: inline-block; margin-bottom: 16px;">
        📋
      </div>
      <h1 style="font-size: 24px; font-weight: bold; color: #92400e; margin-bottom: 16px; background: linear-gradient(to right, #92400e, #b45309, #92400e); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        Fault Pending Your Approval
      </h1>
      <div style="width: 96px; height: 4px; background: linear-gradient(to right, #fbbf24, #f59e0b); margin: 0 auto; border-radius: 2px;"></div>
    </div>

    <!-- Status Banner -->
    <div style="background-color: #fef3c7; border-right: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
      <span style="color: #92400e; font-weight: 500;">⚠ Waiting for Manager Approval</span>
      <span style="background-color: #fde68a; color: #92400e; padding: 4px 12px; border-radius: 9999px; font-size: 14px;">Fault #${
        issueUpdated._id
      }</span>
    </div>

    <!-- Details Section -->
    <div style="background-color: rgba(255, 255, 255, 0.8); padding: 24px; border-radius: 12px; margin-bottom: 24px;">
      <h2 style="font-size: 18px; font-weight: bold; color: #92400e; margin-bottom: 16px;">Fault Details</h2>
      
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 500; color: #92400e; margin-bottom: 4px;">👤 Assigned To</div>
        <div style="color: #78350f;">${
          issueUpdated.employees.employeeName || "Not Specified"
        }</div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-weight: 500; color: #92400e; margin-bottom: 4px;">⏰ Handling Time</div>
        <div style="color: #78350f;">${
          issueUpdated.duration || "45 minutes"
        }</div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-weight: 500; color: #92400e; margin-bottom: 4px;">📝 Fault Description</div>
        <div style="color: #78350f;">${
          issueUpdated.issue_description || "Not Specified"
        }</div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-weight: 500; color: #92400e; margin-bottom: 4px;">✅ Solution</div>
        <div style="color: #78350f;">${
          issueUpdated.solution || "Not Specified"
        }</div>
      </div>
    </div>

    <!-- Buttons -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="http://localhost:5173/#/allissues" 
         style="display: inline-block; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 500; margin: 0 8px; background-color: #d97706; color: white;">
        Confirm Fault Closure
      </a>
      <a href="http://localhost:5173/#/allissues" 
         style="display: inline-block; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 500; margin: 0 8px; background-color: white; color: #d97706; border: 1px solid #d97706;">
        Return to Handling
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: #92400e; font-size: 14px;">
      <p style="margin-bottom: 4px;">This message was sent automatically from the fault management system</p>
      <p style="margin-bottom: 4px;">Click on 'Confirm Fault Closure' to close the fault</p>
    </div>
  </div>
</body>
</html>

      `;

        await transporter.sendMail({
          from: issueUpdated.employees.employeeEmail,
          to: "dcsn706@gmail.com",
          subject: `Issue number ${issueUpdated._id} is awaiting your approval`,
          html: emailTemplate,
        });
      }

      res.status(200).json({
        success: true,
        message: true,
        issueUpdated,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: false,
        error: error || error.message,
      });
    }
  },

  deleteAndCreateIssue: async (req, res) => {
    try {
      const { id } = req.params;

      // for doing populate we must do func of find
      const previous = await issueModel.findById(id).populate("employees");

      const previousIssue = await issueModel.findByIdAndDelete(id);
      const issueForHistory = {
        issue_building: previousIssue.issue_building,
        issue_floor: previousIssue.issue_floor,
        issue_apartment: previousIssue.issue_apartment,
        issue_description: previousIssue.issue_description,
        issue_images: previousIssue.issue_images,
        issue_urgency: previousIssue.issue_urgency,
        issue_status: previousIssue.issue_status,
        issue_profession: previousIssue.issue_profession,
        employees: previousIssue.employees,
      };

      const issueCreated = await issuesHistoryModel.create(issueForHistory);
      console.log(previous.employees.employeeEmail);

      await transporter.sendMail({
        from: "dcsn706@gmail.com",
        to: previous.employees.employeeEmail,
        text: "Hello world?",
        subject: "Fault handling successfully completed",
        html: `
          <div style="background: linear-gradient(to bottom right, #FFF8E5, #FFEDD5); padding: 20px; border-radius: 15px; max-width: 600px; margin: auto; font-family: Arial, sans-serif;">
  <div style="text-align: center; margin-bottom: 20px;">
    <div style="position: relative; display: inline-block;">
      <svg xmlns="http://www.w3.org/2000/svg" style="width: 64px; height: 64px; color: #D97706;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>
      <div style="position: absolute; top: -8px; right: -8px;">
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px; color: #FBBF24;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="font-size: 24px; color: #92400E; background: linear-gradient(to right, #F59E0B, #B45309); -webkit-background-clip: text; color: transparent;">Fault successfully resolved!</h1>
    <div style="width: 100px; height: 5px; background: linear-gradient(to right, #FBBF24, #D97706); margin: 0 auto; border-radius: 2px;"></div>
  </div>

  <div style="background: rgba(255, 255, 255, 0.8); padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: right;">
    <div style="display: flex; align-items: center; justify-content: flex-end; margin-bottom: 15px;">
      <span style="font-size: 16px; font-weight: bold; color: #92400E;">Issue number #${previousIssue._id} has been resolved</span>
      <svg xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px; color: #22C55E;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11L12 14L22 4"></path><path d="M21 12V21H3V12"></path><path d="M8 21V13H16V21"></path></svg>
    </div>
    <p style="color: #92400E;">Hello ${previous.employees.employeeName},</p>
    <p style="color: #D97706; line-height: 1.6;">We would like to thank you for your professional work in resolving the fault. Your efforts have contributed to improved service and higher customer satisfaction.</p>
    <div style="color: #92400E; font-weight: 500;">
      <p>Best regards,</p>
      <p>Keep up the great work,</p>
      <p>Yossi</p>
      <p style="color: #B45309; font-size: 14px;">Service Department Manager</p>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
    <div style="background: rgba(255, 255, 255, 0.6); padding: 10px; border-radius: 5px; text-align: center;">
      <div style="color: #D97706; font-size: 14px;">Handling time</div>
      <div style="font-size: 18px; font-weight: bold; color: #92400E;">45 minutes</div>
    </div>
    <div style="background: rgba(255, 255, 255, 0.6); padding: 10px; border-radius: 5px; text-align: center;">
      <div style="color: #D97706; font-size: 14px;">Customer rating</div>
      <div style="font-size: 18px; font-weight: bold; color: #92400E;">5/5</div>
    </div>
    <div style="background: rgba(255, 255, 255, 0.6); padding: 10px; border-radius: 5px; text-align: center;">
      <div style="color: #D97706; font-size: 14px;">Monthly failures</div>
      <div style="font-size: 18px; font-weight: bold; color: #92400E;">15</div>
    </div>
  </div>

  <div style="text-align: center; color: #D97706; font-size: 12px;">
    <p>This message was sent from the fault management system.</p>
  </div>
</div>

          `,
      }),
        res.status(200).json({
          success: true,
          message: true,
          data: previousIssue,
          data2: issueCreated,
        });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: false,
        error: error || error.message,
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
