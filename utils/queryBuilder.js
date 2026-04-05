/**
 * Query builder helper for constructing MongoDB filter queries
 */

/**
 * Build a filter query from request parameters
 * @param {Object} options
 * @param {Object} options.req - Express request object
 * @param {Array<string>} options.searchFields - Fields to search in (default: ['title', 'name'])
 * @param {Array<string>} options.exactFields - Fields that require exact match (default: ['category', 'status'])
 * @param {boolean} options.includeActive - Whether to filter by isActive (default: true)
 * @param {Object} options.defaults - Default filter values
 * @returns {Object} MongoDB filter query
 */
const buildFilter = ({ req, searchFields = ['title', 'name'], exactFields = ['category', 'status', 'difficulty'], includeActive = true, defaults = {} }) => {
  const query = { ...defaults };
  
  // Add isActive filter if needed
  if (includeActive && req.query.includeInactive !== 'true') {
    query.isActive = true;
  }
  
  // Handle search across multiple fields
  const search = req.query.search?.trim();
  if (search && searchFields.length > 0) {
    const searchRegex = new RegExp(search, 'i');
    if (searchFields.length === 1) {
      query[searchFields[0]] = searchRegex;
    } else {
      query.$or = searchFields.map(field => ({ [field]: searchRegex }));
    }
  }
  
  // Handle exact match fields
  exactFields.forEach(field => {
    const value = req.query[field];
    if (value && value !== 'All' && value !== 'all') {
      query[field] = value;
    }
  });
  
  return query;
};

/**
 * Build sort object from request
 * @param {Object} req - Express request object
 * @param {string} defaultField - Default sort field
 * @param {number} defaultOrder - Default sort order (1 or -1)
 * @returns {Object} MongoDB sort object
 */
const buildSort = (req, defaultField = 'createdAt', defaultOrder = -1) => {
  const sortField = req.query.sortBy || defaultField;
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : (req.query.sortOrder === 'desc' ? -1 : defaultOrder);
  return { [sortField]: sortOrder };
};

module.exports = {
  buildFilter,
  buildSort
};
