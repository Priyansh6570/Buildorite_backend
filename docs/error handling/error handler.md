# Error Handling Documentation

This document describes the error handling mechanisms implemented in the BuildoRite backend.

## Error Handler Class (`utils/errorHandler.js`)

A custom `ErrorHandler` class is created to standardize error responses.

```javascript
class ErrorHandler extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

export default ErrorHandler;