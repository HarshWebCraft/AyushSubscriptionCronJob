const logoutMT5 = require("../DeleteBroker/MT5/logoutMT.js");
const removeMT5 = require("../DeleteBroker/MT5/removeMT5.js");
const removeDelta = require("../DeleteBroker/removeDelta.js");
const removeMotilal = require("../DeleteBroker/removeMotilal.js");
const removeAngelOne = require("../DeleteBroker/removeAngelOne.js");
const Subscription = require("../models/Subscription.js");
const User = require("../models/users.js");
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
        const users = await User.find({ XalgoID: "AYUS014" }).session(session);
        const today = new Date();

        for (const user of users) {
          console.log("Processing user:", user.XalgoID);
          if (!user.ListOfBrokers || !Array.isArray(user.ListOfBrokers)) {
            console.log(
              `No valid ListOfBrokers for ${user.XalgoID}, skipping.`
            );
            continue;
          }

          const subscriptions = await Subscription.find({
            XalgoID: user.XalgoID,
            CreatedAt: { $lte: today },
          }).session(session);

          // Group subscriptions by Account type
          const subscriptionsByAccount = {
            IndianBroker: [],
            Delta: [],
            MT5: [],
          };

          // Categorize subscriptions
          for (const sub of subscriptions) {
            if (sub.Account === "Indian Broker") {
              subscriptionsByAccount.IndianBroker.push(sub);
            } else if (sub.Account === "Delta") {
              subscriptionsByAccount.Delta.push(sub);
            } else if (sub.Account === "MT5") {
              subscriptionsByAccount.MT5.push(sub);
            }
          }

          // Helper function to select the latest subscription
          const selectLatestSubscription = (subs) => {
            if (subs.length === 0) return null;
            return subs.reduce((latest, current) => {
              const latestDate = new Date(latest.CreatedAt);
              const currentDate = new Date(current.CreatedAt);
              return currentDate > latestDate ? current : latest;
            });
          };

          // Process each broker type
          const processBrokerType = async (
            brokerType,
            filterBrokers,
            subscriptions
          ) => {
            const brokers = user.ListOfBrokers.filter(filterBrokers);
            console.log(`Processing ${brokerType}, brokers: ${brokers.length}`);

            // Find active and expired subscriptions
            const activeSubs = [];
            const expiredSubs = [];
            for (const sub of subscriptions) {
              const createdAt = new Date(sub.CreatedAt);
              const duration = parseInt(sub.Duration);
              const expiryDate = new Date(createdAt);
              expiryDate.setDate(expiryDate.getDate() + duration);

              if (today <= expiryDate) {
                activeSubs.push(sub);
              } else {
                expiredSubs.push({ ...sub, expiryDate });
              }
            }

            // Condition 2: Active subscription exists, do nothing
            if (activeSubs.length > 0) {
              console.log(
                `Active subscription found for ${brokerType}, skipping.`
              );
              return;
            }

            // Get the latest subscription (active or expired)
            const latestSub = selectLatestSubscription(subscriptions);

            // Condition 1: No subscriptions (active or expired), remove all brokers
            if (!latestSub) {
              console.log(
                `No subscriptions for ${brokerType}, removing all brokers.`
              );
              await removeBrokers(brokerType, brokers, user, session);
              return;
            }

            // Process expired subscriptions
            for (const sub of expiredSubs) {
              let finalExpiryDate = sub.expiryDate;

              // Condition 3: No renewed subscription, apply 1-day grace
              if (subscriptions.length === 1) {
                finalExpiryDate.setDate(finalExpiryDate.getDate() + 1);
                console.log(
                  `Grace day applied for ${brokerType}, subscription: ${sub._id}`
                );
              }

              // If still expired after grace (or no grace due to renewed subscription)
              if (today > finalExpiryDate) {
                await Subscription.deleteOne({ _id: sub._id }, { session });
                console.log(
                  `Deleted expired subscription for ${brokerType}, ID: ${sub._id}`
                );
              }
            }

            // Condition 4: Consider the latest subscription (active or expired with grace)
            const latestValidSub = selectLatestSubscription(
              subscriptions.filter((sub) => {
                const createdAt = new Date(sub.CreatedAt);
                const duration = parseInt(sub.Duration);
                const expiryDate = new Date(createdAt);
                expiryDate.setDate(expiryDate.getDate() + duration);
                if (subscriptions.length === 1 && today > expiryDate) {
                  expiryDate.setDate(expiryDate.getDate() + 1); // Apply grace for single sub
                }
                return today <= expiryDate;
              })
            );

            // If no valid subscription after grace, remove all brokers
            if (!latestValidSub) {
              console.log(
                `No valid subscription for ${brokerType}, removing all brokers.`
              );
              await removeBrokers(brokerType, brokers, user, session);
              return;
            }

            // Enforce subscription limit based on latest valid subscription
            const maxAllowed = latestValidSub.NoOfAPI || 0;
            const excessCount = brokers.length - maxAllowed;

            if (excessCount > 0) {
              console.log(
                `Removing ${excessCount} excess ${brokerType} brokers.`
              );
              const brokersToRemove = brokers.slice(maxAllowed);
              await removeBrokers(brokerType, brokersToRemove, user, session);
            }
          };

          // Helper function to remove brokers
          const removeBrokers = async (
            brokerType,
            brokersToRemove,
            user,
            session
          ) => {
            const clientIdsToRemove = [];

            for (const broker of brokersToRemove) {
              console.log(
                `Removing broker: ${broker.broker}, clientId: ${broker.clientId}`
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
                  console.log(`Unknown broker: ${broker.broker}`);
                  continue;
              }

              if (result.success) {
                clientIdsToRemove.push(result.clientId);
                console.log(`Broker ${result.clientId} queued for removal`);
              } else {
                console.error(
                  `Failed to remove broker ${broker.clientId}: ${result.message}`
                );
              }

              await delay(1000); // Rate limiting
            }

            if (clientIdsToRemove.length > 0) {
              user.ListOfBrokers = user.ListOfBrokers.filter(
                (b) => !clientIdsToRemove.includes(b.clientId)
              );
              await user.save({ session });
              console.log(
                `Removed ${clientIdsToRemove.length} brokers for ${brokerType}`
              );
            }
          };

          // Process each broker type
          await processBrokerType(
            "IndianBroker",
            (b) => b.broker === "AngelOne" || b.broker === "Motilal",
            subscriptionsByAccount.IndianBroker
          );
          await processBrokerType(
            "Delta",
            (b) =>
              b.broker === "Delta India" ||
              b.broker === "Delta Global" ||
              b.broker === "Delta Demo",
            subscriptionsByAccount.Delta
          );
          await processBrokerType(
            "MT5",
            (b) => b.broker === "MT 5",
            subscriptionsByAccount.MT5
          );
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    });
  } catch (error) {
    console.error("Error in ExpiredSubscriptions:", error);
  }
};

module.exports = ExpiredSubscriptions;
