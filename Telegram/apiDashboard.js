const apiDashboard = async (req, res) => {
  function flashMessage(req, message, type = "success") {
    if (!req.session.flash) req.session.flash = [];
    req.session.flash.push({
      message: `${message}\n\nPowered by Xalgos.in`,
      type,
    });
  }
  function getFlashMessages(req) {
    const messages = req.session.flash || [];
    req.session.flash = [];
    return messages;
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

    const userAlerts = await req.db
      .collection("tradingviewbotsAlert")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    const protocol = req.get("X-Forwarded-Proto") || req.protocol;
    const host = req.get("Host");
    const webhookUrl = `${protocol}://${host}/webhook/tradingview/${userId}/${userData.secretKey}`;

    res.json({
      flashMessages: getFlashMessages(req),
      userData,
      recentAlerts: userAlerts,
      webhookUrl,
    });
  } catch (error) {
    console.error("Error in dashboard:", error.message, error.stack);
    flashMessage(
      req,
      "An error occurred while fetching dashboard data",
      "error"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

module.exports = apiDashboard;
