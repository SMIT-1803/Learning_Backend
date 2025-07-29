import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js"

// Here we are using cookies in which the accessToken is stored to retrieve user information. Once the token is decoded we can extract the id
// and find the user. Once we have the user we get rid of unncessary info like password and refresh token. Then we simple inject a new object
// named user and assign the user value to it. We will use this object in the logoutUser method. // View logoutUser method now.
export const verifyJWT = asyncHandler(async (req, _, next) => {  // Sometime we may not need to use "res" then we can replace it with "_". It is just a good practice that's it.
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorizaiton"?.replace("Bearer ", "")); // Way to get the info from phones
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }
  
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
  
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
  
    if(!user){
      throw new ApiError(401, "Invalid Access Token")
    }
  
    req.user = user;
    next()
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token")
  }

});
