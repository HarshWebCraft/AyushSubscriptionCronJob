const mongoose = require("mongoose");
const StrategyWebhook = require("../models/StrategyWebhook");
const User = require("../models/User");
const API = require("../models/Api");

const removeBroker = async (clientId, XId, email, delBroker, session) => {
  console.log("data to be remove", clientId, XId, email, delBroker);

  const updateResult = await User.updateOne(
    { Email: email },
    {
      $pull: {
        BrokerIds: clientId,
        DeployedData: { Account: clientId },
        ListOfBrokers: { clientId: clientId, broker: delBroker },
      },
      $unset: {
        [`AccountAliases.${clientId}`]: "",
      },
      $inc: { BrokerCount: -1 },
    },
    { session }
  );

  if (updateResult.modifiedCount === 0) {
    throw new Error("Broker not found or already removed");
  }

  // Update API collection
  await API.updateOne(
    { XAlgoID: "XAlgoID" },
    {
      $pull: {
        Apis: { ApiID: clientId },
      },
    },
    { session }
  );

  // Update strategy webhooks
  const strategyWebhooks = await StrategyWebhook.find({
    deployIds: clientId,
    userId: XId,
  }).session(session);

  for (const doc of strategyWebhooks) {
    const index = doc.deployIds.findIndex((id) => id === clientId);
    if (index !== -1) {
      doc.deployIds.splice(index, 1);
      doc.multipliers.splice(index, 1);
      doc.stopOnLoss.splice(index, 1);
      doc.stopOnProfit.splice(index, 1);

      await StrategyWebhook.updateOne(
        { _id: doc._id },
        {
          $set: {
            deployIds: doc.deployIds,
            multipliers: doc.multipliers,
            stopOnLoss: doc.stopOnLoss,
            stopOnProfit: doc.stopOnProfit,
          },
        },
        { session }
      );
    }
  }
};

module.exports = removeBroker;
