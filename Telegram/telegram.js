const express = require("express");
const Router = express.Router();

Router.get("/api/regenerate/:userId", require("./regenrate"));
Router.post("/webhook/telegram/:userId", require("./webhookTelegram"));
Router.post(
  "/webhook/tradingview/:userId/:secretKey",
  require("./webhookTradingview")
);
Router.get("/api/dashboard/:userId", require("./apiDashboard"));
Router.post("/api/setup", require("./setup"));
Router.get("/api", require("./api"));

module.exports = Router;
