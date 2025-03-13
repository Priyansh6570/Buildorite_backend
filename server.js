import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import http from 'http';
import { Server } from 'socket.io';

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

dotenv.config({ path: 'config/.env' });
connectDB();

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('register', (userId) => {
        connectedUsers.set(userId, socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        for (let [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                break;
            }
        }
    });
});

export const sendNotification = (recipientId, data) => {
    const socketId = connectedUsers.get(recipientId);
    if (socketId) {
        io.to(socketId).emit('notification', data);
    }
};

server.listen(process.env.PORT,() => {
    console.log(`Server running on ${process.env.PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    console.log('Shutting down server due to unhandled promise rejection');
    server.close(() => {
        process.exit(1);
    });
});