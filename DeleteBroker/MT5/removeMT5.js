const mongoose = require("mongoose");
const User = require("../../models/User.js");
const removeBroker = require("../removeBroker.js");

const removeMT5 = async (req, res) => {
  const session = await mongoose.startSession();
  console.log("MT 5 calliedddddddd");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      session.startTransaction();

      const { email, APIName, clientId, delBroker, XId } = req.body;

      if (!clientId || !XId || !email || !delBroker) {
        throw new Error("Missing required fields");
      }

      // Find the MT5 data for the clientId
      const user = await User.findOne(
        { XalgoID: XId },
        { MT5BrokerData: 1 }
      ).session(session);
      if (!user) throw new Error("User not found");

      const mt5Data = user.MT5BrokerData?.find(
        (broker) => broker.loginId === clientId
      );
      if (!mt5Data) throw new Error("MT5 credentials not found");

      // Remove from MT5BrokerData
      await User.updateOne(
        { XalgoID: XId },
        { $pull: { MT5BrokerData: { loginId: clientId } } },
        { session }
      );

      const existingUser = await User.findOne({
        XalgoID: XId,
        RemovedAPIs: {
          $elemMatch: {
            clientId: mt5Data.loginId,
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
                clientId: mt5Data.loginId,
                broker: "MT5",
                accountName: mt5Data.accountName,
                password: mt5Data.password,
                server: mt5Data.server,
                removedAt: new Date(),
              },
            },
          },
          { session }
        );
      }

      // External cleanup
      await removeBroker(clientId, XId, email, delBroker, session);

      await session.commitTransaction();
      return {
        success: true,
        message: "MT5 broker removed and archived successfully",
      };
    } catch (e) {
      await session.abortTransaction();

      if (e.codeName === "WriteConflict" && attempt < 2) {
        console.warn("Write conflict, retrying... attempt", attempt + 1);
        continue;
      }

      console.error("Error removing MT5 broker:", e);
      throw e;
    } finally {
      session.endSession();
    }
  }
};

module.exports = removeMT5;
