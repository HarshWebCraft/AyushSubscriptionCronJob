
const mongoose = require("mongoose");

const ApiItemSchema = new mongoose.Schema({
  ApiID: { type: String, required: true },
  IsActive: { type: Boolean, default: false },
});

const UserApisSchema = new mongoose.Schema({
  XAlgoID: { type: String },
  Apis: [ApiItemSchema],
});

const SingleApiModel = mongoose.model("API", UserApisSchema);

module.exports = SingleApiModel;