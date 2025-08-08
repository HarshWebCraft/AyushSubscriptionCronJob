// const logoutMT5 = require("../DeleteBroker/MT5/logoutMT.js");
// const removeMT5 = require("../DeleteBroker/MT5/removeMT5.js");
// const removeDelta = require("../DeleteBroker/removeDelta.js");
// const removeMotilal = require("../DeleteBroker/removeMotilal.js");
// const removeAngelOne = require("../DeleteBroker/removeAngelOne.js");
// const Subscription = require("../models/Subscription.js");
// const User = require("../models/User.js");

// const handleMT5Deletion = async (clientId, delBroker, APIName, XId, email) => {
//   try {
//     const result = await removeMT5({
//       body: { clientId, delBroker, APIName, XId, email },
//     });
//     console.log(`MT5 broker ${clientId} removal result:`, result.message);
//   } catch (error) {
//     console.error(`Error during removeMT5 for ${clientId}:`, error.message);
//   }
// };

// const handleAngelOneDeletion = async (
//   clientId,
//   delBroker,
//   APIName,
//   XId,
//   email
// ) => {
//   try {
//     const result = await removeAngelOne({
//       body: { clientId, delBroker, APIName, XId, email },
//     });
//     console.log(`AngelOne broker ${clientId} removal result:`, result.message);
//   } catch (error) {
//     console.error(
//       `Error during removeAngelOne for ${clientId}:`,
//       error.message
//     );
//   }
// };

// const handleMotilalDeletion = async (
//   clientId,
//   delBroker,
//   APIName,
//   XId,
//   email
// ) => {
//   try {
//     await removeMotilal(clientId, delBroker, APIName, XId, email);
//     console.log(`Motilal broker ${clientId} removed successfully`);
//   } catch (error) {
//     console.error(`Error during removeMotilal for ${clientId}:`, error.message);
//   }
// };

// const handleDeltaDeletion = async (
//   clientId,
//   delBroker,
//   APIName,
//   XId,
//   email
// ) => {
//   try {
//     const result = await removeDelta({
//       body: { clientId, delBroker, APIName, XId, email },
//     });
//     console.log(`Delta broker ${clientId} removal result:`, result.message);
//   } catch (error) {
//     console.error(`Error during removeDelta for ${clientId}:`, error.message);
//   }
// };

// const ExpiredSubscriptions = async () => {
//   try {
//     const data = await Subscription.find({});
//     const today = new Date();

//     for (const element of data) {
//       const createdAt = new Date(element.CreatedAt);
//       const duration = parseInt(element.Duration);
//       const expiryDate = new Date(createdAt);
//       expiryDate.setDate(expiryDate.getDate() + duration);

//       const remainingDays = Math.max(
//         0,
//         Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
//       );

//       if (remainingDays <= 0) {
//         // Check for other active subscriptions for the same XalgoID and Account
//         const activeSubscriptions = await Subscription.find({
//           XalgoID: element.XalgoID,
//           Account: element.Account,
//           _id: { $ne: element._id }, // Exclude the current subscription
//         });

//         // Check if there are any non-expired subscriptions
//         const hasActiveSubscription = activeSubscriptions.some((sub) => {
//           const subCreatedAt = new Date(sub.CreatedAt);
//           const subDuration = parseInt(sub.Duration);
//           const subExpiryDate = new Date(subCreatedAt);
//           subExpiryDate.setDate(subExpiryDate.getDate() + subDuration);
//           return today <= subExpiryDate;
//         });

//         // Skip deletion if there is an active subscription for the same broker
//         if (hasActiveSubscription) {
//           console.log(
//             `Skipping deletion for XalgoID: ${element.XalgoID}, Account: ${element.Account} due to active subscription.`
//           );
//           continue;
//         }

//         // Delete the expired subscription
//         await Subscription.deleteOne({ _id: element._id });
//         console.log(
//           `Deleted expired subscription for XalgoID: ${element.XalgoID}, Account: ${element.Account}, ID: ${element._id}`
//         );

//         // Proceed with broker deletion
//         const userData = await User.findOne({ XalgoID: element.XalgoID });

//         if (userData && Array.isArray(userData.ListOfBrokers)) {
//           let filterBroker;

//           if (element.Account === "Indian Broker") {
//             filterBroker = userData.ListOfBrokers.filter(
//               (broker) =>
//                 broker.broker === "AngelOne" || broker.broker === "Motilal"
//             );
//           } else {
//             filterBroker = userData.ListOfBrokers.filter(
//               (broker) => broker.broker === element.Account
//             );
//           }

