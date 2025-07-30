const { v4: uuidv4 } = require("uuid");

const regenerate = async (req, res) => {
  function flashMessage(req, message, type = "success") {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({
      message: `${message}\n\nPowered by Xalgos.in`,
      type,
    });
  }
  try {
    const userId = parseInt(req.params.userId);
    const userData = await req.db
      .collection("tradingviewbots")
      .findOne({ id: userId });

    if (!userData) {
      flashMessage(req, "User not found", "error");
      return res.status(404).json({
        error: "User not found",
      });
    }

    const newSecretKey = uuidv4();
    await req.db
      .collection("tradingviewbots")
      .updateOne({ id: userId }, { $set: { secretKey: newSecretKey } });

    flashMessage(req, "Secret key regenerated successfully!", "success");
    res.json({ status: "success", newSecretKey });
  } catch (error) {
    console.error("Error in regenerate:", error.message, error.stack);
    flashMessage(
      req,
      "An error occurred while regenerating secret key",
      "error"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

module.exports = regenerate;
