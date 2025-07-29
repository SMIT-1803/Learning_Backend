import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const theUser = await User.findById(userId);
    const accessToken = theUser.generateAccessToken();
    const refreshToken = theUser.generateRefreshToken();

    theUser.refreshToken = refreshToken;
    await theUser.save({ validateBeforeSave: false }); // This is done to save the update of refresh token. Also when we save, validation kicks in checking passwords and everything else which is not needed here. To prevent that we give validateBeforeSave:false

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh tokens"
    );
  }
};
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
    [fullName, email, username, password].some((field) => field?.trim() === "")
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

const loginUser = asyncHandler(async (req, res) => {
  //------------------------------
  // Below is the LOGIC/(Thought Process) for this function
  // Get user details from frontend using req body
  // User can be logged in using username or email.
  // Validation - not empty, email correctly formatted, etc
  // Check if user exists or not, as to login user needs to exist.
  // Generate access and referesh tokens.
  // Send cookies
  // return response.
  // -----------------------------------------

  // Getting user details.
  const { email, password } = req.body;

  // Validation
  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required!!");
  }

  if (!email.includes("@") || email !== email.toLowerCase()) {
    throw new ApiError(400, "Please enter a valid Email");
  }

  // If user exists or not
  const user = await User.findOne({
    $or: [{ email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Checking if password matches the one in the database
  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generating and getting Access and Refresh Tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  //Sending cookies
  const loggedInUser = await User.findById(user._id).select(
    // Did this as when returning we do not want to send password and refresh token
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // Getting the user logged out is easy, just delete the refresh token and we are done. But the problem is how to get the id of the user.
  // We solved this problem by defining a middleware called auth. Explaination of the middleware in that file.

  await User.findByIdAndUpdate(
    // findByIdAndUpdate finds the user and updates the info at once.
    req.user._id, // Here to get the user id we are using the Object we injected in the middleware file
    {
      $set: {
        // This is a MongoDB's operator which can take a number of fields and update them
        refreshToken: undefined,
      },
    },
    {
      new: true, // This is used to get the updated response, which in our case would be with refreshToken undefined.
    }
  );

  // Lets clear the cookies now
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out!!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token has expired");
  }

  const options = {
    httpOnly: true,
    secure: true,
  };

  const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          accessToken,
          refreshToken: newRefreshToken,
        },
        "Access token refreshed"
      )
    );
});

export { registerUser, loginUser, logoutUser,refreshAccessToken };
