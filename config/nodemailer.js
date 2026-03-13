const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const verifyTransporter = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("✅  Nodemailer: Gmail connected");
    return transporter;
  } catch (error) {
    console.error("❌  Nodemailer failed →", error.message);
    return null;
  }
};

module.exports = { createTransporter, verifyTransporter };