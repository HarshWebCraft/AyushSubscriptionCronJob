// const express = require("express");
// const cron = require("node-cron");
// const mongoose = require("mongoose");
// const moment = require("moment-timezone");
// const User = require("./models/User");
// const APIModel = require("./models/Api");
// const Subscription = require("./models/Subscription.js");
// const bodyParser = require("body-parser");
// const cors = require("cors");

// const app = express();

// const allowedOrigins = [
//   "http://localhost:3000",
//   "https://your-netlify-app.netlify.app",
//   "https://xalgos.in",
// ];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         console.error(`CORS blocked for origin: ${origin}`);
//         callback(new Error("Not allowed by CORS"));
//       }
//     },
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
//     credentials: true,
//     optionsSuccessStatus: 204,
//   })
// );

// app.use(express.text());
// app.use(bodyParser.json({ limit: "10mb" }));
// app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// const MONGODB_URI =
//   process.env.MONGODB_URI ||
//   "mongodb+srv://harshdvadhavana26:harshdv007@try.j3wxapq.mongodb.net/X-Algos?retryWrites=true&w=majority";

// mongoose
//   .connect(MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("✅ Connected to MongoDB"))
//   .catch((err) => console.error("❌ MongoDB connection error:", err));

// app.get("/health", (req, res) => {
//   if (mongoose.connection.readyState === 1) {
//     res.status(200).json({ status: "healthy" });
//   } else {
//     res
//       .status(503)
//       .json({ status: "unhealthy", error: "MongoDB not connected" });
//   }
// });

// const sseClients = new Map();

// app.get("/broker-status-stream/:email", (req, res) => {
//   const email = req.params.email;
//   res.set({
//     "Content-Type": "text/event-stream",
//     "Cache-Control": "no-cache",
//     Connection: "keep-alive",
//     "Access-Control-Allow-Origin":
//       req.headers.origin || "https://your-netlify-app.netlify.app",
//     "Access-Control-Allow-Credentials": "true",
//     "X-Accel-Buffering": "no",
//   });
//   res.flushHeaders();

//   if (!sseClients.has(email)) {
//     sseClients.set(email, []);
//   }

//   const clientList = sseClients.get(email);
//   clientList.push(res);
//   console.log(
//     `SSE client connected for ${email}. Total clients: ${clientList.length}, Origin: ${req.headers.origin}`
//   );

//   res.write(`data: ${JSON.stringify({ message: "Connected to SSE" })}\n\n`);

//   const heartbeatInterval = setInterval(() => {
//     try {
//       res.write(`data: ${JSON.stringify({ message: "heartbeat" })}\n\n`);
//     } catch (err) {
//       console.error(`❌ Heartbeat error for ${email}:`, err.message);
//       clearInterval(heartbeatInterval);
//       clientList.splice(clientList.indexOf(res), 1);
//       if (clientList.length === 0) {
//         sseClients.delete(email);
//       }
//       res.end();
//     }
//   }, 10000);

//   req.on("error", (err) => {
//     console.error(`❌ Request error for ${email}: ${err.message}`);
//   });

//   req.on("close", () => {
//     clearInterval(heartbeatInterval);
//     const clientList = sseClients.get(email) || [];
//     sseClients.set(
//       email,
//       clientList.filter((client) => client !== res)
//     );
//     if (sseClients.get(email).length === 0) {
//       sseClients.delete(email);
//     }
//     console.log(
//       `SSE client disconnected for ${email}. Remaining clients: ${
//         sseClients.get(email)?.length || 0
//       }, Origin: ${req.headers.origin}`
//     );
//     res.end();
//   });
// });

// const notifyBrokerStatusUpdate = (email, brokerData) => {
//   const clientList = sseClients.get(email) || [];
//   console.log(
//     `📤 Sending SSE notification for ${email}: dbUpdated=${brokerData.dbUpdated}, brokers=`,
//     brokerData.brokers
//   );
//   clientList.forEach((client) => {
//     try {
//       client.write(`data: ${JSON.stringify(brokerData)}\n\n`);
//     } catch (err) {
//       console.error(`❌ Error sending SSE to ${email}:`, err.message);
//     }
//   });
// };

