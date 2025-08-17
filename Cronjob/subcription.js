const logoutMT5 = require("../DeleteBroker/MT5/logoutMT.js");
const removeMT5 = require("../DeleteBroker/MT5/removeMT5.js");
const removeDelta = require("../DeleteBroker/removeDelta.js");
const removeMotilal = require("../DeleteBroker/removeMotilal.js");
const removeAngelOne = require("../DeleteBroker/removeAngelOne.js");
const Subscription = require("../models/Subscription.js");
const User = require("../models/User.js");
const mongoose = require("mongoose");

// Utility to introduce delay for rate-limiting
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (operation, maxRetries = 3, retryDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isWriteConflict = error.code === 112; // WriteConflict code
      if (isWriteConflict) {
        if (attempt === maxRetries) {
          throw new Error(`Max retries reached: ${error.message}`);
        }
        console.warn(
          `WriteConflict detected, retrying in ${
            retryDelay * attempt
          }ms (attempt ${attempt}/${maxRetries})...`
        );
        await delay(retryDelay * attempt); // exponential backoff
      } else {
        throw error; // unrelated error, rethrow immediately
      }
    }
  }
};

// Handle MT5 broker deletion
const handleMT5Deletion = async (clientId, delBroker, APIName, XId, email) => {
  try {
    const logoutResult = await logoutMT5(
      { body: { login_id: clientId, email } },
      {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          return { statusCode: this.statusCode, ...data };
        },
      }
    );

    if (logoutResult.statusCode === 200) {
      const result = await removeMT5({
        body: { clientId, delBroker, APIName, XId, email },
      });
      return { success: true, message: result.message, clientId };
    }
    return {
      success: false,
      message: `Logout failed for MT5 broker ${clientId}`,
      clientId,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error during removeMT5 for ${clientId}: ${error.message}`,
      clientId,
    };
  }
};

// Handle AngelOne broker deletion
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
    return { success: true, message: result.message, clientId };
  } catch (error) {
    return {
      success: false,
      message: `Error during removeAngelOne for ${clientId}: ${error.message}`,
      clientId,
    };
  }
};

// Handle Motilal broker deletion
const handleMotilalDeletion = async (
  clientId,
  delBroker,
  APIName,
  XId,
  email
) => {
  try {
    await removeMotilal(clientId, delBroker, APIName, XId, email);
    return {
      success: true,
      message: `Motilal broker ${clientId} removed successfully`,
      clientId,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error during removeMotilal for ${clientId}: ${error.message}`,
      clientId,
    };
  }
};

// Handle Delta broker deletion
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
    return { success: true, message: result.message, clientId };
  } catch (error) {
    return {
      success: false,
      message: `Error during removeDelta for ${clientId}: ${error.message}`,
      clientId,
    };
  }
};

