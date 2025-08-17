const mongodb = require("mongoose");

const transaction = new mongodb.Schema({
  XAlgoId: { type: String, required: true },
  Transaction: [
    {
      razorpay_payment_id: { type: String, required: true },
      razorpay_order_id: { type: String, required: true },
      status: { type: Boolean, required: true },
      amount: { type: Number, required: true },
      createdAt: { type: Date, required: true },
      plan: { type: String, required: true },
    },
  ],
});

module.exports = mongodb.model("transaction", transaction);
