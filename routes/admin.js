const express   = require("express");
const router    = express.Router();
const adminAuth = require("../middleware/adminAuth");
const {
  adminLogin,
  getDashboardStats,
  getAllMessages,
  getMessage,
  updateMessageStatus,
  replyToMessage,
  deleteMessage,
  bulkAction,
} = require("../controllers/adminController");

// ─── Public ───────────────────────────────────────
router.post("/login", adminLogin);

// ─── Protected (JWT required) ─────────────────────
router.use(adminAuth);

router.get("/dashboard",             getDashboardStats);
router.get("/messages",              getAllMessages);
router.get("/messages/:id",          getMessage);
router.patch("/messages/:id/status", updateMessageStatus);
router.post("/messages/:id/reply",   replyToMessage);
router.delete("/messages/:id",       deleteMessage);
router.post("/messages/bulk",        bulkAction);

module.exports = router;