// helpers.js
// Wraps an async Express handler so thrown errors (including DB_UNAVAILABLE
// from db.js) are forwarded to the central error handler in server.js
// instead of crashing the process or leaving a hung request.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