// Main function to handle expired subscriptions
const ExpiredSubscriptions = async () => {
  try {
    await withRetry(async () => {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const users = await User.find({}).session(session);
        const today = new Date();

        for (const user of users) {
          console.log("Processing user:", user.XalgoID);
          if (!user.ListOfBrokers || !Array.isArray(user.ListOfBrokers))
            continue;

          const subscriptions = await Subscription.find({
            XalgoID: user.XalgoID,
            CreatedAt: { $lte: today },
          }).session(session);

          // Calculate broker counts
          const brokerCounts = {
            IndianBroker: user.ListOfBrokers.filter(
              (b) => b.broker === "AngelOne" || b.broker === "Motilal"
            ).length,
            Delta: user.ListOfBrokers.filter(
              (b) =>
                b.broker === "Delta India" ||
                b.broker === "Delta Global" ||
                b.broker === "Delta Demo"
            ).length,
            MT5: user.ListOfBrokers.filter((b) => b.broker === "MT 5").length,
          };

          console.log("Broker counts:", brokerCounts);

          // Calculate subscription limits
          const subscriptionLimits = {
            IndianBroker: 0,
            Delta: 0,
            MT5: 0,
          };

          // Group subscriptions by Account type
          const subscriptionsByAccount = {
            IndianBroker: [],
            Delta: [],
            MT5: [],
          };

          for (const sub of subscriptions) {
            const createdAt = new Date(sub.CreatedAt);
            const duration = parseInt(sub.Duration) + 1;
            const expiryDate = new Date(createdAt);
            expiryDate.setDate(expiryDate.getDate() + duration);
            console.log(
              `Subscription: ${sub.Account}, CreatedAt: ${createdAt}, Duration: ${duration}, Expiry: ${expiryDate}`
            );

            if (today > expiryDate) {
              await Subscription.deleteOne({ _id: sub._id }, { session });
              console.log(
                `Deleted expired subscription for XalgoID: ${sub.XalgoID}, Account: ${sub.Account}`
              );
            } else {
              if (sub.Account === "Indian Broker") {
                subscriptionsByAccount.IndianBroker.push(sub);
              } else if (sub.Account === "Delta") {
                subscriptionsByAccount.Delta.push(sub);
              } else if (sub.Account === "MT5") {
                subscriptionsByAccount.MT5.push(sub);
              }
            }
          }

          // Process subscriptions to select the latest active one for each broker type
          const selectLatestSubscription = (subs) => {
            if (subs.length === 0) return null;
            return subs.reduce((latest, current) => {
              const latestDate = new Date(latest.CreatedAt);
              const currentDate = new Date(current.CreatedAt);
              return currentDate > latestDate ? current : latest;
            });
          };

          const latestIndianBrokerSub = selectLatestSubscription(
            subscriptionsByAccount.IndianBroker
          );
          const latestDeltaSub = selectLatestSubscription(
            subscriptionsByAccount.Delta
          );
          const latestMT5Sub = selectLatestSubscription(
            subscriptionsByAccount.MT5
          );

          // Update subscription limits based on the latest active subscription
          if (latestIndianBrokerSub) {
            subscriptionLimits.IndianBroker = latestIndianBrokerSub.NoOfAPI;
          }
          if (latestDeltaSub) {
            subscriptionLimits.Delta = latestDeltaSub.NoOfAPI;
          }
          if (latestMT5Sub) {
            subscriptionLimits.MT5 = latestMT5Sub.NoOfAPI;
          }

          console.log("Subscription limits:", subscriptionLimits);

          // Remove excess brokers and collect clientIds to remove
          const removeExcessBrokers = async (
            brokerType,
            maxAllowed,
            filterBrokers
          ) => {
            const brokers = user.ListOfBrokers.filter(filterBrokers);
            const excessCount = maxAllowed - brokers.length;

            if (excessCount < 0) {
              const brokersToRemove = brokers.slice(maxAllowed);
              console.log(
                `Removing ${brokersToRemove.length} excess ${brokerType} brokers for ${user.XalgoID}`
              );
              const clientIdsToRemove = [];

              for (const broker of brokersToRemove) {
                console.log(
                  `Removing broker: ${broker.broker} with clientId: ${broker.clientId}`
                );
                let result;
                switch (broker.broker) {
                  case "AngelOne":
                    result = await handleAngelOneDeletion(
                      broker.clientId,
                      broker.broker,
                      broker.apiName,
                      user.XalgoID,
                      user.Email
                    );
                    break;
                  case "Motilal":
                    result = await handleMotilalDeletion(
                      broker.clientId,
                      broker.broker,
                      broker.apiName,
                      user.XalgoID,
                      user.Email
                    );
                    break;
                  case "Delta India":
                  case "Delta Global":
                  case "Delta Demo":
                    result = await handleDeltaDeletion(
                      broker.clientId,
                      broker.broker,
                      broker.apiName,
                      user.XalgoID,
                      user.Email
                    );
                    break;
                  case "MT 5":
                    result = await handleMT5Deletion(
                      broker.clientId,
                      broker.broker,
                      broker.apiName,
                      user.XalgoID,
                      user.Email
                    );
                    break;
                  default:
                    console.log("Unknown broker:", broker.broker);
                    continue;
                }

                if (result.success) {
                  clientIdsToRemove.push(result.clientId);
                  console.log(`Broker ${result.clientId} queued for removal`);
                } else {
                  console.error(result.message);
                }

                // Rate-limit to avoid overwhelming external APIs
                await delay(1000);
              }

              // Update ListOfBrokers once after all deletions
              if (clientIdsToRemove.length > 0) {
                user.ListOfBrokers = user.ListOfBrokers.filter(
                  (b) => !clientIdsToRemove.includes(b.clientId)
                );
                await user.save({ session });
                console.log(
                  `Removed ${clientIdsToRemove.length} brokers from ListOfBrokers for ${user.XalgoID}`
                );
              }
            }
          };

          // Process broker types
          await removeExcessBrokers(
            "IndianBroker",
            subscriptionLimits.IndianBroker,
            (b) => b.broker === "AngelOne" || b.broker === "Motilal"
          );
          await removeExcessBrokers(
            "Delta",
            subscriptionLimits.Delta,
            (b) =>
              b.broker === "Delta India" ||
              b.broker === "Delta Global" ||
              b.broker === "Delta Demo"
          );
          await removeExcessBrokers(
            "MT5",
            subscriptionLimits.MT5,
            (b) => b.broker === "MT 5"
          );
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error; // Rethrow to trigger retry
      } finally {
        session.endSession();
      }
    });
  } catch (error) {
    console.error("Error in ExpiredSubscriptions:", error);
  }
};

module.exports = ExpiredSubscriptions;
