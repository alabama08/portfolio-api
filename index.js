const dotenv    = require("dotenv");
dotenv.config();

const app               = require("./server");
const connectDB         = require("./config/db");
const { verifyTransporter } = require("./config/nodemailer");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Connect MongoDB
  await connectDB();

  // 2. Verify email
  await verifyTransporter();

  // 3. Start server
  app.listen(PORT, () => {
    console.log("\n==========================================");
    console.log(`🚀  Server   : http://localhost:${PORT}`);
    console.log(`🌍  Env      : ${process.env.NODE_ENV}`);
    console.log(`📬  Contact  : POST /api/contact`);
    console.log(`🔐  Admin    : POST /api/admin/login`);
    console.log(`💚  Health   : GET  /api/health`);
    console.log("==========================================\n");
  });
};

startServer().catch((err) => {
  console.error("❌  Server failed to start:", err.message);
  process.exit(1);
});