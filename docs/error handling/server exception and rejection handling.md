## Uncaught Exceptions and Unhandled Promise Rejections (`server.js`)

These event listeners handle uncaught exceptions and unhandled promise rejections, preventing the application from crashing and ensuring graceful shutdowns.

```javascript
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error(`Uncaught Exception: ${err.message}`);

    const stackLines = err.stack.split('\n');
    let locationInfo = "Unknown location";

    for (const line of stackLines) {
        if (line.includes('at ')) {
            locationInfo = line.substring(line.lastIndexOf('at ') + 3);
            break;
        }
    }

    console.error(`Error Location: ${locationInfo}`);
    console.log('Shutting down server due to uncaught exception');
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    console.log('Shutting down server due to unhandled promise rejection');
    server.close(() => {
        process.exit(1);
    });
});