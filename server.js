const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const { startCron } = require("./cron.js");

const app = express();

// CORS configuration
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

// MongoDB connection
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

// Health check endpoint
app.get("/health", (req, res) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: "healthy" });
  } else {
    res
      .status(503)
      .json({ status: "unhealthy", error: "MongoDB not connected" });
  }
});

// SSE clients map
const sseClients = new Map();

// SSE endpoint for broker status updates
app.get("/broker-status-stream/:email", (req, res) => {
  const email = req.params.email;
  if (!email) {
    res.status(400).json({ error: "Email parameter is required" });
    return;
  }

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

  const initialMessage = { message: "Connected to SSE" };
  console.log(`📤 Sending initial SSE message for ${email}:`, initialMessage);
  res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    if (res.writable) {
      console.log(`📡 Sending keep-alive for ${email}`);
      res.write(`: keep-alive\n\n`);
    } else {
      clearInterval(keepAlive);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(keepAlive);
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

// Notify clients of broker status updates
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

// Debug endpoint to manually trigger cron job
app.get("/trigger-cron", async (req, res) => {
  try {
    await startCron(notifyBrokerStatusUpdate);
    res.status(200).json({ message: "Cron triggered successfully" });
  } catch (err) {
    console.error("❌ Manual cron trigger error:", err.message, err.stack);
    res.status(500).json({ error: "Failed to trigger cron" });
  }
});

// Start cron job
startCron(notifyBrokerStatusUpdate);

// Root endpoint
app.post("/", (req, res) => {
  console.log("Received POST request to root");
  res.status(200).json({ message: "Root endpoint" });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