// const getTimezoneFromLabel = (label) => {
//   if (!label) return "Asia/Kolkata";
//   const match = label.match(/\((UTC[+-]\d{2}:\d{2})\)/);
//   if (match) {
//     const offset = match[1].replace("UTC", "");
//     const zones = moment.tz.names();
//     return (
//       zones.find((zone) => moment.tz(zone).format("Z") === offset) ||
//       "Asia/Kolkata"
//     );
//   }
//   if (label.includes("IST")) return "Asia/Kolkata";
//   return "Asia/Kolkata";
// };

// cron.schedule("*/60 * * * * *", async () => {
//   console.log(
//     "\n⏰ Cron started at",
//     moment().tz("Asia/Kolkata").format("HH:mm:ss")
//   );

//   try {
//     const users = await User.find({})
//       .select("Email ListOfBrokers XalgoID")
//       .lean();

//     if (!users || users.length === 0) {
//       console.log("❌ No users found in the database");
//       return;
//     }

//     for (const user of users) {
//       console.log(
//         `\n📦 Processing user: ${user.Email}, XalgoID: ${user.XalgoID}`
//       );

//       // Fetch subscriptions for the user
//       const subscriptions = await Subscription.find({
//         XalgoID: user.XalgoID,
//       }).lean();
//       console.log(
//         `Subscriptions for ${user.Email}:`,
//         JSON.stringify(subscriptions, null, 2)
//       );

//       let userNeedsUpdate = false;
//       const brokers = [...(user.ListOfBrokers || [])];
//       const updatedBrokers = [];

//       // Process isActive based on trading times
//       for (let broker of brokers) {
//         let shouldBeActive = broker.isActive;
//         const tz = broker.tradingTimes?.[0]?.timezone
//           ? getTimezoneFromLabel(broker.tradingTimes[0].timezone)
//           : "Asia/Kolkata";
//         const now = moment().tz(tz);

//         console.log(
//           `Checking trading times for ${broker.clientId} (Broker: ${broker.broker}):`,
//           broker.tradingTimes
//         );

//         if (!broker.tradingTimes || broker.tradingTimes.length === 0) {
//           console.log(
//             `ℹ No trading times for ${broker.clientId}, preserving isActive=${broker.isActive}`
//           );
//           updatedBrokers.push({ ...broker });
//           continue;
//         }

//         let isWithinTimeWindow = false;
//         for (const time of broker.tradingTimes) {
//           const start = moment.tz(tz).set({
//             year: now.year(),
//             month: now.month(),
//             date: now.date(),
//             hour: parseInt(time.startHour, 10),
//             minute: parseInt(time.startMinute, 10),
//             second: 0,
//           });
//           const end = moment.tz(tz).set({
//             year: now.year(),
//             month: now.month(),
//             date: now.date(),
//             hour: parseInt(time.endHour, 10),
//             minute: parseInt(time.endMinute, 10),
//             second: 0,
//           });

//           const remainingSeconds = end.diff(now, "seconds");
//           const untilStart = start.diff(now, "seconds");

//           console.log(
//             `Time window for ${broker.clientId}: ${start.format(
//               "HH:mm"
//             )} - ${end.format("HH:mm")} (Now: ${now.format("HH:mm:ss")})`
//           );

//           if (now.isSameOrAfter(start) && remainingSeconds >= 0) {
//             isWithinTimeWindow = true;
//             shouldBeActive = true;
//             console.log(
//               `✅ ${broker.clientId} is ACTIVE. Ends in ${remainingSeconds}s`
//             );
//             break;
//           } else if (now.isBefore(start)) {
//             console.log(`🕒 ${broker.clientId} will start in ${untilStart}s`);
//           } else {
//             console.log(`❌ ${broker.clientId} is currently inactive.`);
//           }
//         }

