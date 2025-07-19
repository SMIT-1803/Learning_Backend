import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  //------------------------------
  // Below is the LOGIC/(Thought Process) for this function
  // Get user details from frontend
  // Validation - not empty, email correctly formatted, etc
  // Check if user already exists. Can be checked using email and/or username
  // In the user schema taking files like Avatar is compuslory. Cover Image is not mandatory. // Here multer comes into play
  // Upload the files to cloudinary.
  // Create user object - create entry db.
  // Remove password and refresh token field from response. As when an entry is created in MongoDB we get all the data in response.
  // Check for user creation.
  // return response.
  // -----------------------------------------

  // Getting user data
  console.log("This is the req.body data: ", req.body);
  const { username, fullName, email, password } = req.body;

  // Validation
  if (
    [fullName, email, username, password].some((field) => field?.trim === "")
  ) {
    throw new ApiError(400, "All fields are required!!");
  }
  if (!email.includes("@") || email !== email.toLowerCase()) {
    throw new ApiError(400, "Please enter a valid Email");
  }

  //If user Exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // Taking files like Avatar(Compulsory) and CoverImage
  console.log("This is the req.files data: ", req.files);
  const avatarLocalPath = req.files?.avatar[0]?.path; // In these two lines we are getting the local file path, which is on our server.
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required!!");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is required!!");
  }

  //Creating User object to make database entry
  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    password,
    email,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // Removing password and refreshToken from the response. Also smartly checking if the user got created or not.
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken" // we write in string with "-" in front to tell which ones not to select, others are preselected
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user.");
  }

  // Returning response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

export { registerUser };

// second way for registerUser function without using asyncHandler as it is optional to use and create for a project

// const register_User = async function (req, res, next) {
//   try {
//     res.status(200).json({
//       message: "ok",
//     });
//   } catch (error) {
//     next(error);
//   }
// };
