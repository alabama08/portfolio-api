const { createTransporter } = require("../config/nodemailer");
const Message = require("../models/Message");

const validateFields = ({ name, email, subject, message }) => {
  const errors = [];
  if (!name    || name.trim().length    < 2)  errors.push("Name must be at least 2 characters.");
  if (!email   || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Valid email required.");
  if (!subject || subject.trim().length < 3)  errors.push("Subject must be at least 3 characters.");
  if (!message || message.trim().length < 10) errors.push("Message must be at least 10 characters.");
  return errors;
};

const sendContactEmail = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // 1. Validate
    const errors = validateFields({ name, email, subject, message });
    if (errors.length > 0) {
      return res.status(400).json({ status: "error", errors });
    }

    const sanitized = {
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    };

    // 2. Save to MongoDB
    const savedMessage = await Message.create({
      ...sanitized,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    console.log(`📬  New message saved to DB — ID: ${savedMessage._id}`);

    // 3. Send email to owner
    const transporter = createTransporter();

    await transporter.sendMail({
      from:    `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to:      process.env.OWNER_EMAIL,
      subject: `[Portfolio] ${sanitized.subject}`,
      html: `
        <div style="font-family:'Space Mono',monospace;background:#080b10;color:#e0eaf5;padding:40px;border-radius:16px;max-width:600px;">
          <div style="border-bottom:2px solid #00e5ff;padding-bottom:20px;margin-bottom:28px;">
            <h2 style="color:#00e5ff;margin:0;">📨 New Portfolio Message</h2>
            <p style="color:#6b7fa3;margin:6px 0 0;font-size:12px;">
              Received ${new Date().toLocaleString()} · ID: ${savedMessage._id}
            </p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <tr>
              <td style="padding:10px 0;color:#6b7fa3;font-size:12px;width:80px;">FROM</td>
              <td style="padding:10px 0;color:#e0eaf5;font-weight:bold;">${sanitized.name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7fa3;font-size:12px;">EMAIL</td>
              <td style="padding:10px 0;">
                <a href="mailto:${sanitized.email}" style="color:#00e5ff;">${sanitized.email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7fa3;font-size:12px;">SUBJECT</td>
              <td style="padding:10px 0;color:#e0eaf5;">${sanitized.subject}</td>
            </tr>
          </table>
          <div style="background:#141c26;border:1px solid #1e2d3d;border-radius:12px;padding:24px;margin-bottom:28px;">
            <p style="color:#6b7fa3;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">
              Message
            </p>
            <p style="color:#e0eaf5;line-height:1.8;white-space:pre-wrap;margin:0;">
              ${sanitized.message}
            </p>
          </div>
          <div style="text-align:center;">
            <a href="mailto:${sanitized.email}?subject=Re: ${sanitized.subject}"
               style="display:inline-block;background:#00e5ff;color:#080b10;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:13px;text-decoration:none;margin-right:12px;">
              Reply via Email
            </a>
          </div>
        </div>
      `,
    });

    // 4. Send auto-reply to client
    await transporter.sendMail({
      from:    `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to:      sanitized.email,
      subject: `Got your message — I'll be in touch soon! ✓`,
      html: `
        <div style="font-family:'Space Mono',monospace;background:#080b10;color:#e0eaf5;padding:40px;border-radius:16px;max-width:600px;">
          <div style="border-bottom:2px solid #00e5ff;padding-bottom:20px;margin-bottom:28px;">
            <h2 style="color:#00e5ff;margin:0;">Hey ${sanitized.name}! 👋</h2>
          </div>
          <p style="line-height:1.8;color:#e0eaf5;margin-bottom:16px;">
            Thanks for reaching out! I have received your message about
            <strong style="color:#00e5ff;">"${sanitized.subject}"</strong>
            and will get back to you within <strong>24 hours</strong>.
          </p>
          <div style="background:#141c26;border:1px solid #1e2d3d;border-left:3px solid #00e5ff;border-radius:12px;padding:20px;margin-bottom:28px;">
            <p style="color:#6b7fa3;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">
              Your Message
            </p>
            <p style="color:#e0eaf5;font-size:13px;line-height:1.7;margin:0;font-style:italic;">
              ${sanitized.message}
            </p>
          </div>
          <p style="color:#6b7fa3;font-size:13px;line-height:1.8;">
            Best regards,<br/>
            <strong style="color:#00e5ff;">${process.env.EMAIL_FROM_NAME}</strong>
          </p>
        </div>
      `,
    });

    console.log(`✅  Emails sent for message from ${sanitized.name} <${sanitized.email}>`);

    return res.status(200).json({
      status:  "success",
      message: "Your message has been sent! I will get back to you within 24 hours.",
    });
  } catch (error) {
    console.error("❌  Contact error:", error.message);
    return res.status(500).json({
      status:  "error",
      message: "Failed to send message. Please try again.",
    });
  }
};

module.exports = { sendContactEmail };