//         if (!isWithinTimeWindow) {
//           shouldBeActive = false;
//         }

//         if (broker.isActive !== shouldBeActive) {
//           console.log(
//             `➡ Updating ${broker.clientId} isActive from ${broker.isActive} → ${shouldBeActive}`
//           );
//           broker.isActive = shouldBeActive;
//           userNeedsUpdate = true;

//           try {
//             const updateResult = await APIModel.updateOne(
//               { "Apis.ApiID": broker.clientId, XAlgoID: user.XalgoID },
//               { $set: { "Apis.$.IsActive": shouldBeActive } }
//             );
//             if (updateResult.matchedCount === 0) {
//               console.error(
//                 `❌ No matching ApiID ${broker.clientId} or XAlgoID ${user.XalgoID} in APIModel`
//               );
//             } else if (updateResult.modifiedCount === 0) {
//               console.error(
//                 `❌ No changes applied for ${broker.clientId} in APIModel`
//               );
//             } else {
//               console.log(
//                 `✅ APIModel updated for ${broker.clientId} (isActive=${shouldBeActive})`
//               );
//             }
//           } catch (err) {
//             console.error(
//               `❌ Failed to update APIModel for ${broker.clientId}:`,
//               err.message
//             );
//           }
//         } else {
//           console.log(
//             `ℹ No change in isActive for ${broker.clientId} (remains ${broker.isActive})`
//           );
//         }
//         updatedBrokers.push({ ...broker });
//       }

//       // Subscription validation and canActivate assignment
//       const grouped = {};
//       updatedBrokers.forEach((b) => {
//         const type = b.broker?.toLowerCase()?.replace(/\s+/g, "") || "unknown";
//         if (!grouped[type]) grouped[type] = [];
//         grouped[type].push(b);
//       });

//       const result = [];
//       const now = moment();

//       for (const [type, list] of Object.entries(grouped)) {
//         // Filter valid subscriptions
//         const validSubscriptions = subscriptions.filter((s) => {
//           const accType = s.Account?.toLowerCase()?.replace(/\s+/g, "");
//           if (!accType || accType !== type) {
//             console.log(
//               `❌ Subscription skipped for ${type}: Account=${
//                 s.Account || "undefined"
//               } does not match`
//             );
//             return false;
//           }

//           if (!s.CreatedAt || !moment(s.CreatedAt).isValid()) {
//             console.log(
//               `❌ Subscription skipped for ${type}: Invalid CreatedAt=${s.CreatedAt}`
//             );
//             return false;
//           }

//           const durationDays = parseInt(s.Duration, 10);
//           if (isNaN(durationDays) || durationDays <= 0) {
//             console.log(
//               `❌ Subscription skipped for ${type}: Invalid Duration=${s.Duration}`
//             );
//             return false;
//           }

//           const createdAt = moment(s.CreatedAt);
//           const expiresAt = createdAt.clone().add(durationDays, "days");
//           const isValid = now.isBefore(expiresAt);

//           if (!isValid) {
//             console.log(
//               `❌ Subscription skipped for ${type}: ID=${
//                 s._id
//               }, Expired at ${expiresAt.format(
//                 "YYYY-MM-DD HH:mm:ss"
//               )} (Now: ${now.format("YYYY-MM-DD HH:mm:ss")})`
//             );
//             return false;
//           }

//           console.log(
//             `✅ Valid subscription for ${type}: ID=${s._id}, Account=${
//               s.Account
//             }, CreatedAt=${createdAt.format(
//               "YYYY-MM-DD HH:mm:ss"
//             )}, Duration=${durationDays}d, ExpiresAt=${expiresAt.format(
//               "YYYY-MM-DD HH:mm:ss"
//             )}, NoOfAPI=${s.NoOfAPI || "undefined"}`
//           );

//           return true;
//         });

//         const totalAPI = validSubscriptions.reduce((sum, s) => {
//           const apiCount = parseInt(s.NoOfAPI, 10);
//           if (isNaN(apiCount) || apiCount < 0) {
//             console.log(
//               `❌ Invalid NoOfAPI for subscription ${s._id}: ${s.NoOfAPI}`
//             );
//             return sum;
//           }
//           return sum + apiCount;
//         }, 0);

