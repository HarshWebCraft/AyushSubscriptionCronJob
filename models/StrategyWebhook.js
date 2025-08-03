const mongoose = require("mongoose");

const strategySchema = new mongoose.Schema({
  userId: String,
  strategyName: String,
  webhookUrl: String,
  deployIds: [String], // Array to store MT5 account IDs
  multipliers: [Number], // Array to store multipliers corresponding to deployIds
  stopOnLoss: [Number], // Array to store stop-loss percentages corresponding to deployIds
  stopOnProfit: [Number],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

const StrategyWebhook = mongoose.model("StrategyWebhook", strategySchema);

module.exports = StrategyWebhook;
