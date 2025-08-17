// const mongoose = require("mongoose");

// const ApiItemSchema = new mongoose.Schema({
//   API: { type: String, required: true },
//   IsActive: { type: Boolean, default: true },
// });

// const XAlgoSchema = new mongoose.Schema({
//   XAlgoID: { type: String, required: true },
//   APIs: [ApiItemSchema],
// });

// const XAlgoModel = mongoose.model("API", XAlgoSchema);

// module.exports = XAlgoModel;

const mongoose = require("mongoose");

const ApiItemSchema = new mongoose.Schema({
  ApiID: { type: String, required: true },
  IsActive: { type: Boolean, default: true },
});

const UserApisSchema = new mongoose.Schema({
  XAlgoID: { type: String },
  Apis: [ApiItemSchema],
});

const SingleApiModel = mongoose.model("API", UserApisSchema);

module.exports = SingleApiModel;
