const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const dotenv   = require("dotenv");

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:5173",
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ──────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status:      "ok",
    message:     "Portfolio API is running",
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── Routes ────────────────────────────────────────
app.use("/api/contact", require("./routes/contact"));
app.use("/api/admin",   require("./routes/admin"));

// ─── 404 ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    status:  "error",
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌  Error:", err.message);
  res.status(err.status || 500).json({
    status:  "error",
    message: process.env.NODE_ENV === "development"
      ? err.message
      : "Something went wrong.",
  });
});

module.exports = app;