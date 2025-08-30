const User = require("../models/users");
const API = require("../models/Api");
const StrategyWebhook = require("../models/StrategyWebhook");
const Archive = require("../models/Archive.js");

// Helper function to archive removed data in a single entry
const archiveRemovedData = async (XalgoID, clientId, session) => {
  try {
    // Prepare data to archive
    const archiveData = {
      user: {},
      api: {},
      webhook: [],
    };

    // Collect User data
    const user = await User.findOne({ XalgoID }).session(session);
    if (user) {
      archiveData.user = {
        BrokerIds: user.BrokerIds.includes(clientId) ? [clientId] : [],
        DeployedData: user.DeployedData.filter((d) => d.Account === clientId),
        AccountAliases: user.AccountAliases.get(clientId)
          ? { [clientId]: user.AccountAliases.get(clientId) }
          : {},
      };
    }

    // Collect API data
    const api = await API.findOne({ XAlgoID: "XAlgoID" }).session(session);
    if (api) {
      const apiData = api.Apis.find((a) => a.ApiID === clientId);
      if (apiData) {
        archiveData.api = apiData;
      }
    }

    // Collect StrategyWebhook data
    const strategyWebhooks = await StrategyWebhook.find({
      userId: XalgoID,
      deployIds: clientId,
    }).session(session);
    for (const doc of strategyWebhooks) {
      const index = doc.deployIds.findIndex((id) => id === clientId);
      if (index !== -1) {
        archiveData.webhook.push({
          strategyId: doc._id,
          deployId: doc.deployIds[index],
          multiplier: doc.multipliers[index],
          stopOnLoss: doc.stopOnLoss[index],
          stopOnProfit: doc.stopOnProfit[index],
        });
      }
    }

    // Check for existing archive entry to prevent duplication
    const existingArchive = await Archive.findOne({ XalgoID }).session(session);
    if (existingArchive) {
      // Update existing entry by merging data (avoid duplicates)
      const updatedUserData = {
        BrokerIds: [
          ...new Set([
            ...(existingArchive.archivedData.user.BrokerIds || []),
            ...archiveData.user.BrokerIds,
          ]),
        ],
        DeployedData: [
          ...(existingArchive.archivedData.user.DeployedData || []),
          ...archiveData.user.DeployedData.filter(
            (newData) =>
              !existingArchive.archivedData.user.DeployedData?.some(
                (oldData) => oldData.Account === newData.Account
              )
          ),
        ],
        AccountAliases: {
          ...(existingArchive.archivedData.user.AccountAliases || {}),
          ...archiveData.user.AccountAliases,
        },
      };

      const updatedApiData = archiveData.api.ApiID
        ? existingArchive.archivedData.api.ApiID === archiveData.api.ApiID
          ? existingArchive.archivedData.api
          : archiveData.api
        : existingArchive.archivedData.api;

      const updatedWebhookData = [
        ...(existingArchive.archivedData.webhook || []),
        ...archiveData.webhook.filter(
          (newHook) =>
            !existingArchive.archivedData.webhook?.some(
              (oldHook) =>
                oldHook.strategyId.toString() ===
                  newHook.strategyId.toString() &&
                oldHook.deployId === newHook.deployId
            )
        ),
      ];

      await Archive.updateOne(
        { XalgoID },
        {
          $set: {
            archivedData: {
              user: updatedUserData,
              api: updatedApiData,
              webhook: updatedWebhookData,
            },
            archivedAt: new Date(),
          },
        },
        { session }
      );
    } else {
      // Create new archive entry if none exists
      await Archive.create(
        [
          {
            XalgoID,
            archivedData: archiveData,
            archivedAt: new Date(),
          },
        ],
        { session }
      );
    }
  } catch (error) {
    console.error(
      `Error archiving data for XalgoID ${XalgoID}, clientId ${clientId}:`,
      error
    );
    throw error;
  }
};

// Modified removeBroker function to include archiving
const removeBroker = async (clientId, XId, email, delBroker, session) => {
  console.log("Data to be removed:", clientId, XId, email, delBroker);

  // Archive data before removal
  await archiveRemovedData(XId, clientId, session);

  // Proceed with existing removal logic
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
