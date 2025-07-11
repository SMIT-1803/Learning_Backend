import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" })); // This is limit the amount of data we get in the form of JSON from user, like from a form
app.use(express.urlencoded({ extended: true, limit: "16kb" })); // This is for us to be able to get data from the URL, while limiting it too
app.use(express.static("public"));
app.use(cookieParser()); 


//routes import
import userRouter from "./routes/user.routes.js"

//routes declaration
app.use("/api/v1/users", userRouter)
export { app };
