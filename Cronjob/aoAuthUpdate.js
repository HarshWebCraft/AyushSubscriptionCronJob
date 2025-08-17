const axios = require("axios");
const aoCredentials = require("../models/aoCredentials.js");
const mongoose = require("mongoose");
const speakeasy = require("speakeasy");

const updateAllAngelCredentials = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const users = await aoCredentials.find().session(session);

    for (const user of users) {
      const angelId = user.client_id;
      const angelpass = user.password;
      const ApiKey = user.apiKey;

      console.log(user.secret);
      const totpCode = speakeasy.totp({
        secret: user.secret,
        encoding: "base32",
      });

      const data = JSON.stringify({
        clientcode: angelId,
        password: angelpass,
        totp: totpCode,
      });

      const config = {
        method: "post",
        url: "https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "192.168.157.1",
          "X-ClientPublicIP": "106.193.147.98",
          "X-MACAddress": "fe80::87f:98ff:fe5a:f5cb",
          "X-PrivateKey": "xL9TyAO8",
        },
        data,
      };

      const response = await axios(config);
      console.log(response.data);
      const jwtToken = response.data.data.jwtToken;

      await aoCredentials.updateOne(
        { client_id: angelId },
        {
          $set: {
            jwt: jwtToken,
          },
        },
        { session }
      );

      console.log(`🔄 Updated JWT for ${angelId}`);
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Failed to update JWTs:", err.message);
  } finally {
    session.endSession();
  }
};

module.exports = updateAllAngelCredentials;
