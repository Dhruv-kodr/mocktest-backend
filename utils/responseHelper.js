/**
 * Standard response helpers for consistent API responses
 */

/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {Object} data - Data to send
 * @param {number} status - HTTP status code (default: 200)
 */
const success = (res, data = {}, status = 200) => {
  res.status(status).json({ success: true, ...data });
};

/**
 * Send a created response
 * @param {Object} res - Express response object
 * @param {Object} data - Data to send
 * @param {string} message - Success message
 */
const created = (res, data = {}, message = 'Created successfully') => {
  res.status(201).json({ success: true, message, ...data });
};

/**
 * Send a paginated list response
 * @param {Object} res - Express response object
 * @param {Object} paginationResult - Result from paginate()
 * @param {string} itemsKey - Key name for items array (default: 'items')
 */
const paginatedList = (res, paginationResult, itemsKey = 'items') => {
  const { items, total, page, pages, limit } = paginationResult;
  res.json({
    success: true,
    [itemsKey]: items,
    total,
    page,
    pages,
    limit
  });
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 */
const error = (res, message, status = 400) => {
  res.status(status).json({ success: false, message });
};

/**
 * Send a not found response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name
 */
const notFound = (res, resource = 'Resource') => {
  res.status(404).json({ success: false, message: `${resource} not found` });
};

/**
 * Send a forbidden response (ownership/permission)
 * @param {Object} res - Express response object
 * @param {string} message - Custom message
 */
const forbidden = (res, message = 'You do not have permission to perform this action') => {
  res.status(403).json({ success: false, message });
};

/**
 * Send a server error response
 * @param {Object} res - Express response object
 * @param {Error} err - Error object
 */
const serverError = (res, err) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
};

module.exports = {
  success,
  created,
  paginatedList,
  error,
  notFound,
  forbidden,
  serverError
};
