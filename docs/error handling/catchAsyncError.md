## Asynchronous Error Handling (`middleware/catchAsyncError.js`)

This middleware simplifies error handling for asynchronous functions by catching errors and passing them to the next error handling middleware.

```javascript
export default (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};