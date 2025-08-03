const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  expires: Date,
  session: String,
});

const session = mongoose.model("sessions", sessionSchema);

module.exports = session;
