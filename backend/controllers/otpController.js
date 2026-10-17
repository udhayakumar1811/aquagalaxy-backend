const crypto = require("crypto");
const Otp = require("../models/otpModel");
const User = require("../models/userModel");
const { sendWhatsAppMessage } = require("../utils/whatsappService");

// Helper to sanitize 10-digit Indian mobile number
const cleanMobileNumber = (raw) => {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  return null;
};

// Helper to hash OTP with salt
const hashOtp = (otp) => {
  const salt = process.env.JWT_SECRET || "aquagalaxy_otp_salt_secret";
  return crypto.createHash("sha256").update(`${otp}:${salt}`).digest("hex");
};

// @desc    SEND OTP FOR REGISTRATION, LOGIN, OR FORGOT PASSWORD
// @route   POST /api/users/send-otp
// @access  Public
const sendOtp = async (req, res) => {
  try {
    const { mobile, purpose } = req.body;

    const cleanMobile = cleanMobileNumber(mobile);
    if (!cleanMobile) {
      return res.status(400).json({
        message: "Please enter a valid 10-digit Indian mobile number starting with 6-9",
      });
    }

    if (!["registration", "login", "forgot_password"].includes(purpose)) {
      return res.status(400).json({ message: "Invalid OTP purpose" });
    }

    // Check account existence based on purpose
    const existingUser = await User.findOne({ mobile: cleanMobile });

    if (purpose === "registration" && existingUser) {
      return res.status(400).json({
        message: "An account with this mobile number already exists. Please log in.",
      });
    }

    if (purpose === "forgot_password" && !existingUser) {
      return res.status(404).json({
        message: "No account found with this mobile number. Please register.",
      });
    }

    // Rate Limiting: Max 3 OTP requests in 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentRequestsCount = await Otp.countDocuments({
      mobile: cleanMobile,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (recentRequestsCount >= 4) {
      return res.status(429).json({
        message: "Too many OTP requests. Please wait 10 minutes before requesting again.",
      });
    }

    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous pending unverified OTPs for this mobile & purpose
    await Otp.deleteMany({ mobile: cleanMobile, purpose });

    // Store new OTP
    await Otp.create({
      mobile: cleanMobile,
      otpHash,
      purpose,
      expiresAt,
    });

    // Send via WhatsApp if configured
    const whatsappMsg = `Your UDHAYA AQUATICS verification OTP is: ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    (async () => {
      try {
        await sendWhatsAppMessage(`91${cleanMobile}`, whatsappMsg);
      } catch (err) {
        console.warn("WhatsApp OTP dispatch notice:", err.message);
      }
    })();

    // Always log to console in local/dev for testing
    console.log(`\n========================================`);
    console.log(`[UDHAYA AQUATICS OTP]`);
    console.log(`To: +91 ${cleanMobile}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`OTP: ${otp}`);
    console.log(`Valid until: ${expiresAt.toLocaleTimeString()}`);
    console.log(`========================================\n`);

    const responsePayload = {
      success: true,
      message: `OTP sent successfully to +91 ${cleanMobile}`,
      expiresInMinutes: 10,
    };

    // Include debugOtp in development or testing so users/testers aren't blocked
    if (process.env.NODE_ENV !== "production") {
      responsePayload.debugOtp = otp;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("sendOtp error:", error);
    return res.status(500).json({
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to send OTP. Please try again."
          : error.message,
    });
  }
};

// @desc    VERIFY OTP
// @route   POST /api/users/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp, purpose } = req.body;

    const cleanMobile = cleanMobileNumber(mobile);
    if (!cleanMobile) {
      return res.status(400).json({ message: "Invalid mobile number" });
    }

    if (!otp || String(otp).trim().length !== 6) {
      return res.status(400).json({ message: "Please enter a valid 6-digit OTP" });
    }

    const otpDoc = await Otp.findOne({
      mobile: cleanMobile,
      purpose,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({
        message: "OTP has expired or was not requested. Please request a new OTP.",
      });
    }

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        message: "Too many failed attempts. This OTP has been invalidated. Please request a new one.",
      });
    }

    const inputHash = hashOtp(String(otp).trim());
    if (inputHash !== otpDoc.otpHash) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 5 - otpDoc.attempts;
      return res.status(400).json({
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    // Success! Generate single-use verification token valid for 15 minutes
    const verificationToken = crypto.randomBytes(32).toString("hex");
    otpDoc.verified = true;
    otpDoc.verificationToken = verificationToken;
    await otpDoc.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully!",
      verificationToken,
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({
      message:
        process.env.NODE_ENV === "production"
          ? "Failed to verify OTP. Please try again."
          : error.message,
    });
  }
};

module.exports = {
  cleanMobileNumber,
  hashOtp,
  sendOtp,
  verifyOtp,
};
