/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error(err);
  
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Server Error';
  
    // Mongoose bad ObjectId
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      statusCode = 404;
      message = 'Resource not found';
    }
  
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      statusCode = 400;
      message = Object.values(err.errors).map(val => val.message).join(', ');
    }
  
    // Mongoose duplicate key
    if (err.code === 11000) {
      statusCode = 400;
      message = `Duplicate value entered for ${Object.keys(err.keyValue)} field`;
    }
  
    res.status(statusCode).json({
      success: false,
      error: message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
  };
  
  module.exports = errorHandler;