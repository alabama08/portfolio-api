const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type:     String,
      required: [true, "Email is required"],
      trim:     true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],
    },
    subject: {
      type:     String,
      required: [true, "Subject is required"],
      trim:     true,
      minlength: 3,
      maxlength: 200,
    },
    message: {
      type:     String,
      required: [true, "Message is required"],
      trim:     true,
      minlength: 10,
      maxlength: 5000,
    },
    status: {
      type:    String,
      enum:    ["unread", "read", "replied", "archived"],
      default: "unread",
    },
    isStarred: {
      type:    Boolean,
      default: false,
    },
    reply: {
      body:     { type: String, default: null },
      sentAt:   { type: Date,   default: null },
      sentBy:   { type: String, default: null },
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ email: 1 });

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;