const mongoose = require("mongoose");

const subscribedStrategySchema = new mongoose.Schema({
  XAlgoId: { type: String, required: true },
  subscribedStrategies: [
    {
      strategyId: { type: String, required: true },
      subscribedAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("SubscribedStrategy", subscribedStrategySchema);