//         console.log(
//           `🔍 Broker Type: ${type}, Total API slots: ${totalAPI}, Brokers: ${list.length}`
//         );

//         list.forEach((broker, index) => {
//           const canActivate = index < totalAPI;
//           const plain = { ...broker, canActivate };
//           result.push(plain);

//           console.log(
//             ` ➡ Broker ${broker.clientId} (${type}): index=${index}, totalAPI=${totalAPI}, canActivate=${canActivate}`
//           );
//         });
//       }

//       // Update user if needed
//       if (userNeedsUpdate) {
//         try {
//           await User.updateOne(
//             { Email: user.Email },
//             { $set: { ListOfBrokers: updatedBrokers } }
//           );
//           console.log(`✅ User ${user.Email} broker status updated in DB`);
//           notifyBrokerStatusUpdate(user.Email, {
//             brokers: result,
//             dbUpdated: true,
//           });
//         } catch (err) {
//           console.error(
//             `❌ Failed to save broker updates for ${user.Email}:`,
//             err.message
//           );
//           notifyBrokerStatusUpdate(user.Email, {
//             brokers: result,
//             dbUpdated: false,
//           });
//         }
//       } else {
//         console.log(`ℹ No broker status change needed for ${user.Email}`);
//         notifyBrokerStatusUpdate(user.Email, {
//           brokers: result,
//           dbUpdated: false,
//         });
//       }
//     }
//   } catch (error) {
//     console.error("❌ Cron job error:", error.message, error.stack);
//   }
// });

// app.get("/trigger-cron", async (req, res) => {
//   try {
//     await require("./server").cron();
//     res.status(200).json({ message: "Cron triggered successfully" });
//   } catch (err) {
//     console.error("❌ Manual cron trigger error:", err.message, err.stack);
//     res.status(500).json({ error: "Failed to trigger cron" });
//   }
// });

// app.listen(8080, () => console.log("Server running on port 8080"));

const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://harshdvadhavana26:harshdv007@try.j3wxapq.mongodb.net/X-Algos?retryWrites=true&w=majority";

// Define allowed origins for CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://xalgotelegram.netlify.app",
  "https://xalgos.in",
].filter(Boolean);

// CORS middleware
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

// MongoDB Client
let db;

