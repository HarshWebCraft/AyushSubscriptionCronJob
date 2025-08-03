const updateAllAngelCredentials = require("../Cronjob/aoAuthUpdate");
const updateMotilalTokens = require("../Cronjob/moAuthUpdate");
const subcription = require('../Cronjob/subcription')

const updateAllCredentials = async () => {
  try {
    await updateMotilalTokens();
    await updateAllAngelCredentials();
    await subcription()
  } catch (e) {
    console.log(e);
  }
};
module.exports = updateAllCredentials;
