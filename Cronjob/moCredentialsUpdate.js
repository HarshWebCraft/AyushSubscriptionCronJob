// cron/motilalCron.js
const os = require("os");
const axios = require("axios");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const MotilalAuth = require("../models/moCredentials");

// Get local IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const i of iface) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "1.2.3.4"; // fallback
}

// Get public IP address
async function getPublicIp() {
  try {
    const res = await axios.get("https://api.ipify.org?format=json");
    return res.data.ip;
  } catch (e) {
    return "1.2.3.4"; // fallback
  }
}

// Dummy MAC address
function getMacAddress() {
  return "00:00:00:00:00:00";
}

// Generate hashed password using SHA256
function generateHashedPassword(password, apiKey) {
  return crypto
    .createHash("sha256")
    .update(password + apiKey)
    .digest("hex");
}

// Generate TOTP using speakeasy
function generateTOTP(secret) {
  return speakeasy.totp({ secret, encoding: "base32", digits: 6, step: 30 });
}

// Main function to update Motilal auth tokens
const updateMotilalTokens = async () => {
  const brokers = await MotilalAuth.find({});

  for (const broker of brokers) {
    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "MOSL/V.1.1.0",
        ApiKey: broker.apiKey,
        ClientLocalIp: getLocalIp(),
        ClientPublicIp: await getPublicIp(),
        MacAddress: getMacAddress(),
        SourceId: "WEB",
        vendorinfo: broker.client_id,
        osname: os.platform(),
        osversion: os.release(),
        devicemodel: process.env.DEVICE_MODEL || "AHV",
        manufacturer: process.env.MANUFACTURER || "DELL",
        productname: process.env.PRODUCT_NAME || "Xalgo",
        productversion: process.env.PRODUCT_VERSION || "1.0.0",
        browsername: process.env.BROWSER_NAME || "Chrome",
        browserversion: process.env.BROWSER_VERSION || "105.0",
      };

      const payload = {
        userid: broker.client_id,
        password: generateHashedPassword(broker.password, broker.apiKey),
        "2FA": broker.dob,
        totp: generateTOTP(broker.totp),
      };

      const response = await axios.post(
        "https://openapi.motilaloswal.com/rest/login/v3/authdirectapi",
        payload,
        { headers }
      );

      const data = response.data;

      if (data.status === "SUCCESS") {
        broker.auth_token = data.AuthToken;
        broker.updatedAt = new Date();
        await broker.save();
        console.log(`✅ Updated auth_token for: ${broker.client_id}`);
      } else {
        console.error(`❌ Failed for ${broker.client_id}: ${data.message}`);
      }
    } catch (err) {
      console.error(`❌ Error updating ${broker.client_id}: ${err.message}`);
    }
  }

  console.log("✅ Cron Job Complete");
};

module.exports = updateMotilalTokens;