// Add this after MongoDB connection setup
const client = new MongoClient(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Modified connectToMongoDB function
async function connectToMongoDB() {
  try {
    await client.connect();
    db = client.db("X-Algos"); // Explicitly specify database name
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

// Middleware
app.use(express.text({ type: ["text/plain", "text/*"] }));
app.use(express.json({ type: ["application/json", "application/*+json"] }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const { updateMotilalTokens } = require("./Cronjob/moAuthUpdate.js");

// CRON JOB FOR MOTILAL
app.use("/moAuthUpdate", require("./Cronjob/moAuthUpdate.js"));
app.use("/moCredentialsUpdate", require("./Cronjob/moCredentialsUpdate.js"));

const cron = require("node-cron");
const refreshMotilalAuthCodes = require("./Cronjob/moAuthUpdate.js");
const bodyParser = require("body-parser");

cron.schedule("0 4 * * *", async () => {
  console.log("🔄 Running Motilal Login Cron at 9:30 AM IST");
  await updateMotilalTokens(); // ✅ Now doesn't expect req/res
});

app.post("/updateAuth", (req, res) => refreshMotilalAuthCodes(req, res));

// Run it now
// (async () => {
//   console.log("⚡ Manually triggering Motilal Login Cron now");
//   await refreshMotilalAuthCodes();
// })();

// Session middleware
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
  next();
}
app.use(sessionMiddleware);

class TelegramService {
  constructor(botToken) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async verifyBotToken() {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`, {
        timeout: 10000,
      });
      return response.status === 200 && response.data.ok
        ? response.data.result
        : null;
    } catch (error) {
      console.error("Error verifying bot token:", error.message);
      return null;
    }
  }

  async sendMessage(chatId, text, parseMode = null) {
    try {
      const payload = {
        chat_id: chatId,
        text: text,
      };
      if (parseMode) payload.parse_mode = parseMode;
      const response = await axios.post(
        `${this.baseUrl}/sendMessage`,
        payload,
        { timeout: 10000 }
      );
      console.log(`Sent message to chat ${chatId}:`, text);
      return response.status === 200;
    } catch (error) {
      console.error(`Error sending message to chat ${chatId}:`, error.message);
      return false;
    }
  }

  async setWebhook(webhookUrl) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/setWebhook`,
        { url: webhookUrl, allowed_updates: ["message", "channel_post"] },
        { timeout: 10000 }
      );
      console.log(`Webhook set successfully: ${webhookUrl}`);
      return response.status === 200;
    } catch (error) {
      console.error("Error setting webhook:", error.message);
      return false;
    }
  }

  formatTradingViewAlert(alertData, contentType) {
    try {
      console.log("formatTradingViewAlert input:", { alertData, contentType });

      if (alertData === null || alertData === undefined) {
        return "No data received\n\nPowered by Xalgos.in";
      }

      if (contentType.includes("text/plain") || typeof alertData === "string") {
        return `${alertData.trim() || "Empty message"}\n\nPowered by Xalgos.in`;
      }

      if (
        contentType.includes("application/json") ||
        typeof alertData === "object"
      ) {
        try {
          const formatted = JSON.stringify(alertData, null, 2);
          return `\`\`\`json\n${formatted}\n\`\`\`\n\nPowered by Xalgos.in`;
        } catch (error) {
          console.error("Error formatting JSON:", error.message);
          return `Malformed JSON data: ${JSON.stringify(
            alertData
          )}\n\nPowered by Xalgos.in`;
        }
      }

      return `Unsupported data format: ${String(
        alertData
      )}\n\nPowered by Xalgos.in`;
    } catch (error) {
      console.error("Error processing alert:", error.message);
      return `Error processing data: ${String(
        alertData
      )}\n\nPowered by Xalgos.in`;
    }
  }
}

function generateAuthCommand(botUsername, userId, alertType = "personal") {
  if (alertType === "channel") {
    const unique_code = uuidv4().substring(0, 8).toUpperCase();
    return `auth ${unique_code}`;
  } else {
    const secret =
      process.env.HMAC_SECRET || "3HKlcLqdkJmvjhoAf8FnYzr4Ua6QBWtG";
    const data = `${userId}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(data);
    const encodedData = hmac.digest("base64");
    return `/auth@${botUsername} ${encodedData}`;
  }
}

function flashMessage(req, message, type = "success") {
  if (!req.session.flash) req.session.flash = [];
  req.session.flash.push({
    message: `${message}\n\nPowered by Xalgos.in`,
    type,
  });
}

function getFlashMessages(req) {
  const messages = req.session.flash || [];
  req.session.flash = [];
  return messages;
}

// API Routes
app.get("/api", (req, res) => {
  res.json({ flashMessages: getFlashMessages(req) });
});

app.post("/api/setup", async (req, res) => {
  try {
    const { bot_token, image, XId } = req.body;

    if (!bot_token || !bot_token.trim()) {
      flashMessage(req, "Bot token is required", "error");
      return res.status(400).json({
        error: "Bot token is required\n\nPowered by Xalgos.in",
      });
    }

    const existingUser = await db
      .collection("tradingviewbots")
      .findOne({ botToken: bot_token.trim() });
    if (existingUser) {
      flashMessage(req, "This bot token is already registered", "error");
      return res.status(400).json({
        error: "This bot token is already registered\n\nPowered by Xalgos.in",
      });
    }

    const telegramService = new TelegramService(bot_token.trim());
    const botInfo = await telegramService.verifyBotToken();

    if (!botInfo) {
      flashMessage(
        req,
        "Invalid bot token. Please check your token and try again.",
        "error"
      );
      return res.status(400).json({
        error: "Invalid bot token\n\nPowered by Xalgos.in",
      });
    }

    const lastUser = await db
      .collection("tradingviewbots")
      .find({})
      .sort({ id: -1 })
      .limit(1)
      .toArray();

    const lastId = lastUser.length > 0 ? lastUser[0].id : 0;
    const userId = lastId + 1;

    const secretKey = uuidv4();
    const botUsername = botInfo.username || "unknown";
    const alertTypes = ["personal", "group", "channel"];
    const alerts = alertTypes.map((alertType) => ({
      alertType,
      authCommand: generateAuthCommand(botUsername, userId, alertType),
      chatId: null,
    }));

    const protocol = req.get("X-Forwarded-Proto") || req.protocol;
    const host = req.get("Host");
    const webhookUrl = `${protocol}://${host}/webhook/telegram/${userId}`;
    const webhookTradingViewUrl = `${protocol}://${host}/webhook/tradingview/${userId}/${secretKey}`;

    const userData = {
      id: userId,
      botToken: bot_token.trim(),
      botUsername,
      image: image || null,
      secretKey,
      alerts,
      XalgoID: XId || null,
      webhookURL: webhookTradingViewUrl,
      createdAt: new Date(),
    };

    console.log("Inserting user:", JSON.stringify(userData, null, 2));
    await db.collection("tradingviewbots").insertOne(userData);
    await telegramService.setWebhook(webhookUrl);

    const userAlerts = await db
      .collection("tradingviewbotsAlert")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    flashMessage(req, "Bot configured successfully!", "success");
    return res.json({
      redirect: `/dashboard/${userId}`,
      flashMessages: getFlashMessages(req),
      userData,
      recentAlerts: userAlerts,
      webhookUrl: webhookTradingViewUrl,
    });
  } catch (error) {
    console.error("Error in setup:", error.message, error.stack);
    flashMessage(req, "An error occurred while setting up the bot", "error");
    return res.status(500).json({
      error: "Internal server error\n\nPowered by Xalgos.in",
    });
  }
});

app.get("/api/dashboard/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userData = await db
      .collection("tradingviewbots")
      .findOne({ id: userId });

    if (!userData) {
      flashMessage(req, "User not found", "error");
      return res.status(404).json({
        error: "User not found\n\nPowered by Xalgos.in",
      });
    }

    const userAlerts = await db
      .collection("tradingviewbotsAlert")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    const protocol = req.get("X-Forwarded-Proto") || req.protocol;
    const host = req.get("Host");
    const webhookUrl = `${protocol}://${host}/webhook/tradingview/${userId}/${userData.secretKey}`;

    res.json({
      flashMessages: getFlashMessages(req),
      userData,
      recentAlerts: userAlerts,
      webhookUrl,
    });
  } catch (error) {
    console.error("Error in dashboard:", error.message, error.stack);
    flashMessage(
      req,
      "An error occurred while fetching dashboard data",
      "error"
    );
    res.status(500).json({
      error: "Internal server error\n\nPowered by Xalgos.in",
    });
  }
});

