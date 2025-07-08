const express = require("express");
const cron = require("node-cron");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const User = require("./models/User");
const APIModel = require("./models/Api");
const Subscription = require("./models/Subscription.js");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());

const allowedOrigins = ["http://localhost:3000", "https://xalgos.in"];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.text());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://harshdvadhavana26:harshdv007@try.j3wxapq.mongodb.net/X-Algos?retryWrites=true&w=majority";

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.get("/health", (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: "healthy" });
  } else {
    res
      .status(503)
      .json({ status: "unhealthy", error: "MongoDB not connected" });
  }
});

const sseClients = new Map();

app.post("/", (req, res) => {
  console.log("Received POST request to root");
});

app.get("/broker-status-stream/:email", (req, res) => {
  const email = req.params.email;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!sseClients.has(email)) {
    sseClients.set(email, []);
  }
  sseClients.get(email).push(res);
  console.log(
    `SSE client connected for ${email}. Total clients: ${
      sseClients.get(email).length
    }`
  );

  res.write(`data: ${JSON.stringify({ message: "Connected to SSE" })}\n\n`);

  req.on("close", () => {
    const clientList = sseClients.get(email) || [];
    sseClients.set(
      email,
      clientList.filter((client) => client !== res)
    );
    if (sseClients.get(email).length === 0) {
      sseClients.delete(email);
    }
    console.log(
      `SSE client disconnected for ${email}. Remaining clients: ${
        sseClients.get(email)?.length || 0
      }`
    );
    res.end();
  });
});

const notifyBrokerStatusUpdate = (email, brokerData) => {
  const clientList = sseClients.get(email) || [];
  console.log(
    `📤 Sending SSE notification for ${email}: dbUpdated=${brokerData.dbUpdated}, brokers=`,
    brokerData.brokers
  );
  clientList.forEach((client) => {
    client.write(`data: ${JSON.stringify(brokerData)}\n\n`);
  });
};

const getTimezoneFromLabel = (label) => {
  if (!label) return "Asia/Kolkata";
  const match = label.match(/\((UTC[+-]\d{2}:\d{2})\)/);
  if (match) {
    const offset = match[1].replace("UTC", "");
    const zones = moment.tz.names();
    return (
      zones.find((zone) => moment.tz(zone).format("Z") === offset) ||
      "Asia/Kolkata"
    );
  }
  if (label.includes("IST")) return "Asia/Kolkata";
  return "Asia/Kolkata";
};

