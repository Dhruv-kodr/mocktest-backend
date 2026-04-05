/**
 * Pagination helper for standardized list queries
 */

/**
 * Apply pagination to a Mongoose query
 * @param {Object} options
 * @param {Object} options.query - Mongoose query object
 * @param {Object} options.req - Express request object
 * @param {number} options.defaultLimit - Default items per page (default: 20)
 * @param {string} options.sortField - Field to sort by (default: 'createdAt')
 * @param {number} options.sortOrder - Sort order: 1 for asc, -1 for desc (default: -1)
 * @returns {Promise<{items: Array, total: number, page: number, pages: number, limit: number}>}
 */
const paginate = async ({ model, filter = {}, req, defaultLimit = 20, sortField = 'createdAt', sortOrder = -1, populate = null, select = null }) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || defaultLimit, 100); // Cap at 100
  
  const [total, items] = await Promise.all([
    model.countDocuments(filter),
    (() => {
      let query = model.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit);
      
      if (populate) {
        if (Array.isArray(populate)) {
          populate.forEach(p => { query = query.populate(p); });
        } else {
          query = query.populate(populate);
        }
      }
      
      if (select) {
        query = query.select(select);
      }
      
      return query.exec();
    })()
  ]);

  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit
  };
};

/**
 * Extract pagination params from request
 * @param {Object} req - Express request object
 * @param {number} defaultLimit - Default limit
 * @returns {{page: number, limit: number, skip: number}}
 */
const getPaginationParams = (req, defaultLimit = 20) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || defaultLimit, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  paginate,
  getPaginationParams
};
