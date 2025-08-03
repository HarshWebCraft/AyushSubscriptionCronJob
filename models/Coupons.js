const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  Coupunid: { type: String, default: "coupon1" },
  CouponName: { type: String, required: true },
  CouponType: { type: String, required: true },
  DiscountValue: { type: Number, required: true },
  EligibilityCriteria: { type: String, required: true },
  Description: { type: String, required: true },
  Status: { type: String, required: true },
  validityDays: Number,
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
