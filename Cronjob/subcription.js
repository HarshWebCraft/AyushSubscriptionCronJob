const logoutMT5 = require("../DeleteBroker/MT5/logoutMT.js");
const removeMT5 = require("../DeleteBroker/MT5/removeMT5.js");
const removeDelta = require("../DeleteBroker/removeDelta.js");
const removeMotilal = require("../DeleteBroker/removeMotilal.js");
const removeAngelOne = require("../DeleteBroker/removeAngelOne.js");
const Subcription = require("../models/Subscription.js");
const User = require("../models/User.js");

const handleMT5Deletion = async (clientId, delBroker, APIName, XId, email) => {
  try {
    const result = await removeMT5({
      body: { clientId, delBroker, APIName, XId, email },
    });
    console.log(`MT5 broker ${clientId} removal result:`, result.message);
  } catch (error) {
    console.error(`Error during removeMT5 for ${clientId}:`, error.message);
  }
};

const handleAngelOneDeletion = async (
  clientId,
  delBroker,
  APIName,
  XId,
  email
) => {
  try {
    const result = await removeAngelOne({
      body: { clientId, delBroker, APIName, XId, email },
    });
    console.log(`AngelOne broker ${clientId} removal result:`, result.message);
  } catch (error) {
    console.error(
      `Error during removeAngelOne for ${clientId}:`,
      error.message
    );
  }
};

const handleMotilalDeletion = async (
  clientId,
  delBroker,
  APIName,
  XId,
  email
) => {
  try {
    await removeMotilal(clientId, delBroker, APIName, XId, email);
    console.log(`Motilal broker ${clientId} removed successfully`);
  } catch (error) {
    console.error(`Error during removeMotilal for ${clientId}:`, error.message);
  }
};

const handleDeltaDeletion = async (
  clientId,
  delBroker,
  APIName,
  XId,
  email
) => {
  try {
    const result = await removeDelta({
      body: { clientId, delBroker, APIName, XId, email },
    });
    console.log(`Delta broker ${clientId} removal result:`, result.message);
  } catch (error) {
    console.error(`Error during removeDelta for ${clientId}:`, error.message);
  }
};

const ExpiredSubscriptions = async () => {
  const data = await Subcription.find({});
  const today = new Date();

  for (const element of data) {
    const createdAt = new Date(element.CreatedAt);
    const duration = parseInt(element.Duration);
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + duration);

    const isExpired = today > expiryDate;

    if (isExpired) {
      // Check for other active subscriptions for the same XalgoID and Account
      const activeSubscriptions = await Subcription.find({
        XalgoID: element.XalgoID,
        Account: element.Account,
        _id: { $ne: element._id }, // Exclude the current subscription
      });

      // Check if there are any non-expired subscriptions
      const hasActiveSubscription = activeSubscriptions.some((sub) => {
        const subCreatedAt = new Date(sub.CreatedAt);
        const subDuration = parseInt(sub.Duration);
        const subExpiryDate = new Date(subCreatedAt);
        subExpiryDate.setDate(subExpiryDate.getDate() + subDuration);
        return today <= subExpiryDate;
      });

      // Skip deletion if there is an active subscription for the same broker
      if (hasActiveSubscription) {
        console.log(
          `Skipping deletion for XalgoID: ${element.XalgoID}, Account: ${element.Account} due to active subscription.`
        );
        continue;
      }

      const userData = await User.findOne({ XalgoID: element.XalgoID });

      if (userData && Array.isArray(userData.ListOfBrokers)) {
        let filterBroker;

        if (element.Account === "Indian Broker") {
          filterBroker = userData.ListOfBrokers.filter(
            (broker) =>
              broker.broker === "AngelOne" || broker.broker === "Motilal"
          );
        } else {
          filterBroker = userData.ListOfBrokers.filter(
            (broker) => broker.broker === element.Account
          );
        }

        for (const broker of filterBroker) {
          console.log(
            `Processing deletion for clientId: ${broker.clientId}, broker: ${broker.broker}`
          );
          switch (broker.broker) {
            case "MT 5":
              await handleMT5Deletion(
                broker.clientId,
                broker.broker,
                broker.apiName,
                userData.XalgoID,
                userData.Email
              );
              break;
            case "AngelOne":
              await handleAngelOneDeletion(
                broker.clientId,
                broker.broker,
                broker.apiName,
                userData.XalgoID,
                userData.Email
              );
              break;
            case "Motilal":
              await handleMotilalDeletion(
                broker.clientId,
                broker.broker,
                broker.apiName,
                userData.XalgoID,
                userData.Email
              );
              break;
            case "Delta":
              await handleDeltaDeletion(
                broker.clientId,
                broker.broker,
                broker.apiName,
                userData.XalgoID,
                userData.Email
              );
              break;
            default:
              console.log("Unknown broker:", broker.broker);
          }
        }
      }
    }
  }
};

module.exports = ExpiredSubscriptions;
