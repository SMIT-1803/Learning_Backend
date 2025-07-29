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
  // We know that access tokens are short lived and after they get expired, the user needs to login again to get access and then the access token gets refreshed. Now what we are doing here is that because we are storing the refresh and access token in cookies, if the access token is expired what we can do is take the refresh token from cookies (incomingRefreshToken) which is and compare with the one in the our database under that user. If they match we will just generate a new access token so that user does not need to login again and will have a new access token which we update in the cookies and database.
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken; // Refresh token from Cookies
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  const decodedToken = jwt.verify(
    // Decoding refresh token to get user details
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (incomingRefreshToken !== user.refreshToken) {
    // Comparing
    throw new ApiError(401, "Refresh token has expired");
  }

  const options = {
    httpOnly: true,
    secure: true,
  };

  const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(
    // Generating new access and refresh token
    user._id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // updating cookies with new access token
    .cookie("refreshToken", newRefreshToken, options) // updating cookies with new access token
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

const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Here the main thing to keep in mind is, because in our case this can be performed only when the user is logged in, our AUTH middleware has injected the user details in 'req' which we can directly access.
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "Current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.body?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path; // This is different from taking avatar image while registering because when we were registering we were taking both the AVATAR and COVERIMAGE together which is why we where using 'req/files' but here because this function is only to change the avatar we are using 'req.file'. The same goes for updateUserCoverImage function.

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