//           for (const broker of filterBroker) {
//             console.log(
//               `Processing deletion for clientId: ${broker.clientId}, broker: ${broker.broker}`
//             );
//             switch (broker.broker) {
//               case "MT 5":
//                 await handleMT5Deletion(
//                   broker.clientId,
//                   broker.broker,
//                   broker.apiName,
//                   userData.XalgoID,
//                   userData.Email
//                 );
//                 break;
//               case "AngelOne":
//                 await handleAngelOneDeletion(
//                   broker.clientId,
//                   broker.broker,
//                   broker.apiName,
//                   userData.XalgoID,
//                   userData.Email
//                 );
//                 break;
//               case "Motilal":
//                 await handleMotilalDeletion(
//                   broker.clientId,
//                   broker.broker,
//                   broker.apiName,
//                   userData.XalgoID,
//                   userData.Email
//                 );
//                 break;
//               case "Delta":
//                 await handleDeltaDeletion(
//                   broker.clientId,
//                   broker.broker,
//                   broker.apiName,
//                   userData.XalgoID,
//                   userData.Email
//                 );
//                 break;
//               default:
//                 console.log("Unknown broker:", broker.broker);
//             }
//           }
//         }
//       }
//     }
//   } catch (error) {
//     console.error("Error in ExpiredSubscriptions:", error);
//   }
// };

// module.exports = ExpiredSubscriptions;

// const logoutMT5 = require("../DeleteBroker/MT5/logoutMT.js");
// const removeMT5 = require("../DeleteBroker/MT5/removeMT5.js");
// const removeDelta = require("../DeleteBroker/removeDelta.js");
// const removeMotilal = require("../DeleteBroker/removeMotilal.js");
// const removeAngelOne = require("../DeleteBroker/removeAngelOne.js");
// const Subscription = require("../models/Subscription.js");
// const User = require("../models/User.js");

// const handleMT5Deletion = async (clientId, delBroker, APIName, XId, email) => {
//   try {
//     const result = await removeMT5({
//       body: { clientId, delBroker, APIName, XId, email },
//     });
//     console.log(`MT5 broker ${clientId} removal result:`, result.message);
//   } catch (error) {
//     console.error(`Error during removeMT5 for ${clientId}:`, error.message);
//   }
// };

// const handleAngelOneDeletion = async (
//   clientId,
//   delBroker,
//   APIName,
//   XId,
//   email
// ) => {
//   try {
//     const result = await removeAngelOne({
//       body: { clientId, delBroker, APIName, XId, email },
//     });
//     console.log(`AngelOne broker ${clientId} removal result:`, result.message);
//   } catch (error) {
//     console.error(
//       `Error during removeAngelOne for ${clientId}:`,
//       error.message
//     );
//   }
// };

// const handleMotilalDeletion = async (
//   clientId,
//   delBroker,
//   APIName,
//   XId,
//   email
// ) => {
//   try {
//     await removeMotilal(clientId, delBroker, APIName, XId, email);
//     console.log(`Motilal broker ${clientId} removed successfully`);
//   } catch (error) {
//     console.error(`Error during removeMotilal for ${clientId}:`, error.message);
//   }
// };

// const handleDeltaDeletion = async (
//   clientId,
//   delBroker,
//   APIName,
//   XId,
//   email
// ) => {
//   try {
//     const result = await removeDelta({
//       body: { clientId, delBroker, APIName, XId, email },
//     });
//     console.log(`Delta broker ${clientId} removal result:`, result.message);
//   } catch (error) {
//     console.error(`Error during removeDelta for ${clientId}:`, error.message);
//   }
// };

