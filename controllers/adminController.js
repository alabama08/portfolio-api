const jwt      = require("jsonwebtoken");
const Message  = require("../models/Message");
const { createTransporter } = require("../config/nodemailer");

// ─── Admin Login ──────────────────────────────────
const adminLogin = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        status:  "error",
        message: "Password is required.",
      });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      console.warn(`⚠️  Failed admin login attempt — IP: ${req.ip}`);
      return res.status(401).json({
        status:  "error",
        message: "Incorrect password.",
      });
    }

    const token = jwt.sign(
      { isAdmin: true, loginTime: new Date().toISOString() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    console.log(`✅  Admin logged in — IP: ${req.ip}`);

    return res.status(200).json({
      status: "success",
      message: "Login successful.",
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
  } catch (error) {
    console.error("❌  Admin login error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Login failed. Please try again.",
    });
  }
};

// ─── Get Dashboard Stats ──────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const now       = new Date();
    const weekAgo   = new Date(now - 7  * 24 * 60 * 60 * 1000);
    const monthAgo  = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      unread,
      replied,
      archived,
      thisWeek,
      thisMonth,
      starred,
      recent,
    ] = await Promise.all([
      Message.countDocuments(),
      Message.countDocuments({ status: "unread" }),
      Message.countDocuments({ status: "replied" }),
      Message.countDocuments({ status: "archived" }),
      Message.countDocuments({ createdAt: { $gte: weekAgo } }),
      Message.countDocuments({ createdAt: { $gte: monthAgo } }),
      Message.countDocuments({ isStarred: true }),
      Message.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email subject status createdAt isStarred"),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        stats: {
          total,
          unread,
          replied,
          archived,
          thisWeek,
          thisMonth,
          starred,
        },
        recent,
      },
    });
  } catch (error) {
    console.error("❌  Dashboard stats error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to load dashboard stats.",
    });
  }
};

// ─── Get All Messages ─────────────────────────────
const getAllMessages = async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 10,
      status   = "all",
      starred  = "all",
      search   = "",
      sort     = "-createdAt",
    } = req.query;

    const query = {};

    if (status !== "all") query.status = status;
    if (starred === "true") query.isStarred = true;
    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: "i" } },
        { email:   { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Message.countDocuments(query);

    const messages = await Message.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      status: "success",
      data: {
        messages,
        pagination: {
          total,
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNext:    parseInt(page) < Math.ceil(total / parseInt(limit)),
          hasPrev:    parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("❌  Get messages error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to load messages.",
    });
  }
};

// ─── Get Single Message ───────────────────────────
const getMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        status:  "error",
        message: "Message not found.",
      });
    }

    // Auto-mark as read when opened
    if (message.status === "unread") {
      message.status = "read";
      await message.save();
    }

    return res.status(200).json({
      status: "success",
      data:   { message },
    });
  } catch (error) {
    console.error("❌  Get message error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to load message.",
    });
  }
};

// ─── Update Message Status ────────────────────────
const updateMessageStatus = async (req, res) => {
  try {
    const { status, isStarred } = req.body;

    const updateData = {};
    if (status)             updateData.status    = status;
    if (isStarred !== undefined) updateData.isStarred = isStarred;

    const message = await Message.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!message) {
      return res.status(404).json({
        status:  "error",
        message: "Message not found.",
      });
    }

    return res.status(200).json({
      status:  "success",
      message: "Message updated successfully.",
      data:    { message },
    });
  } catch (error) {
    console.error("❌  Update message error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to update message.",
    });
  }
};

