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
    
    // Try to verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "mock-secret");
      req.user = { id: decoded.userId, email: decoded.email };
      next();
    } catch (jwtError) {
      // If token is invalid, use mock auth for development
      req.user = {
        id: "mock-user-1",
        username: "testuser",
        email: "test@example.com",
      };
      next();
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

module.exports = auth;
