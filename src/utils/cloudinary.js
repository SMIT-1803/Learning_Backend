import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { ApiError } from "./ApiError.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null; // if no file path then return null

    //upload the file on cloudinary if file path available
    const {public_id, secure_url} = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Once file is uploaded successfully
    // console.log("File is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    return { public_id, url: secure_url };
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file upload operation failed.
  }
};

const deleteImage = async (publicId) => {
  if (!publicId) return null;
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    if (res.result !== "ok") {
      throw new ApiError(400, `Could not delete image (${res.result})`);
    }
  } catch (err) {
    throw new ApiError(400, "Problem deleting image", { cause: err });
  }
};



export { uploadOnCloudinary, deleteImage };