cron.schedule("*/60 * * * * *", async () => {
  console.log(
    "\n⏰ Cron started at",
    moment().tz("Asia/Kolkata").format("HH:mm:ss")
  );

  try {
    const users = await User.find({})
      .select("Email ListOfBrokers XalgoID")
      .lean();

    if (!users || users.length === 0) {
      console.log("❌ No users found in the database");
      return;
    }

    for (const user of users) {
      console.log(`\n📦 Processing user: ${user.Email}`);
      console.log(`📦 Processing X user: ${user.XalgoID}`);

      const subscriptions = await Subscription.find({
        XalgoID: user.XalgoID,
      }).lean();
      console.log(`Subscriptions for ${user.Email}:`, subscriptions);

      let userNeedsUpdate = false;
      const brokers = [...(user.ListOfBrokers || [])];
      const updatedBrokers = [];

      for (let broker of brokers) {
        let shouldBeActive = broker.isActive; // Default to current isActive
        const tz = broker.tradingTimes?.[0]?.timezone
          ? getTimezoneFromLabel(broker.tradingTimes[0].timezone)
          : "Asia/Kolkata";
        const now = moment().tz(tz);

        console.log(
          `Checking trading times for ${broker.clientId}:`,
          broker.tradingTimes
        );

        // If no trading times exist, preserve current isActive
        if (!broker.tradingTimes || broker.tradingTimes.length === 0) {
          console.log(
            `ℹ No trading times found for ${broker.clientId}, preserving isActive=${broker.isActive}`
          );
          updatedBrokers.push({ ...broker });
          continue;
        }

        // Check trading time windows
        let isWithinTimeWindow = false;
        for (const time of broker.tradingTimes) {
          const start = moment.tz(tz).set({
            year: now.year(),
            month: now.month(),
            date: now.date(),
            hour: +time.startHour,
            minute: +time.startMinute,
            second: 0,
          });
          const end = moment.tz(tz).set({
            year: now.year(),
            month: now.month(),
            date: now.date(),
            hour: +time.endHour,
            minute: +time.endMinute,
            second: 0,
          });

          const remainingSeconds = end.diff(now, "seconds");
          const untilStart = start.diff(now, "seconds");

          console.log(
            `Time window for ${broker.clientId}: ${start.format(
              "HH:mm"
            )} - ${end.format("HH:mm")} (Now: ${now.format("HH:mm:ss")})`
          );

          if (now.isSameOrAfter(start) && remainingSeconds >= 0) {
            isWithinTimeWindow = true;
            shouldBeActive = true;
            console.log(
              `✅ ${broker.clientId} is ACTIVE. Ends in ${remainingSeconds}s`
            );
            break;
          } else if (now.isBefore(start)) {
            console.log(`🕒 ${broker.clientId} will start in ${untilStart}s`);
          } else {
            console.log(`❌ ${broker.clientId} is currently inactive.`);
          }
        }

        // If not within any time window, set to false
        if (!isWithinTimeWindow) {
          shouldBeActive = false;
        }

        if (broker.isActive !== shouldBeActive) {
          console.log(
            `➡ Updating ${broker.clientId} isActive from ${broker.isActive} → ${shouldBeActive}`
          );
          broker.isActive = shouldBeActive;
          userNeedsUpdate = true;

          try {
            const apiDoc = await APIModel.findOne({
              "Apis.ApiID": broker.clientId,
            });
            console.log(`APIModel document for ${broker.clientId}:`, apiDoc);

            const updateResult = await APIModel.updateOne(
              { "Apis.ApiID": broker.clientId, XAlgoID: user.XalgoID },
              { $set: { "Apis.$.IsActive": shouldBeActive } }
            );
            if (updateResult.matchedCount === 0) {
              console.error(
                `❌ No matching ApiID ${broker.clientId} or XAlgoID ${user.XalgoID} found in APIModel`
              );
            } else if (updateResult.modifiedCount === 0) {
              console.error(
                `❌ No changes applied for ${broker.clientId} in APIModel`
              );
            } else {
              console.log(
                `✅ APIModel updated for ${broker.clientId} (isActive=${shouldBeActive}):`,
                updateResult
              );
              userNeedsUpdate = true;
            }
          } catch (err) {
            console.error(
              `❌ Failed to update APIModel for ${broker.clientId}:`,
              err.message,
              err.stack
            );
          }
        } else {
          console.log(
            `ℹ No change in isActive for ${broker.clientId} (remains ${broker.isActive})`
          );
        }
        updatedBrokers.push({ ...broker });
      }

      const grouped = {};
      updatedBrokers.forEach((b) => {
        const type = b.broker?.toLowerCase()?.replace(/\s+/g, "") || "unknown";
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(b);
      });

      const result = [];

      for (const [type, list] of Object.entries(grouped)) {
        const totalAPI = subscriptions
          .filter((s) => s.Account?.toLowerCase()?.replace(/\s+/g, "") === type)
          .reduce((sum, s) => sum + (s.NoOfAPI || 0), 0);

        console.log(`🔍 Broker Type: ${type}, totalAPI: ${totalAPI}`);

        list.forEach((broker, index) => {
          const plain = broker.toObject?.() || broker;
          const canActivate = index < totalAPI;
          plain.canActivate = canActivate;
          result.push(plain);

          console.log(
            ` ➡ Broker ${plain.clientId}: index ${index} < totalAPI ${totalAPI} → canActivate: ${canActivate}`
          );
        });
      }

      if (userNeedsUpdate) {
        try {
          await User.updateOne(
            { Email: user.Email },
            { $set: { ListOfBrokers: updatedBrokers } }
          );
          console.log(`✅ User ${user.Email} broker status updated`);
          notifyBrokerStatusUpdate(user.Email, {
            brokers: result,
            dbUpdated: true,
          });
        } catch (err) {
          console.error(
            `❌ Failed to save broker updates for ${user.Email}:`,
            err.message,
            err.stack
          );
          notifyBrokerStatusUpdate(user.Email, {
            brokers: result,
            dbUpdated: false,
          });
        }
      } else {
        console.log(`ℹ No broker status change needed for ${user.Email}`);
        notifyBrokerStatusUpdate(user.Email, {
          brokers: result,
          dbUpdated: false,
        });
      }
    }
  } catch (error) {
    console.error("❌ Cron job error:", error.message, error.stack);
  }
});

// Debug endpoint to manually trigger cron job
app.get("/trigger-cron", async (req, res) => {
  try {
    // Simulate cron job execution
    await require("./server").cron();
    res.status(200).json({ message: "Cron triggered successfully" });
  } catch (err) {
    console.error("❌ Manual cron trigger error:", err.message, err.stack);
    res.status(500).json({ error: "Failed to trigger cron" });
  }
});

app.listen(8080, () => console.log("Server running on port 5001"));
