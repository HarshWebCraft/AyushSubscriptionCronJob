const mongoose = require("mongoose");

const aoCredentialsSchema = new mongoose.Schema(
  {
    client_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    apiKey: {
      type: String,
      required: true,
      trim: true,
    },
    jwt: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("aoCredentials", aoCredentialsSchema);
