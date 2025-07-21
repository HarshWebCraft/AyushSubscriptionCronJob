const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const angelBrokerSchema = new Schema({
  AngelId: String,
  AngelPass: String,
  SecretKey: String,
  ApiKey: String,
  Date: String,
});

const deltaBrokerSchema = new Schema({
  deltaBrokerId: String,
  deltaSecretKey: String,
  deltaApiKey: String,
});

const DeployedSchema = new Schema({
  Strategy: String,
  StrategyName: String,
  Index: String,
  Quantity: String,
  Account: String,
  AppliedDate: String,
  IsActive: Boolean,
  Multiplier: Number,
});

const transaction = new Schema({
  payment_type: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
  },
  date: {
    type: String,
    required: true,
  },
  razorpay_payment_id: {
    type: String,
    required: true,
  },
  razorpay_order_id: {
    type: String,
    required: true,
  },
});

const SpreadsheetSchema = new Schema({
  strategyId: { type: Types.ObjectId, ref: "MarketPlace", required: true },
  spreadsheetId: { type: String, required: true },
});

const ReferrSchema = new Schema({
  PromoCode: String,
  ReferredBy: { type: String, default: null },
  ReferReward: { type: String, default: "" },
  PromotingRewardAMT: Number,
  Paid: { type: Boolean, default: false },
  Coupons: [
    {
      RewardName: String,
      RewardType: String,
      RewardValue: Number,
      Eligibility: String,
      Status: { type: String },
      Description: String,
      ExpirationDate: Date,
      AddedOn: { type: Date },
    },
  ],
});

const mt5BrokerSchema = new Schema({
  loginId: { type: String, required: true },
  password: { type: String, required: true },
  server: { type: String, required: true },
  accountName: { type: String, required: true },
  addedOn: { type: Date, default: Date.now },
});

const motilalBrokerSchema = new Schema({
  accountName: { type: String, required: true },
  clientId: { type: String, required: true },
  apiKey: { type: String, required: true },
  password: { type: String, required: true },
  totp: { type: String, required: true },
  dob: { type: String, required: true },
  authcode: { type: String, required: true },
  authcodeUpdatedAt: { type: Date, required: true },
  addedOn: { type: Date, default: Date.now, required: true },
});

const TradingTimeSchema = new Schema({
  timeRangeId: { type: String },
  startHour: { type: String, required: true },
  startMinute: { type: String, required: true },
  endHour: { type: String, required: true },
  endMinute: { type: String, required: true },
  timezone: { type: String, required: true },
});

const BrokerSchema = new Schema({
  apiName: { type: String, required: true },
  clientId: { type: String },
  broker: { type: String, required: true },
  // terminal_id: { type: String, required: true },
  tradingTimes: [TradingTimeSchema],
  isActive: { type: Boolean, default: false },
});

const userSchema = new Schema({
  Name: String,
  Email: String,
  Password: String,
  signupMethod: String,
  MobileNo: String,
  Balance: { type: Number, default: 0 },
  Transaction: [transaction],
  Profile_Img: String,
  Broker: Boolean,
  BrokerCount: Number,
  Verification: Boolean,
  Tour: Boolean,
  MyStartegies: [Number],
  ClientPin: Number,
  isPremium: { type: Boolean, default: false },
  AboutTrader: { type: String, default: "" },
  ActiveStrategys: Number,
  BrokerIds: [String],
  AngelBrokerData: [angelBrokerSchema],
  DeltaBrokerSchema: [deltaBrokerSchema],
  MT5BrokerData: [mt5BrokerSchema],
  MotilalBrokerData: [motilalBrokerSchema],
  DeployedStrategiesBrokerIds: [String],
  DeployedData: [DeployedSchema],
  SubscribedStrategies: [{ type: Types.ObjectId, ref: "MarketPlace" }],
  DeployedStrategies: [{ type: Types.ObjectId, ref: "MarketPlace" }],
  Spreadsheets: [SpreadsheetSchema],
  XalgoID: String,
  signupDate: { type: Date, required: true },
  isSubscribed: { type: Boolean, required: true, default: false },
  subscriptionStartDate: { type: Date },
  Referr: [ReferrSchema],
  AccountAliases: { type: Map, of: String },
  Favorite: [{ type: String }],
  ListOfBrokers: [BrokerSchema],
  sendLogMail: { type: Boolean, default: true },
});

const User = mongoose.model("UserData", userSchema);

module.exports = userSchema;
module.exports = angelBrokerSchema;
module.exports = deltaBrokerSchema;
module.exports = transaction;
module.exports = ReferrSchema;
module.exports = mt5BrokerSchema;
module.exports = User;
