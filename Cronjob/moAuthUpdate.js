// cron/motilalCron.js
const axios = require("axios");
const os = require("os");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const User = require("../models/User");
const MoCredentials = require("../models/moCredentials"); // Make sure the path is correct

function generateHashedPassword(password, apiKey) {
  return crypto
    .createHash("sha256")
    .update(password + apiKey)
    .digest("hex");
}

function generateTOTP(secret) {
  return speakeasy.totp({ secret, encoding: "base32", digits: 6, step: 30 });
}

async function getPublicIp() {
  try {
    const res = await axios.get("https://api.ipify.org?format=json");
    return res.data.ip;
  } catch (e) {
    return "1.2.3.4";
  }
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const i of iface) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "1.2.3.4";
}

function getMacAddress() {
  return "00:00:00:00:00:00";
}

const updateMotilalTokens = async () => {
  const users = await User.find({ "MotilalBrokerData.0": { $exists: true } });
  console.log(users[0].MotilalBrokerData);
  for (const user of users) {
    const updatedBrokers = [];

    for (const broker of user.MotilalBrokerData) {
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
          vendorinfo: broker.clientId,
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
          userid: broker.clientId,
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
          broker.authcode = data.AuthToken;
          broker.authcodeUpdatedAt = new Date();
          updatedBrokers.push(broker.clientId);

          // Update or insert in moCredentials collection
          await MoCredentials.findOneAndUpdate(
            { client_id: broker.clientId },
            {
              client_id: broker.clientId,
              apiKey: broker.apiKey,
              auth_token: data.AuthToken,
            },
            { upsert: true, new: true }
          );

          console.log();
        } else {
          console.error(`Failed for ${broker.clientId}: ${data.message}`);
        }
      } catch (err) {
        console.error(`Error updating ${broker.clientId}: ${err.message}`);
      }
    }

    await user.save();
    console.log(`✅ Updated tokens for: ${updatedBrokers.join(", ")}`);
  }

  console.log("✅ Cron Job Complete");
};

module.exports = updateMotilalTokens;
