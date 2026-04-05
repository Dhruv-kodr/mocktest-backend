/**
 * Validate MongoDB ObjectId middleware
 */

const mongoose = require('mongoose');

const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  
  if (!id) {
    return res.status(400).json({ 
      success: false, 
      message: `${paramName} parameter is required` 
    });
  }
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid ${paramName} format` 
    });
  }
  
  next();
};

// Validate multiple ObjectIds
const validateObjectIds = (...paramNames) => (req, res, next) => {
  for (const paramName of paramNames) {
    const id = req.params[paramName] || req.body[paramName];
    
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid ${paramName} format` 
      });
    }
  }
  
  next();
};

// Validate ObjectId in request body
const validateBodyObjectId = (fieldName) => (req, res, next) => {
  const id = req.body[fieldName];
  
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid ${fieldName} format` 
    });
  }
  
  next();
};

module.exports = { validateObjectId, validateObjectIds, validateBodyObjectId };