app.post("/webhook/tradingview/:userId/:secretKey", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const secretKey = req.params.secretKey;
    const userData = await db
      .collection("tradingviewbots")
      .findOne({ id: userId });

    if (!userData || userData.secretKey !== secretKey) {
      console.log(
        `Unauthorized access: userId=${userId}, secretKey=${secretKey}`
      );
      return res.status(401).json({
        error: "Unauthorized\n\nPowered by Xalgos.in",
      });
    }

    const contentType = req.headers["content-type"] || "unknown";
    console.log(
      `Received TradingView alert for user ${userId}, Content-Type: ${contentType}, Data:`,
      JSON.stringify(req.body, null, 2)
    );

    let webhookData;
    if (contentType.includes("application/json")) {
      webhookData = req.body;
    } else if (contentType.includes("text/plain")) {
      webhookData = req.body;
    } else {
      webhookData = req.body || String(req.rawBody || "");
      console.warn(
        `Unsupported Content-Type: ${contentType}, treating as raw data`
      );
    }

    const telegramService = new TelegramService(userData.botToken);
    const formattedMessage = telegramService.formatTradingViewAlert(
      webhookData,
      contentType
    );

    let allSuccess = true;
    const alertResults = [];

    for (const alert of userData.alerts) {
      if (alert.chatId) {
        const success = await telegramService.sendMessage(
          alert.chatId,
          formattedMessage,
          contentType.includes("json") ? "Markdown" : null
        );
        alertResults.push({
          alertType: alert.alertType,
          chatId: alert.chatId,
          sentSuccessfully: success,
          errorMessage: success
            ? null
            : `Failed to send message to ${alert.alertType}`,
        });
        if (!success) allSuccess = false;
      }
    }

    if (alertResults.length === 0) {
      const errorMsg =
        "No chats configured. Please complete authentication for at least one alert type.";
      await db.collection("tradingviewbotsAlert").insertOne({
        userId,
        webhookData,
        contentType,
        sentSuccessfully: false,
        createdAt: new Date(),
        errorMessage: errorMsg,
      });
      return res.status(400).json({
        error:
          "No chats configured. Please complete authentication first.\n\nPowered by Xalgos.in",
      });
    }

    await db.collection("tradingviewbotsAlert").insertOne({
      userId,
      webhookData,
      contentType,
      formattedMessage,
      sentSuccessfully: allSuccess,
      createdAt: new Date(),
      errorMessage: allSuccess ? null : "Failed to send to some chats",
      alertResults,
    });

    return allSuccess
      ? res.json({ status: "success" })
      : res.status(500).json({
          error: "Failed to send alert to some chats\n\nPowered by Xalgos.in",
        });
  } catch (error) {
    console.error("Error in tradingview webhook:", error.message, error.stack);
    await db.collection("tradingviewbotsAlert").insertOne({
      userId: parseInt(req.params.userId),
      webhookData: req.body || String(req.rawBody || ""),
      contentType: req.headers["content-type"] || "unknown",
      sentSuccessfully: false,
      createdAt: new Date(),
      errorMessage: error.message,
    });
    return res.status(500).json({
      error: "Internal server error\n\nPowered by Xalgos.in",
    });
  }
});

