const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// Mock user data for testing
const mockUsers = [
  {
    id: "mock-user-1",
    username: "testuser",
    email: "test@example.com",
    password: "$2a$10$mockhash", // bcrypt hash for "password123"
  },
];

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Username, email, and password are required",
      });
    }

    // Check if user already exists (in mock data)
    const existingUser = mockUsers.find(
      (u) => u.email === email || u.username === username
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User already exists",
      });
    }

    // Create mock user
    const mockUser = {
      id: `mock-user-\${mockUsers.length + 1}`,
      username,
      email,
      password: "$2a$10$mockhash",
    };

    mockUsers.push(mockUser);

    // Generate token
    const token = jwt.sign(
      { userId: mockUser.id, email: mockUser.email },
      process.env.JWT_SECRET || "mock-secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          role: "user",
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Registration failed",
    });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Find mock user
    const user = mockUsers.find((u) => u.email === email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Mock password check (in real app, use bcrypt.compare)
    const isValidPassword = password === "password123"; // Mock check

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || "mock-secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: "user",
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
});

// Get current user
router.get("/me", (req, res) => {
  // Mock auth middleware
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Not authenticated",
    });
  }

  try {
    // Mock token verification
    const decoded = { userId: "mock-user-1", email: "test@example.com" };

    res.json({
      success: true,
      data: {
        user: {
          id: decoded.userId,
          username: "testuser",
          email: decoded.email,
          role: "user",
        },
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
});

module.exports = router;
