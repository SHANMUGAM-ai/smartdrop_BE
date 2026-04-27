const { isDatabaseConnected } = require('../config/db');

exports.requireDatabase = (req, res, next) => {
  if (isDatabaseConnected()) return next();

  return res.status(503).json({
    success: false,
    message: 'Database unavailable. Start the MongoDB service, then retry.',
  });
};