app.post("/webhook/telegram/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    console.log(
      `Received Telegram update for userId ${userId}:`,
      JSON.stringify(req.body, null, 2)
    );

    const userData = await db
      .collection("tradingviewbots")
      .findOne({ id: userId });
    if (!userData) {
      console.log(`User not found: userId=${userId}`);
      return res.status(404).json({
        error: "User not found\n\nPowered by Xalgos.in",
      });
    }

    const telegramService = new TelegramService(userData.botToken);
    const update = req.body;
    let message, chat, text, chatType;

    if (update.message) {
      message = update.message;
      chat = message.chat || {};
      text = message.text || "";
      chatType = chat.type || "unknown";
      console.log("Processing regular message:", {
        chatId: chat.id,
        chatType,
        text,
      });
    } else if (update.channel_post) {
      message = update.channel_post;
      chat = message.chat || {};
      text = message.text || "";
      chatType = "channel";
      console.log("Processing channel post:", {
        chatId: chat.id,
        chatType,
        text,
      });
    } else {
      console.log(
        "No message or channel_post found in update:",
        JSON.stringify(update, null, 2)
      );
      return res.json({ status: "ok" });
    }

    // Handle /start command
    if (text === "/start") {
      await telegramService.sendMessage(
        chat.id,
        `🔒 Authentication Required\nTo continue, please complete authentication using the /auth command.\n\nPowered by Xalgos.in`,
        "Markdown"
      );
      return res.json({ status: "ok" });
    }

    let authSuccess = false;
    let authAlertType = null;

    for (const alert of userData.alerts) {
      if (
        alert.alertType === "channel" &&
        chatType === "channel" &&
        text.startsWith("auth ") &&
        text.length > 5
      ) {
        const receivedCode = text.substring(5).trim();
        const storedCode = alert.authCommand.startsWith("auth ")
          ? alert.authCommand.substring(5).trim()
          : alert.authCommand;

        console.log(
          `Channel auth check: received '${receivedCode}' vs stored '${storedCode}'`
        );

        if (receivedCode === storedCode) {
          await db
            .collection("tradingviewbots")
            .updateOne(
              { id: userId, "alerts.alertType": alert.alertType },
              { $set: { "alerts.$.chatId": String(chat.id) } }
            );
          console.log(
            `Channel auth successful: chatId ${chat.id} linked to userId ${userId} for ${alert.alertType}`
          );
          authSuccess = true;
          authAlertType = alert.alertType;
          break;
        }
      } else if (
        text.startsWith(`/auth@${userData.botUsername}`) &&
        ["personal", "group"].includes(alert.alertType)
      ) {
        const parts = text.trim().split(" ");
        if (parts.length < 2) {
          console.log(`Invalid auth command: missing encoded data`);
          continue;
        }

        const encodedData = parts[1];
        const secret =
          process.env.HMAC_SECRET || "3HKlcLqdkJmvjhoAf8FnYzr4Ua6QBWtG";
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(`${userId}`);
        const expectedEncodedData = hmac.digest("base64");

        if (
          encodedData === expectedEncodedData &&
          ((alert.alertType === "personal" && chatType === "private") ||
            (alert.alertType === "group" &&
              ["group", "supergroup"].includes(chatType)))
        ) {
          await db
            .collection("tradingviewbots")
            .updateOne(
              { id: userId, "alerts.alertType": alert.alertType },
              { $set: { "alerts.$.chatId": String(chat.id) } }
            );
          console.log(
            `Auth successful: chatId ${chat.id} linked to userId ${userId} for ${alert.alertType} (chatType: ${chatType})`
          );
          authSuccess = true;
          authAlertType = alert.alertType;
          break;
        } else {
          console.log(
            `Auth failed for ${alert.alertType}: invalid HMAC or chatType mismatch (chatType: ${chatType})`
          );
        }
      }
    }

    if (authSuccess) {
      await telegramService.sendMessage(
        chat.id,
        `✅ Authentication Successful!\nYour Bot is now ready!!!\n\nPowered by Xalgos.in`,
        "Markdown"
      );
    } else if (text.startsWith("auth ") || text.startsWith("/auth")) {
      await telegramService.sendMessage(
        chat.id,
        `❌ Authentication Failed\nInvalid /auth command. Please enter the correct /auth command.\n\nPowered by Xalgos.in`,
        "Markdown"
      );
    }

    return res.json({ status: "ok" });
  } catch (error) {
    console.error("Error in telegram webhook:", error.message, error.stack);
    return res.status(500).json({
      error: "Internal server error\n\nPowered by Xalgos.in",
    });
  }
});

app.get("/api/regenerate/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userData = await db
      .collection("tradingviewbots")
      .findOne({ id: userId });

    if (!userData) {
      flashMessage(req, "User not found", "error");
      return res.status(404).json({
        error: "User not found\n\nPowered by Xalgos.in",
      });
    }

    const newSecretKey = uuidv4();
    await db
      .collection("tradingviewbots")
      .updateOne({ id: userId }, { $set: { secretKey: newSecretKey } });

    flashMessage(req, "Secret key regenerated successfully!", "success");
    res.json({ status: "success", newSecretKey });
  } catch (error) {
    console.error("Error in regenerate:", error.message, error.stack);
    flashMessage(
      req,
      "An error occurred while regenerating secret key",
      "error"
    );
    res.status(500).json({
      error: "Internal server error\n\nPowered by Xalgos.in",
    });
  }
});

app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Not found\n\nPowered by Xalgos.in",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message, error.stack);
  res.status(500).json({
    error: "Internal server error\n\nPowered by Xalgos.in",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
