import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { app } from "../app.js";

// This is the second way of connecting a database, which is more preferrable because is makes the code more modular. Now storing the connnection instance of mongoDB is just done here for information purposes.
const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    app.on("error", (error) => {
      console.log("ERROR: ", error);
      throw error;
    });
    console.log(
      `\n MongoDB connected !! DB Host: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("MongoDB connection FAILED: ", error);
    process.exit(1); // A way to exit the code, can also be done using throw error, which was done in the first method of DB connection
  }
};

export default connectDB;
