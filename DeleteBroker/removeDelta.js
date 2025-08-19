const mongoose = require("mongoose");
const User = require("../models/users");
const delCredentials = require("../models/delCredential");
const removeBroker = require("./removeBroker");

const removeDelta = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { clientId, delBroker, APIName, XId, email } = req.body;

    if (!clientId || !delBroker || !XId || !email) {
      throw new Error("Missing required fields");
    }

    // Fetch delta credentials
    const deltaData = await delCredentials
      .findOne({ client_id: clientId })
      .session(session);
    if (!deltaData) {
      throw new Error("Delta broker credentials not found");
    }

    // Remove from DeltaBrokerSchema
    await User.updateOne(
      { XalgoID: XId },
      { $pull: { DeltaBrokerSchema: { deltaBrokerId: clientId } } },
      { session }
    );

    // Archive in RemovedBrokers
    const existingDeltaUser = await User.findOne({
      XalgoID: XId,
      RemovedAPIs: {
        $elemMatch: {
          clientId: deltaData.client_id,
          apiName: APIName,
        },
      },
    });

    if (!existingDeltaUser) {
      await User.updateOne(
        { XalgoID: XId },
        {
          $push: {
            RemovedAPIs: {
              apiName: APIName,
              clientId: deltaData.client_id,
              broker: delBroker,
              SecretKey: deltaData.apiSecret,
              apikey: deltaData.apiKey,
              removedAt: new Date(),
            },
          },
        },
        { session }
      );
    }

    // Delete delta credentials
    await delCredentials.deleteOne({ client_id: clientId }, { session });

    // Run external cleanup
    await removeBroker(clientId, XId, email, delBroker, session);

    await session.commitTransaction();

    return {
      success: true,
      message: "Delta broker removed and archived successfully",
      removedBrokerId: delBroker,
    };
  } catch (error) {
    await session.abortTransaction();
    console.error("Error removing Delta broker:", error);
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = removeDelta;
