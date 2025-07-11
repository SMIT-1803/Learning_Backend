import { asyncHandler } from "../utils/asyncHandler.js";

const registerUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "Smit the Great",
  });
});

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

export { registerUser };
