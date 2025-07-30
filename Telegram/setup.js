const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const TelegramService = require("./telegram");

const setup = async (req, res) => {
  function flashMessage(req, message, type = "success") {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({
      message: `${message}\n\nPowered by Xalgos.in`,
      type,
    });
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

  function getFlashMessages(req) {
    const messages = req.session.flash || [];
    req.session.flash = [];
    return messages;
  }

  try {
    const { bot_token, image, XId } = req.body;

    if (!bot_token || !bot_token.trim()) {
      flashMessage(req, "Bot token is required", "error");
      return res.status(400).json({
        error: "Bot token is required",
      });
    }

    const existingUser = await req.db
      .collection("tradingviewbots")
      .findOne({ botToken: bot_token.trim() });
    if (existingUser) {
      flashMessage(req, "This bot token is already registered", "error");
      return res.status(400).json({
        error: "This bot token is already registered",
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
        error: "Invalid bot token",
      });
    }

    const lastUser = await req.db
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
    await req.db.collection("tradingviewbots").insertOne(userData);
    await telegramService.setWebhook(webhookUrl);

    const userAlerts = await req.db
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
      error: "Internal server error",
    });
  }
};

module.exports = setup;
