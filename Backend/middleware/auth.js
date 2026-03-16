const jwt = require("jsonwebtoken");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "change_me");
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

module.exports = auth;
