// const updateAllAngelCredentials = require("../Cronjob/aoAuthUpdate");
// const updateMotilalTokens = require("../Cronjob/moAuthUpdate");

const updateAllCredentials = async () => {
  try {
    // await updateMotilalTokens();
    // await updateAllAngelCredentials();
  } catch (e) {
    console.log(e);
  }
};
module.exports = updateAllCredentials;
