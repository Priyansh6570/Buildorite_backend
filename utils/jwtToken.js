// jwtToken.js
import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export const sendTokens = (user, statusCode, res) => {
  const accessToken = generateAccessToken(user);

  res.status(statusCode).json({
    success: true,
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
    },
  });
};
