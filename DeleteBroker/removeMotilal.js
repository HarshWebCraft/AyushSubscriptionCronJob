const mongoose = require("mongoose");
const User = require("../models/User");
const Mocredentials = require("../models/moCredentials");
const removeBroker = require("./removeBroker");

const removeMotilal = async (clientId, delBroker, APIName, XId, email) => {
  const session = await mongoose.startSession();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      session.startTransaction();

      if (!clientId || !delBroker || !XId || !email) {
        throw new Error("Missing required fields");
      }

      // Check User.MotilalBrokerData first
      const user = await User.findOne(
        { XalgoID: XId },
        { MotilalBrokerData: 1 }
      ).session(session);
      if (!user) {
        throw new Error("User not found");
      }

      const moData = user.MotilalBrokerData?.find(
        (broker) => broker.clientId === clientId
      );
      if (!moData) {
        throw new Error("Motilal credentials not found for given clientId");
      }

      // Remove from User.MotilalBrokerData
      await User.updateOne(
        { XalgoID: XId },
        { $pull: { MotilalBrokerData: { clientId } } },
        { session }
      );
      console.log(moData.apiKey);
      // Archive in RemovedBrokers
      const existingMotilalUser = await User.findOne({
        XalgoID: XId,
        RemovedAPIs: {
          $elemMatch: {
            clientId: moData.clientId,
            apiName: APIName,
          },
        },
      });

      if (!existingMotilalUser) {
        await User.updateOne(
          { XalgoID: XId },
          {
            $push: {
              RemovedAPIs: {
                apiName: APIName,
                clientId: moData.clientId,
                broker: "Motilal",
                accountName: moData.accountName,
                apikey: moData.apiKey,
                password: moData.password,
                totp: moData.totp,
                dob: moData.dob,
                authcode: moData.authcode,
                removedAt: new Date(),
              },
            },
          },
          { session }
        );
      }

      // Attempt to delete from Mocredentials (optional, if it exists)
      await Mocredentials.deleteOne({ client_id: clientId }, { session });

      // Run external cleanup
      await removeBroker(clientId, XId, email, delBroker, session);

      await session.commitTransaction();
      console.log(`Motilal broker ${clientId} removed successfully`);
      return; // Exit after success
    } catch (error) {
      await session.abortTransaction();
      if (error.codeName === "WriteConflict" && attempt < 2) {
        console.warn("Write conflict, retrying... attempt", attempt + 1);
        continue;
      }
      console.error("Error removing Motilal broker:", error);
      throw error; // Rethrow to be caught by caller
    } finally {
      session.endSession();
    }
  }
};

module.exports = removeMotilal;
