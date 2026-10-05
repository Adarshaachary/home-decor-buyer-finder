const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");

const buyersRouter = require("./routes/buyers");
const emailRouter = require("./routes/email");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/buyers", buyersRouter);
app.use("/api/email", emailRouter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Home Decor Buyer Finder API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    serpApiConfigured: Boolean(process.env.SERPAPI_KEY),
    brevoConfigured: Boolean(process.env.BREVO_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});