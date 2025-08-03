const mongoose = require("mongoose");
const User = require("../models/User");
const aoCredentials = require("../models/aoCredentials");
const removeBroker = require("./removeBroker");

const removeAngelOne = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { clientId, delBroker, APIName, XId, email } = req.body;

    if (!clientId || !delBroker || !XId || !email) {
      throw new Error("Missing required fields");
    }

    // Check User.AngelBrokerData first
    const user = await User.findOne(
      { XalgoID: XId },
      { AngelBrokerData: 1 }
    ).session(session);
    if (!user) {
      throw new Error("User not found");
    }

    const aoData = user.AngelBrokerData?.find(
      (broker) => broker.AngelId === clientId
    );
    if (!aoData) {
      throw new Error("Angel One credentials not found for given clientId");
    }

    // Remove from User.AngelBrokerData
    await User.updateOne(
      { XalgoID: XId },
      { $pull: { AngelBrokerData: { AngelId: clientId } } },
      { session }
    );

    // Push to RemovedBrokers
    const existingUser = await User.findOne({
      XalgoID: XId,
      RemovedAPIs: {
        $elemMatch: {
          clientId: aoData.AngelId,
          apiName: APIName,
        },
      },
    });

    if (!existingUser) {
      await User.updateOne(
        { XalgoID: XId },
        {
          $push: {
            RemovedAPIs: {
              apiName: APIName,
              clientId: aoData.AngelId,
              broker: "AngelOne",
              AngelPass: aoData.AngelPass,
              SecretKey: aoData.SecretKey,
              AngelApiKey: aoData.ApiKey,
              removedAt: new Date(),
            },
          },
        },
        { session }
      );
    }

    // Delete AO credentials (optional, if it exists)
    await aoCredentials.deleteOne({ client_id: clientId }, { session });

    // Call external cleanup
    await removeBroker(clientId, XId, email, delBroker, session);

    await session.commitTransaction();

    return {
      success: true,
      message: "Angel One broker removed and archived successfully",
      removedBrokerId: delBroker,
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error removing AngelOne broker:", error);
    throw error; // Rethrow to be caught by caller
  } finally {
    session.endSession();
  }
};

module.exports = removeAngelOne;
