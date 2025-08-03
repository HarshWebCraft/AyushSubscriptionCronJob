const mongoose = require("mongoose");

// Define the License Schema
const licenseSchema = new mongoose.Schema({
  licenseKey: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  machineId: {
    type: String,
    trim: true,
  },
  createdAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

// Create the License Model
const License = mongoose.model("License", licenseSchema);

module.exports = License;