const ExpiredSubscriptions = async () => {
  try {
    // const users = await User.find({ XalgoID: "FAOZ135" });
    // const today = new Date();
    // for (const user of users) {
    //   const subscriptions = await Subscription.find({ XalgoID: user.XalgoID });
    //   // if (!user.ListOfBrokers || !Array.isArray(user.ListOfBrokers)) continue;
    //   // // Count brokers by type
    //   // const brokerCounts = {
    //   //   IndianBroker: user.ListOfBrokers.filter(
    //   //     (b) => b.broker === "AngelOne" || b.broker === "Motilal"
    //   //   ).length,
    //   //   Delta: user.ListOfBrokers.filter(
    //   //     (b) =>
    //   //       b.broker === "Delta India" ||
    //   //       b.broker === "Delta Global" ||
    //   //       b.broker === "Delta Demo"
    //   //   ).length,
    //   //   MT5: user.ListOfBrokers.filter((b) => b.broker === "MT5").length,
    //   // };
    //   // // Get subscription limits
    //   // const subscriptionLimits = {
    //   //   IndianBroker: 0,
    //   //   Delta: 0,
    //   //   MT5: 0,
    //   // };
    //   // for (const sub of subscriptions) {
    //   //   const createdAt = new Date(sub.CreatedAt);
    //   //   const duration = parseInt(sub.Duration);
    //   //   const expiryDate = new Date(createdAt);
    //   //   expiryDate.setDate(expiryDate.getDate() + duration);
    //   //   if (today <= expiryDate) {
    //   //     if (sub.Account === "Indian Broker") {
    //   //       subscriptionLimits.IndianBroker += sub.NoOfAPI;
    //   //     } else if (
    //   //       sub.Account === "Delta India" ||
    //   //       sub.Account === "Delta Global" ||
    //   //       sub.Account === "Delta Demo"
    //   //     ) {
    //   //       subscriptionLimits.Delta += sub.NoOfAPI;
    //   //     } else if (sub.Account === "MT5") {
    //   //       // console.log(subscriptionLimits.MT5);
    //   //       subscriptionLimits.MT5 += sub.NoOfAPI;
    //   //     }
    //   //     // console.log(subscriptionLimits);
    //   //   } else {
    //   //     await Subscription.deleteOne({ _id: sub._id });
    //   //     console.log(
    //   //       `Deleted expired subscription for XalgoID: ${sub.XalgoID}, Account: ${sub.Account}, ID: ${sub._id}`
    //   //     );
    //   //   }
    //   // }
    //   // // Remove excess brokers
    //   // const removeExcessBrokers = async (
    //   //   brokerType,
    //   //   maxAllowed,
    //   //   filterBrokers
    //   // ) => {
    //   //   console.log(user.ListOfBrokers);
    //   //   const brokers = user.ListOfBrokers.filter((b) => b.broker == "MT 5");
    //   //   console.log("brokers", brokers);
    //   //   const excessCount = brokers.length - maxAllowed;
    //   //   console.log("brokers.length", brokers.length);
    //   //   if (excessCount > 0) {
    //   //     const brokersToRemove = brokers.slice(-excessCount); // Remove newest brokers first
    //   //     for (const broker of brokersToRemove) {
    //   //       console.log(
    //   //         `Removing excess broker: ${broker.broker} with clientId: ${broker.clientId}`
    //   //       );
    //   //       console.log(broker.broker);
    //   //       switch (broker.broker) {
    //   //         case "AngelOne":
    //   //           await handleAngelOneDeletion(
    //   //             broker.clientId,
    //   //             broker.broker,
    //   //             broker.apiName,
    //   //             user.XalgoID,
    //   //             user.Email
    //   //           );
    //   //           break;
    //   //         case "Motilal":
    //   //           await handleMotilalDeletion(
    //   //             broker.clientId,
    //   //             broker.broker,
    //   //             broker.apiName,
    //   //             user.XalgoID,
    //   //             user.Email
    //   //           );
    //   //           break;
    //   //         case "Delta India":
    //   //         case "Delta Global":
    //   //         case "Delta Demo":
    //   //           await handleDeltaDeletion(
    //   //             broker.clientId,
    //   //             broker.broker,
    //   //             broker.apiName,
    //   //             user.XalgoID,
    //   //             user.Email
    //   //           );
    //   //           break;
    //   //         case "MT 5":
    //   //           console.log("mt5 delete");
    //   //           // await handleMT5Deletion(
    //   //           //   broker.clientId,
    //   //           //   broker.broker,
    //   //           //   broker.apiName,
    //   //           //   user.XalgoID,
    //   //           //   user.Email
    //   //           // );
    //   //           break;
    //   //         default:
    //   //           console.log("Unknown broker:", broker.broker);
    //   //       }
    //   //     }
    //   //   }
    //   // };
    //   // console.log("subscriptionLimits :", subscriptionLimits);
    //   // // Apply removal logic
    //   // console.log((b) => b.broker === "AngelOne" || b.broker === "Motilal");
    //   // const broker1 = await removeExcessBrokers(
    //   //   "IndianBroker",
    //   //   subscriptionLimits.IndianBroker,
    //   //   (b) => b.broker === "AngelOne" || b.broker === "Motilal"
    //   // );
    //   // await removeExcessBrokers(
    //   //   "Delta",
    //   //   subscriptionLimits.Delta,
    //   //   (b) =>
    //   //     b.broker === "Delta India" ||
    //   //     b.broker === "Delta Global" ||
    //   //     b.broker === "Delta Demo"
    //   // );
    //   // await removeExcessBrokers(
    //   //   "MT5",
    //   //   subscriptionLimits.MT5,
    //   //   (b) => b.broker === "MT5"
    //   // );
    // }
  } catch (error) {
    console.error("Error in ExpiredSubscriptions:", error);
  }
};

module.exports = ExpiredSubscriptions;
