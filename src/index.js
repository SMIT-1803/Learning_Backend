import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
  path: "./env",
});

connectDB() // Because connectDB is a async function, when it ends it returns a promise, which can be used if wanted to.
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running at port: ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("MONGO DB connection Failed ", err)
})











/*
import mongoose from "mongoose";
import {DB_NAME} from "./constants";
import express from "express";

Always write the code for database connection in async await and add try-catch because it takes time to talk to the database [solved by async await] and sometimes things go wrong when trying to connec to the database (problem solved by try-catch)

const app = express();

(async ()=>{    // Here we have not done anything special this is called an "iffy" a way of writing a function which we want to be excuted immediately. We can for sure write a normal function and then run it below its defination
    try {   
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("ERROR: ", error)
            throw error;
        })

        app.listen(process.env.PORT,()=>{
            console.log(`App is listening on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("ERROR: ", error)
        throw error
    }
})()
*/
