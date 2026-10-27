const User = require("../models/userModel");
const Otp = require("../models/otpModel");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/generateToken");
const Settings = require("../models/settingsModel");
const { isEmailConfigured, sendEmail, templates } = require("../utils/emailService");
const {
  MAX_FAILED_ATTEMPTS,
  isAccountLocked,
  applyProgressiveDelay,
  recordFailedAttempt,
  resetFailedAttempts,
} = require("../utils/loginSecurity");
const { generateResetToken, hashToken } = require("../utils/passwordReset");
const { cleanMobileNumber } = require("./otpController");

// A fixed, valid-format dummy hash computed once at module load.
const DUMMY_HASH_PROMISE = bcrypt.hash("dummy-password-for-constant-time-comparison", 10);
const GENERIC_LOGIN_ERROR = "Invalid mobile number/email or password";

// @desc    REGISTER USER (Mobile + Mandatory OTP Verification)
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, mobile, email, password, verificationToken } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Please enter your name" });
    }

    const cleanMobile = cleanMobileNumber(mobile);
    if (!cleanMobile) {
      return res.status(400).json({ message: "Please provide a valid 10-digit Indian mobile number" });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Mobile OTP verification is mandatory for registration
    if (!verificationToken) {
      return res.status(400).json({ message: "Mobile OTP verification is mandatory before registration" });
    }

    const validOtpDoc = await Otp.findOne({
      mobile: cleanMobile,
      purpose: "registration",
      verified: true,
      verificationToken,
      expiresAt: { $gt: new Date() },
    });

    if (!validOtpDoc) {
      return res.status(400).json({
        message: "Invalid or expired OTP verification. Please verify your mobile number again.",
      });
    }

    // Check duplicate mobile
    const mobileExists = await User.findOne({ mobile: cleanMobile });
    if (mobileExists) {
      return res.status(400).json({ message: "Mobile number is already registered. Please log in." });
    }

    // Check duplicate email if provided
    let cleanEmail = null;
    if (email && typeof email === "string" && email.trim()) {
      cleanEmail = email.trim().toLowerCase();
      const emailExists = await User.findOne({ email: cleanEmail });
      if (emailExists) {
        return res.status(400).json({ message: "Email is already registered with another account" });
      }
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const user = await User.create({
      name: name.trim(),
      mobile: cleanMobile,
      isMobileVerified: true,
      email: cleanEmail,
      password: hashedPassword,
    });

    // Invalidate/delete the used OTP token
    await Otp.deleteMany({ mobile: cleanMobile, purpose: "registration" });

    if (user) {
      // Welcome email if email is provided and configured
      if (cleanEmail) {
        (async () => {
          try {
            const settings = await Settings.getSettings();
            if (isEmailConfigured() && settings.notifications.emailEnabled) {
              const { subject, html } = templates.welcome(user.name);
              await sendEmail({ to: user.email, subject, html });
            }
          } catch (err) {
            console.error("Welcome email error:", err);
          }
        })();
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role || "user",
        token: generateToken(user._id, user.tokenVersion),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("registerUser error:", error);
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

// @desc    LOGIN USER (Mobile OR Email + Password)
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { identifier, email, mobile, password } = req.body;

    const loginInput = (identifier || mobile || email || "").toString().trim();
    if (!loginInput || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Please enter your mobile number/email and password" });
    }

    const cleanMobile = cleanMobileNumber(loginInput);
    let user = null;

    if (cleanMobile) {
      user = await User.findOne({ mobile: cleanMobile });
    } else if (loginInput.includes("@")) {
      user = await User.findOne({ email: loginInput.toLowerCase() });
    } else {
      // Try by mobile first or string email
      user = await User.findOne({
        $or: [{ mobile: loginInput }, { email: loginInput.toLowerCase() }],
      });
    }

    // --- Locked account protection ---
    if (user && isAccountLocked(user)) {
      await bcrypt.compare(password, user.password);
      await applyProgressiveDelay(user.failedLoginAttempts);
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR });
    }

    const passwordMatches = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, await DUMMY_HASH_PROMISE).then(() => false);

    if (user && passwordMatches) {
      if (user.isDisabled) {
        return res.status(403).json({ message: "This account has been disabled. Please contact support." });
      }
      if (user.failedLoginAttempts > 0 || user.lockUntil) {
        await resetFailedAttempts(user._id);
      }
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role || "user",
        token: generateToken(user._id, user.tokenVersion),
      });
    }

    // --- Wrong password OR unknown account: delay and lockout tracking ---
    if (user) {
      const updated = await recordFailedAttempt(user._id);
      await applyProgressiveDelay(updated.failedLoginAttempts);

      if (updated.failedLoginAttempts === MAX_FAILED_ATTEMPTS && updated.email) {
        (async () => {
          try {
            const settings = await Settings.getSettings();
            if (isEmailConfigured() && settings.notifications.emailEnabled) {
              const { subject, html } = templates.accountLockout(updated.name);
              await sendEmail({ to: updated.email, subject, html });
            }
          } catch (err) {
            console.error("Lockout notification error:", err);
          }
        })();
      }
    } else {
      await applyProgressiveDelay(1);
    }

    return res.status(401).json({ message: GENERIC_LOGIN_ERROR });
  } catch (error) {
    console.error("loginUser error:", error);
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

// @desc    GET USER PROFILE
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

// @desc    UPDATE USER PROFILE
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.body.name) user.name = req.body.name.trim();

    if (req.body.email && req.body.email.trim().toLowerCase() !== user.email) {
      const emailTaken = await User.findOne({ email: req.body.email.trim().toLowerCase() });
      if (emailTaken && emailTaken._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: "Email is already in use" });
      }
      user.email = req.body.email.trim().toLowerCase();
    }

    if (req.body.mobile) {
      const cleanMob = cleanMobileNumber(req.body.mobile);
      if (!cleanMob) {
        return res.status(400).json({ message: "Invalid 10-digit mobile number" });
      }
      if (cleanMob !== user.mobile) {
        const mobTaken = await User.findOne({ mobile: cleanMob });
        if (mobTaken && mobTaken._id.toString() !== user._id.toString()) {
          return res.status(400).json({ message: "Mobile number is already in use by another account" });
        }
        user.mobile = cleanMob;
      }
    }

    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      mobile: updatedUser.mobile,
      email: updatedUser.email,
      role: updatedUser.role,
      addresses: updatedUser.addresses,
      token: generateToken(updatedUser._id, updatedUser.tokenVersion),
    });
  } catch (error) {
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

// @desc    DELETE USER PROFILE
// @route   DELETE /api/users/profile
// @access  Private
const deleteUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(req.user.id);
    res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

// ==========================================
// CUSTOMER ADDRESS CRUD (Section 3 & 4)
// ==========================================

// @desc    GET SAVED ADDRESSES
// @route   GET /api/users/addresses
// @access  Private
const getUserAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("addresses");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(user.addresses || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    ADD NEW ADDRESS
// @route   POST /api/users/addresses
// @access  Private
const addAddress = async (req, res) => {
  try {
    const { fullName, mobile, houseFlat, streetArea, city, district, state, pincode, landmark, addressType, isDefault } = req.body;

    if (!fullName || !mobile || !houseFlat || !streetArea || !city || !state || !pincode) {
      return res.status(400).json({ message: "Please fill all required address fields" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // If marked default or first address, unset other defaults
    const shouldBeDefault = Boolean(isDefault) || (user.addresses.length === 0);
    if (shouldBeDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    user.addresses.push({
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      houseFlat: houseFlat.trim(),
      streetArea: streetArea.trim(),
      city: city.trim(),
      district: (district || "").trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      landmark: (landmark || "").trim(),
      addressType: addressType || "Home",
      isDefault: shouldBeDefault,
    });

    await user.save();
    return res.status(201).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    UPDATE ADDRESS
// @route   PUT /api/users/addresses/:id
// @access  Private
const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    const { fullName, mobile, houseFlat, streetArea, city, district, state, pincode, landmark, addressType, isDefault } = req.body;

    if (fullName) addr.fullName = fullName.trim();
    if (mobile) addr.mobile = mobile.trim();
    if (houseFlat) addr.houseFlat = houseFlat.trim();
    if (streetArea) addr.streetArea = streetArea.trim();
    if (city) addr.city = city.trim();
    if (district !== undefined) addr.district = district.trim();
    if (state) addr.state = state.trim();
    if (pincode) addr.pincode = pincode.trim();
    if (landmark !== undefined) addr.landmark = landmark.trim();
    if (addressType) addr.addressType = addressType;

    if (isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = a._id.toString() === addr._id.toString();
      });
    }

    await user.save();
    return res.status(200).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    DELETE ADDRESS
// @route   DELETE /api/users/addresses/:id
// @access  Private
const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addr = user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: "Address not found" });

    const wasDefault = addr.isDefault;
    user.addresses.pull({ _id: req.params.id });

    // If deleted address was default, make the first remaining address default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return res.status(200).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    SET DEFAULT ADDRESS
// @route   PUT /api/users/addresses/:id/default
// @access  Private
const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let found = false;
    user.addresses.forEach((addr) => {
      if (addr._id.toString() === req.params.id) {
        addr.isDefault = true;
        found = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!found) return res.status(404).json({ message: "Address not found" });

    await user.save();
    return res.status(200).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// PASSWORD RESET (EMAIL OR MOBILE OTP)
// ==========================================

const GENERIC_RESET_REQUEST_MESSAGE =
  "If an account exists, password reset instructions have been dispatched.";

// @desc    RESET PASSWORD VIA MOBILE OTP
// @route   POST /api/users/reset-password-otp
// @access  Public
const resetPasswordWithOtp = async (req, res) => {
  try {
    const { mobile, verificationToken, password } = req.body;

    const cleanMobile = cleanMobileNumber(mobile);
    if (!cleanMobile) {
      return res.status(400).json({ message: "Please provide a valid 10-digit mobile number" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (!verificationToken) {
      return res.status(400).json({ message: "OTP verification token is required" });
    }

    const otpDoc = await Otp.findOne({
      mobile: cleanMobile,
      purpose: "forgot_password",
      verified: true,
      verificationToken,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return res.status(400).json({
        message: "Invalid or expired OTP session. Please request a new OTP to reset your password.",
      });
    }

    const user = await User.findOne({ mobile: cleanMobile });
    if (!user) {
      return res.status(404).json({ message: "User account not found" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate previous JWT sessions

    await user.save();
    await Otp.deleteMany({ mobile: cleanMobile, purpose: "forgot_password" });

    return res.status(200).json({
      success: true,
      message: "Password reset successful! Please log in with your new password.",
    });
  } catch (error) {
    console.error("resetPasswordWithOtp error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    REQUEST PASSWORD RESET (Email fallback)
// @route   POST /api/users/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== "string" || !email) {
      return res.status(400).json({ message: "Please enter your email address" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const { rawToken, tokenHash, expiresAt } = generateResetToken();
      await User.updateOne(
        { _id: user._id },
        { $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expiresAt } }
      );

      (async () => {
        try {
          const settings = await Settings.getSettings();
          if (isEmailConfigured() && settings.notifications.emailEnabled) {
            const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
            const resetUrl = `${frontendUrl}/reset-password/${rawToken}`;
            const { subject, html } = templates.passwordReset(user.name, resetUrl);
            await sendEmail({ to: user.email, subject, html });
          }
        } catch (err) {
          console.error("Password reset email error:", err);
        }
      })();
    }

    return res.status(200).json({ message: GENERIC_RESET_REQUEST_MESSAGE });
  } catch (error) {
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

// @desc    RESET PASSWORD WITH EMAIL TOKEN
// @route   POST /api/users/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const tokenHash = hashToken(token);
    const claimedUser = await User.findOneAndUpdate(
      { resetPasswordTokenHash: tokenHash, resetPasswordExpires: { $gt: new Date() } },
      { $set: { resetPasswordTokenHash: null, resetPasswordExpires: null } },
      { returnDocument: "before" }
    );

    if (!claimedUser) {
      return res.status(400).json({ message: "This reset link is invalid or has expired." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.updateOne(
      { _id: claimedUser._id },
      {
        $set: { password: hashedPassword, failedLoginAttempts: 0, lockUntil: null },
        $inc: { tokenVersion: 1 },
      }
    );

    return res.status(200).json({ message: "Your password has been reset. Please log in with your new password." });
  } catch (error) {
    res.status(500).json({
      message: process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message,
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
  getUserAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  resetPasswordWithOtp,
  forgotPassword,
  resetPassword,
};