// ─── Reply to Message ─────────────────────────────
const replyToMessage = async (req, res) => {
  try {
    const { replyBody } = req.body;

    if (!replyBody || replyBody.trim().length < 5) {
      return res.status(400).json({
        status:  "error",
        message: "Reply message must be at least 5 characters.",
      });
    }

    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        status:  "error",
        message: "Message not found.",
      });
    }

    // Send reply email
    const transporter = createTransporter();

    await transporter.sendMail({
      from:    `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to:      message.email,
      subject: `Re: ${message.subject}`,
      html: `
        <div style="font-family:'Space Mono',monospace;max-width:600px;background:#080b10;color:#e0eaf5;padding:40px;border-radius:16px;">
          <div style="border-bottom:2px solid #00e5ff;padding-bottom:20px;margin-bottom:28px;">
            <h2 style="color:#00e5ff;margin:0;font-size:20px;">
              Reply from ${process.env.EMAIL_FROM_NAME}
            </h2>
          </div>
          <p style="color:#6b7fa3;font-size:13px;margin-bottom:24px;">
            Hi ${message.name}, here is my reply to your message about 
            <strong style="color:#e0eaf5;">"${message.subject}"</strong>:
          </p>
          <div style="background:#141c26;border:1px solid #1e2d3d;border-left:3px solid #00e5ff;border-radius:12px;padding:24px;margin-bottom:28px;">
            <p style="color:#e0eaf5;line-height:1.8;white-space:pre-wrap;margin:0;">
              ${replyBody.trim()}
            </p>
          </div>
          <div style="background:#0d1117;border:1px solid #1e2d3d;border-radius:12px;padding:18px;margin-bottom:24px;">
            <p style="color:#6b7fa3;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">
              Your Original Message
            </p>
            <p style="color:#4a5568;font-size:12px;line-height:1.7;margin:0;font-style:italic;">
              ${message.message}
            </p>
          </div>
          <p style="color:#6b7fa3;font-size:13px;margin:0;">
            Best regards,<br/>
            <strong style="color:#00e5ff;">${process.env.EMAIL_FROM_NAME}</strong>
          </p>
        </div>
      `,
    });

    // Update message in DB
    message.status     = "replied";
    message.reply.body   = replyBody.trim();
    message.reply.sentAt = new Date();
    message.reply.sentBy = "admin";
    await message.save();

    console.log(`📤  Reply sent to ${message.email} for message: ${message.subject}`);

    return res.status(200).json({
      status:  "success",
      message: "Reply sent successfully.",
      data:    { message },
    });
  } catch (error) {
    console.error("❌  Reply error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to send reply.",
    });
  }
};

// ─── Delete Message ───────────────────────────────
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);

    if (!message) {
      return res.status(404).json({
        status:  "error",
        message: "Message not found.",
      });
    }

    console.log(`🗑️   Message deleted: ${message.subject} from ${message.email}`);

    return res.status(200).json({
      status:  "success",
      message: "Message deleted successfully.",
    });
  } catch (error) {
    console.error("❌  Delete message error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to delete message.",
    });
  }
};

// ─── Bulk Actions ─────────────────────────────────
const bulkAction = async (req, res) => {
  try {
    const { action, messageIds } = req.body;

    if (!messageIds || !messageIds.length) {
      return res.status(400).json({
        status:  "error",
        message: "No messages selected.",
      });
    }

    let result;

    switch (action) {
      case "delete":
        result = await Message.deleteMany({ _id: { $in: messageIds } });
        break;
      case "archive":
        result = await Message.updateMany(
          { _id: { $in: messageIds } },
          { status: "archived" }
        );
        break;
      case "markRead":
        result = await Message.updateMany(
          { _id: { $in: messageIds } },
          { status: "read" }
        );
        break;
      case "markUnread":
        result = await Message.updateMany(
          { _id: { $in: messageIds } },
          { status: "unread" }
        );
        break;
      default:
        return res.status(400).json({
          status:  "error",
          message: "Invalid action.",
        });
    }

    return res.status(200).json({
      status:  "success",
      message: `Bulk action '${action}' completed.`,
      data:    { affected: result.deletedCount || result.modifiedCount },
    });
  } catch (error) {
    console.error("❌  Bulk action error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Bulk action failed.",
    });
  }
};

module.exports = {
  adminLogin,
  getDashboardStats,
  getAllMessages,
  getMessage,
  updateMessageStatus,
  replyToMessage,
  deleteMessage,
  bulkAction,
};