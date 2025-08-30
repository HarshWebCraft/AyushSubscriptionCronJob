const mongoose = require("mongoose");

const archiveSchema = new mongoose.Schema({
  XalgoID: { type: String, required: true, unique: true, index: true }, // Unique XalgoID for each user
  archivedData: {
    user: { type: Object, default: {} }, // Stores BrokerIds, DeployedData, AccountAliases
    api: { type: Object, default: {} }, // Stores Apis data
    webhook: { type: Array, default: [] }, // Stores array of webhook data
  },
  archivedAt: { type: Date, default: Date.now, index: { expires: "365d" } }, // Auto-delete after 1 year
});

module.exports = mongoose.model("Archive", archiveSchema);
