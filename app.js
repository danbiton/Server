import express from "express";
import { config } from "dotenv";
import mongoDB from "./database/connectDB.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import cron from "node-cron";

import {
  OAuth2Client
} from 'google-auth-library';
import jwt from "jsonwebtoken"

cron.schedule("1 3 * * *", () => {
  console.log("running a task every minute");
});
config();
mongoDB();

const app = express();
app.use(express.json());

import issuesRouter from "./routers/issues.routter.js";
import usersRouter from "./routers/users.router.js";
import professionsRouter from "./routers/profession.router.js";
import generalRouter from "./routers/general.router.js";

app.use(
  cors({
    credentials: true,
    optionsSuccessStatus: 200,
    origin: ["http://localhost:5173", "http://localhost:5174"],
  })
);
const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  'postmessage',
);

   app.post('/auth/google', async (req, res) => {
    const { tokens } = await oAuth2Client.getToken(req.body.code); // exchange code for tokens
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
     // if user exist on the database, send the tokens back to the client
    // Save the user data to the database

    const user = {
      employeeEmail: ticket.getPayload().email,
      employeeName: ticket.getPayload().name,
      verify:true
  }
     // send the tokens back to the client
    console.log(ticket);
    console.log("token",tokens.id_token);
     const token = jwt.sign({token:tokens.id_token}, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.cookie("token", token, { httpOnly: true , secure: true, sameSite: "none"});
    
    res.json(token);
      
    });
    
app.use(cookieParser());
app.use("/users", usersRouter);
app.use("/issues", issuesRouter);
app.use("/professions", professionsRouter);
app.use("/general", generalRouter);

const port = 3000;
app.listen(port, () => console.log(`server is running on port ${port}`));
