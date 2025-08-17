const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  Account: { type: String, required: true },
  NoOfAPI: { type: Number, required: true },
  Duration: { type: String, required: true },
  XalgoID: { type: String, required: true },
  CreatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);
