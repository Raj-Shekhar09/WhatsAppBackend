require('dotenv').config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const um = require("../model/um");
const { v4: uuidv4 } = require("uuid");

const JWT_SECRET = process.env.JWT_SECRET || "your-secure-secret";

const validateEmail = (email) => {
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email);
};

const validatePassword = (pwd) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(pwd);
};

const reg = async (req, res) => {
  try {
    const { _id: email, name, pwd } = req.body;

    if (!email || !name || !pwd) {
      return res.status(400).json({ success: false, msg: "All fields are required" });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, msg: "Invalid email format" });
    }
    if (!validatePassword(pwd)) {
      return res.status(400).json({
        success: false,
        msg: "Password must be at least 8 characters long, with uppercase, lowercase, number, and special character",
      });
    }

    const existingUser = await um.findById(email);
    if (existingUser) {
      return res.status(400).json({ success: false, msg: "Email already registered" });
    }

    const pwdhash = await bcrypt.hash(pwd, 10);
    const userId = uuidv4();
    const data = new um({ _id: email, name, pwd: pwdhash, userId });
    await data.save();

    res.status(201).json({ success: true, msg: "Registration successful" });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ success: false, msg: "Server error during registration" });
  }
};

const login = async (req, res) => {
  try {
    const { _id: email, pwd } = req.body;

    if (!email || !pwd) {
      return res.status(400).json({ success: false, msg: "Email and password are required" });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, msg: "Invalid email format" });
    }

    const user = await um.findById(email);
    if (!user) {
      return res.status(401).json({ success: false, msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(pwd, user.pwd);
    if (!isMatch) {
      return res.status(401).json({ success: false, msg: "Invalid email or password" });
    }

    const token = jwt.sign({ _id: user._id }, JWT_SECRET, { expiresIn: "1h" });

    res.json({
      success: true,
      token,
      name: user.name,
      userId: user.userId,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ success: false, msg: "Server error during login" });
  }
};

module.exports = { reg, login };