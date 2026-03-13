const jwt = require("jsonwebtoken");

const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status:  "error",
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.isAdmin) {
      return res.status(403).json({
        status:  "error",
        message: "Access forbidden. Admin only.",
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status:  "error",
        message: "Session expired. Please login again.",
      });
    }
    return res.status(401).json({
      status:  "error",
      message: "Invalid token. Please login again.",
    });
  }
};

module.exports = adminAuth;