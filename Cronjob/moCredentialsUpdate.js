const MotilalAuth = require("../models/moCredentials");

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
