const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");
const cron = require("node-cron");
const updateAllCredentials = require("./Controller/authController.js");
const ExpiredSubscriptions = require("./Cronjob/subcription");

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://harshdvadhavana26:harshdv007@try.j3wxapq.mongodb.net/X-Algos?retryWrites=true&w=majority";

app.use(express.text({ type: ["text/plain", "text/*"] }));
app.use(express.json({ type: ["application/json", "application/*+json"] }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const allowedOrigins = [
  process.env.FRONTEND_URL || "https://xalgotelegram.netlify.app",
  "https://xalgos.in",
  "https://xcronjob.onrender.com",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

let db;

const client = new MongoClient(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function connectToMongoDB() {
  try {
    await client.connect();
    db = client.db("X-Algos");
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB using Mongoose and MongoClient");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    process.exit(1);
  }
}
connectToMongoDB();

// cron.schedule("* * * * *", async () => {
//   console.log("⏰ Running daily auth update...");
//   try {
//     await updateAllCredentials();
//     console.log("✅ auth update completed.");
//   } catch (err) {
//     console.error("❌ Error updating auth:", err);
//   }
// });
cron.schedule("0 8 * * *", async () => {
  console.log("⏰ Running daily auth update...");
  try {
    await updateAllCredentials();
    console.log("✅ auth update completed.");
  } catch (err) {
    console.error("❌ Error updating auth:", err);
  }
});

cron.schedule("5 0 * * *", async () => {
  console.log("⏰ Running daily subcription update...");
  try {
    await ExpiredSubscriptions();
    console.log("✅ subcription removed");
  } catch (err) {
    console.error("❌ Error updating subcription:", err);
  }
});

const sessions = new Map();
function sessionMiddleware(req, res, next) {
  const sessionId =
    req.headers["x-session-id"] || crypto.randomBytes(16).toString("hex");
  req.sessionId = sessionId;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {});
  }
  req.session = sessions.get(sessionId);
  res.setHeader("X-Session-ID", sessionId);
  req.db = db; // Attach db to request object
  next();
}
app.use(sessionMiddleware);

app.use(require("./Telegram/telegram.js"));

app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Not found",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message, error.stack);
  res.status(500).json({
    error: "Internal server error",
  });
});

app.listen(PORT, () => {
  ExpiredSubscriptions();
  console.log(`Server running on http://localhost:${PORT}`);
});
