const express = require("express");
const cron = require("node-cron");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const User = require("./models/User");
const APIModel = require("./models/Api");
const bodyParser = require("body-parser");
const Subscription = require("./models/Subscription.js"); // Adjust path

const app = express();
app.use(express.text());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));

// MongoDB connection
mongoose.connect(
  "mongodb+srv://harshdvadhavana26:harshdv007@try.j3wxapq.mongodb.net/X-Algos?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// SSE setup
const sseClients = new Map();
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
  clientList.forEach((client) => {
    client.write(`data: ${JSON.stringify(brokerData)}\n\n`);
  });
};

// Cron job
const getTimezoneFromLabel = (label) => {
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

cron.schedule("* * * * *", async () => {
  console.log(
    "\n⏰ Cron started at",
    moment().tz("Asia/Kolkata").format("HH:mm:ss")
  );

  try {
    const email = "ayushsantoki1462004@gmail.com";
    const user = await User.findOne({ Email: email }).select(
      "ListOfBrokers XAlgoID"
    );
    const user2 = await User.findOne({ Email: email });
    if (!user) {
      console.log("❌ User not found");
      return;
    }

    const subscriptions = await Subscription.find({ XalgoID: user2.XalgoID });
    console.log("Subscriptions found:", subscriptions);

    let userNeedsUpdate = false;
    const brokers = [...(user.ListOfBrokers || [])];

    // Step 1: Update isActive based on tradingTimes
    for (let broker of brokers) {
      let shouldBeActive = false;
      const tz = broker.tradingTimes[0]?.timezone
        ? getTimezoneFromLabel(broker.tradingTimes[0].timezone)
        : "Asia/Kolkata";
      const now = moment().tz(tz);

      for (const time of broker.tradingTimes || []) {
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

        if (now.isSameOrAfter(start) && remainingSeconds > 0) {
          shouldBeActive = true;
          console.log(
            `✅ ${broker.clientId} is ACTIVE. Ends in ${remainingSeconds}s`
          );
        } else if (now.isBefore(start)) {
          const untilStart = start.diff(now, "seconds");
          console.log(`🕒 ${broker.clientId} will start in ${untilStart}s`);
        } else {
          console.log(`❌ ${broker.clientId} is currently inactive.`);
        }
      }

      if (broker.isActive !== shouldBeActive) {
        console.log(
          `➡️ Updating ${broker.clientId} isActive from ${broker.isActive} → ${shouldBeActive}`
        );
        broker.isActive = shouldBeActive;
        userNeedsUpdate = true;

        try {
          const updateResult = await API.updateOne(
            { "Apis.ApiID": broker.clientId },
            { $set: { "Apis.$.IsActive": shouldBeActive } }
          );
          console.log(
            `APIModel update result for ${broker.clientId} (isActive):`,
            updateResult
          );
        } catch (err) {
          console.error(
            `Failed to update APIModel isActive for ${broker.clientId}:`,
            err
          );
        }
      }
    }

    // Step 2: Update canActivate based on subscriptions
    // Step 2: Update canActivate based on subscriptions
    const grouped = {};
    brokers.forEach((b) => {
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
          `➡️ Broker ${plain.clientId}: index ${index} < totalAPI ${totalAPI} → canActivate: ${canActivate}`
        );
      });
    }

    // Step 3: Save updates to MongoDB if needed
    if (userNeedsUpdate) {
      user.ListOfBrokers = brokers; // Still saving only isActive changes
      user.markModified("ListOfBrokers");
      const saveResult = await user.save();
      console.log("✅ User broker status updated:", result); // 🔥 Use `result` not `saveResult.ListOfBrokers`
      notifyBrokerStatusUpdate(email, result); // 🔥 Send full result with `canActivate`
    } else {
      console.log("ℹ️ No broker status change needed.");
      console.log("📤 Current broker result (with canActivate):", result); // Add this for debug
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
});
