const TelegramService = require("../Services/telegramClass");
const crypto = require("crypto");

const webhookTelegram = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    console.log(
      `Received Telegram update for userId ${userId}:`,
      JSON.stringify(req.body, null, 2)
    );

    const userData = await req.db
      .collection("tradingviewbots")
      .findOne({ id: userId });
    if (!userData) {
      console.log(`User not found: userId=${userId}`);
      return res.status(404).json({
        error: "User not found",
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
          await req.db
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
          await req.db
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
      error: "Internal server error",
    });
  }
};

module.exports = webhookTelegram;
