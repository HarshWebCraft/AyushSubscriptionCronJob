const api = (req, res) => {
  function getFlashMessages(req) {
    const messages = req.session.flash || [];
    req.session.flash = [];
    return messages;
  }
  res.json({ flashMessages: getFlashMessages(req) });
};

module.exports = api;
