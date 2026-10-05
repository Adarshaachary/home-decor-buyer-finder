const express = require("express");
const rateLimit = require("express-rate-limit");

const buyers = require("./buyers");

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/send", async (req, res) => {
  const {
    to,
    subject,
    message,
  } = req.body || {};

  if (
    !to ||
    !EMAIL_RE.test(to.trim())
  ) {
    return res.status(400).json({
      error:
        "Please enter a valid recipient email.",
    });
  }

  if (
    !subject ||
    !subject.trim() ||
    subject.length > 200
  ) {
    return res.status(400).json({
      error:
        "Please enter a subject (max 200 characters).",
    });
  }

  if (
    !message ||
    !message.trim() ||
    message.length > 5000
  ) {
    return res.status(400).json({
      error:
        "Please enter a message (max 5000 characters).",
    });
  }

  const target =
    to.trim().toLowerCase();

  const testList = (
    process.env.TEST_RECIPIENTS || ""
  )
    .split(",")
    .map((email) =>
      email.trim().toLowerCase()
    )
    .filter(Boolean);

  const knownEmails =
    buyers.knownEmails instanceof Set
      ? buyers.knownEmails
      : new Set();

  if (
    !knownEmails.has(target) &&
    !testList.includes(target)
  ) {
    return res.status(400).json({
      error:
        "You can only email buyers returned by a search. Please search again.",
    });
  }

  const {
    BREVO_API_KEY,
    SENDER_EMAIL,
    SENDER_NAME,
  } = process.env;

  if (
    !BREVO_API_KEY ||
    !SENDER_EMAIL
  ) {
    return res.status(500).json({
      error:
        "Server email settings are missing.",
    });
  }

  try {
    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",

        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type":
            "application/json",
          accept:
            "application/json",
        },

        body: JSON.stringify({
          sender: {
            name:
              SENDER_NAME ||
              "Home Decor Seller",

            email:
              SENDER_EMAIL,
          },

          replyTo: {
            email:
              SENDER_EMAIL,
          },

          to: [
            {
              email: target,
            },
          ],

          subject:
            subject.trim(),

          textContent:
            message.trim(),
        }),
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Brevo error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        error:
          "Unable to send email. Please try again.",
      });
    }

    return res.json({
      ok: true,
      message:
        "Email sent successfully.",
    });
  } catch (error) {
    console.error(
      "Email error:",
      error.message
    );

    return res.status(502).json({
      error:
        "Unable to send email. Please try again.",
    });
  }
});

module.exports = router;