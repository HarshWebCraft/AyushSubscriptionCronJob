const axios = require("axios");

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

      // Get current server time in IST with short timezone name
      const serverTime =
        new Date().toLocaleString("en-US", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " IST";

      // Wrap time in Markdown italic formatting
      const italicTime = `*${serverTime}*`;

      if (alertData === null || alertData === undefined) {
        return `No data received\n\nSignal Time: ${italicTime}\nPowered by Xalgos.in`;
      }

      if (contentType.includes("text/plain") || typeof alertData === "string") {
        return `${
          alertData.trim() || "Empty message"
        }\n\nSignal Time: ${italicTime}\nPowered by Xalgos.in`;
      }

      if (
        contentType.includes("application/json") ||
        typeof alertData === "object"
      ) {
        try {
          const formatted = JSON.stringify(alertData, null, 2);
          return `\`\`\`json\n${formatted}\n\`\`\`\n\nSignal Time: ${italicTime}\nPowered by Xalgos.in`;
        } catch (error) {
          console.error("Error formatting JSON:", error.message);
          return `Malformed JSON data: ${JSON.stringify(
            alertData
          )}\n\nSignal Time: ${italicTime}\nPowered by Xalgos.in`;
        }
      }

      return `Unsupported data format: ${String(
        alertData
      )}\n\nSignal Time: ${italicTime}\nPowered by Xalgos.in`;
    } catch (error) {
      console.error("Error processing alert:", error.message);
      return `Error processing data: ${String(
        alertData
      )}\n\nSignal Time: ${italicTime}\nPowered by Xalgos.in`;
    }
  }
}

module.exports = TelegramService;
