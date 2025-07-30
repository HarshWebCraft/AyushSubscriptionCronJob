const TelegramService = require("./telegramClass");

const webhookTradingview = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const secretKey = req.params.secretKey;
    const userData = await req.db
      .collection("tradingviewbots")
      .findOne({ id: userId });

    if (!userData || userData.secretKey !== secretKey) {
      console.log(
        `Unauthorized access: userId=${userId}, secretKey=${secretKey}`
      );
      return res.status(401).json({
        error: "Unauthorized",
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
      await req.db.collection("tradingviewbotsAlert").insertOne({
        userId,
        webhookData,
        contentType,
        sentSuccessfully: false,
        createdAt: new Date(),
        errorMessage: errorMsg,
      });
      return res.status(400).json({
        error: "No chats configured. Please complete authentication first.",
      });
    }

    await req.db.collection("tradingviewbotsAlert").insertOne({
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
          error: "Failed to send alert to some chats",
        });
  } catch (error) {
    console.error("Error in tradingview webhook:", error.message, error.stack);
    await req.db.collection("tradingviewbotsAlert").insertOne({
      userId: parseInt(req.params.userId),
      webhookData: req.body || String(req.rawBody || ""),
      contentType: req.headers["content-type"] || "unknown",
      sentSuccessfully: false,
      createdAt: new Date(),
      errorMessage: error.message,
    });
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

module.exports = webhookTradingview;
