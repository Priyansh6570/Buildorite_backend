import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import app from "./app.js";
import connectDB from "./config/database.js";
import http from "http";
import { Server } from "socket.io";
import { Expo } from "expo-server-sdk";
import User from "./models/userModel.js";
import Trip from "./models/tripModel.js";

connectDB();

process.on("uncaughtException", (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  console.error(`Error Stack: ${err.stack}`);
  console.log("Shutting down server due to uncaught exception");
  process.exit(1);
});

const server = http.createServer(app);
const expo = new Expo();

const INITIAL_RESPONSE_TIMEOUT_MS = 20000;
const HEARTBEAT_TIMEOUT_MS = 90000;

const userSocketMap = new Map();
const trackingSessions = new Map();

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

const sendTrackingPushNotification = async (pushToken, tripId, driverId) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Push Notification] Sending tracking notification to ${driverId} for trip ${tripId}`);

  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`[${timestamp}] [Push Error] Invalid Expo push token: ${pushToken}`);
    return false;
  }

  const message = {
    to: pushToken,
    title: "Trip Started - Location Sharing Required",
    body: "Tap to start sharing your location for the current trip",
    data: {
      action: "START_TRACKING",
      tripId: tripId,
      timestamp: timestamp,
      driverId: driverId,
    },
    priority: "high",
    sound: "default",
    // iOS
    _contentAvailable: true,
    _mutableContent: true,
    categoryIdentifier: "TRACKING_REQUEST",
    // Android
    channelId: "location-tracking",
    android: {
      priority: "high",
      visibility: "public",
      categoryId: "TRACKING_REQUEST",
      sticky: true,
      autoCancel: false,
    },
  };

  try {
    console.log(`[${timestamp}] [Push Send] Sending notification:`, {
      to: pushToken,
      title: message.title,
      data: message.data,
    });

    const receipts = await expo.sendPushNotificationsAsync([message]);
    console.log(`[${timestamp}] [Push Success] Notification sent successfully:`, receipts);
    return true;
  } catch (error) {
    console.error(`[${timestamp}] [Push Error] Failed to send notification:`, error);
    return false;
  }
};

const sendPushNotification = async (pushToken, data) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return false;
  }

  const message = {
    to: pushToken,
    data: data,
    priority: "high",
    _contentAvailable: true,
  };

  try {
    await expo.sendPushNotificationsAsync([message]);
    console.log("Push notification sent successfully.");
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
};

io.on("connection", (socket) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Connect] New client connected:`, socket.id);

  socket.on("authenticate", ({ userId }) => {
    const authTimestamp = new Date().toISOString();
    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`[${authTimestamp}] [Auth] User ${userId} authenticated with socket ${socket.id}`);
    }
  });
  socket.on("trackingRequestReceived", ({ tripId, status }) => {
    const responseTimestamp = new Date().toISOString();
    console.log(`[${responseTimestamp}] [Response] Driver received tracking request for trip ${tripId} - Status: ${status}`);
    const session = trackingSessions.get(tripId);
    if (session && session.timeoutId) {
      clearTimeout(session.timeoutId);
      console.log(`[${responseTimestamp}] [Response] Cleared timeout for trip ${tripId} - driver responded`);

      session.timeoutId = setTimeout(() => {
        console.log(`[Response Timeout] Driver for trip ${tripId} acknowledged but didn't start tracking in time.`);
        io.to(tripId).emit("tracking_failed", {
          tripId,
          reason: "Driver received request but failed to start tracking.",
        });
        trackingSessions.delete(tripId);
      }, INITIAL_RESPONSE_TIMEOUT_MS);
    }
  });

  socket.on("trackingRequestResponse", ({ tripId, status, reason, message }) => {
    const responseTimestamp = new Date().toISOString();
    console.log(`[${responseTimestamp}] [Response] Driver tracking response for trip ${tripId}: ${status}`, reason ? `Reason: ${reason}` : "", message ? `Message: ${message}` : "");

    const session = trackingSessions.get(tripId);
    if (!session) return;

    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
    }

    switch (status) {
      case "started":
        session.status = "active";
        session.driverSocketId = socket.id;
        io.to(tripId).emit("tracking_started", {
          tripId,
          message: "Driver has started location sharing.",
        });
        console.log(`[${responseTimestamp}] [Track Success] Driver started tracking for trip ${tripId}`);
        break;

      case "failed":
        const failureMessage = message || reason || "Driver failed to start location tracking.";
        io.to(tripId).emit("tracking_failed", {
          tripId,
          reason: failureMessage,
          errorType: reason,
        });
        trackingSessions.delete(tripId);
        console.log(`[${responseTimestamp}] [Track Failed] Driver failed to start tracking for trip ${tripId}: ${failureMessage}`);
        break;

      case "already_tracking":
        session.status = "active";
        session.driverSocketId = socket.id;
        io.to(tripId).emit("tracking_started", {
          tripId,
          message: "Driver is already sharing location.",
        });
        console.log(`[${responseTimestamp}] [Track Info] Driver already tracking for trip ${tripId}`);
        break;
    }
  });

  socket.on("stopTrackingResponse", ({ status, tripId, error }) => {
    const stopTimestamp = new Date().toISOString();
    console.log(`[${stopTimestamp}] [Response] Driver stop tracking response: ${status} for trip: ${tripId || "unknown"}`, error ? `Error: ${error}` : "");
  });

  socket.on("trackingError", ({ tripId, error, message }) => {
    const errorTimestamp = new Date().toISOString();
    console.log(`[${errorTimestamp}] [Track Error] Received error for trip ${tripId}: ${error} - ${message}`);

    const session = trackingSessions.get(tripId);
    if (session) {
      io.to(tripId).emit("tracking_error", {
        tripId,
        error,
        message: message || "An error occurred during location tracking",
      });
    }
  });

  socket.on("trackingInterrupted", ({ tripId, reason }) => {
    const interruptTimestamp = new Date().toISOString();
    console.log(`[${interruptTimestamp}] [Track Interrupted] Trip ${tripId} tracking interrupted: ${reason}`);

    const session = trackingSessions.get(tripId);
    if (session) {
      io.to(tripId).emit("tracking_interrupted", {
        tripId,
        reason: reason || "Location tracking was interrupted",
      });

      setTimeout(() => {
        const currentSession = trackingSessions.get(tripId);
        if (currentSession && currentSession.status !== "active") {
          console.log(`[Cleanup] Removing interrupted session for trip ${tripId}`);
          trackingSessions.delete(tripId);
        }
      }, 30000);
    }
  });

  socket.on("startTrackingTrip", async (payload) => {
    const startTimestamp = new Date().toISOString();
    const { userId, tripId, driverId } = payload;
    console.log(`[${startTimestamp}] [Start Track] User ${userId} requested to track trip ${tripId} (Driver: ${driverId})`);

    socket.join(tripId);

    if (trackingSessions.has(tripId)) {
      const session = trackingSessions.get(tripId);
      session.watchers.add(socket.id);
      console.log(`[${startTimestamp}] [Start Track] New watcher ${socket.id} added to existing session for trip ${tripId}.`);
      return;
    }

    try {
      const driver = await User.findById(driverId);
      if (!driver) {
        socket.emit("tracking_failed", { tripId, reason: "Driver could not be found." });
        return;
      }

      const session = {
        watchers: new Set([socket.id]),
        driverId: driverId,
        driverSocketId: userSocketMap.get(driverId) || null,
        status: "pending",
        timeoutId: setTimeout(() => {
          console.log(`[Timeout] Driver for trip ${tripId} did not respond in time.`);
          io.to(tripId).emit("tracking_failed", {
            tripId,
            reason: "Driver did not respond to the tracking request.",
          });
          trackingSessions.delete(tripId);
        }, INITIAL_RESPONSE_TIMEOUT_MS),
      };
      trackingSessions.set(tripId, session);

      if (session.driverSocketId) {
        console.log(`[${startTimestamp}] [Ping] Driver ${driverId} is online. Sending socket request.`);
        io.to(session.driverSocketId).emit("requestLocationUpdates", { tripId });
      } else if (driver.pushToken) {
        console.log(`[${startTimestamp}] [Ping] Driver ${driverId} is offline. Sending push notification.`);
        const notificationSent = await sendTrackingPushNotification(driver.pushToken, tripId, driverId);

        if (!notificationSent) {
          console.log(`[${startTimestamp}] [Error] Failed to send push notification to driver ${driverId}`);
          io.to(tripId).emit("tracking_failed", {
            tripId,
            reason: "Failed to notify driver. Please try again.",
          });
          clearTimeout(session.timeoutId);
          trackingSessions.delete(tripId);
        }
      } else {
        console.log(`[${startTimestamp}] [Error] Cannot track driver ${driverId}: offline and no push token.`);
        io.to(tripId).emit("tracking_failed", {
          tripId,
          reason: "Driver is offline and cannot be reached.",
        });
        clearTimeout(session.timeoutId);
        trackingSessions.delete(tripId);
      }
    } catch (error) {
      console.error(`[${startTimestamp}] [Error] Error starting trip tracking:`, error);
      socket.emit("tracking_failed", {
        tripId,
        reason: "Server error occurred while starting tracking.",
      });
      trackingSessions.delete(tripId);
    }
  });

  socket.on("updateLocation", async ({ tripId, coordinates, accuracy, timestamp }) => {
    const updateTimestamp = new Date().toISOString();
    const session = trackingSessions.get(tripId);
    if (!session) {
      console.warn(`[${updateTimestamp}] [Location Warning] No session found for trip ${tripId}`);
      return;
    }

    console.log(`[${updateTimestamp}] [Location Update] Received location for trip ${tripId}: [${coordinates[1]}, ${coordinates[0]}] (accuracy: ${accuracy}m)`);

    if (session.status === "pending") {
      session.status = "active";
      session.driverSocketId = socket.id;
      console.log(`[${updateTimestamp}] [Status Change] Trip ${tripId} status changed to active`);
    }

    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }

    session.timeoutId = setTimeout(() => {
      console.log(`[Timeout] Heartbeat lost for driver on trip ${tripId}.`);
      io.to(tripId).emit("driver_went_offline", {
        tripId,
        reason: "Lost connection with the driver.",
      });
      trackingSessions.delete(tripId);
    }, HEARTBEAT_TIMEOUT_MS);

    io.to(tripId).emit("driverLocationUpdated", {
      coordinates,
      accuracy,
      timestamp: timestamp || new Date().toISOString(),
    });
    try {
      await Trip.findByIdAndUpdate(tripId, {
        live_location: {
          type: "Point",
          coordinates,
          timestamp: new Date(timestamp || Date.now()),
          accuracy,
        },
      });
    } catch (err) {
      console.error(`[${updateTimestamp}] [DB Error] Failed to update location for trip ${tripId}:`, err);
    }
  });

  socket.on("stopTrackingTrip", ({ tripId }) => {
    const stopTimestamp = new Date().toISOString();
    const session = trackingSessions.get(tripId);
    if (!session) return;

    console.log(`[${stopTimestamp}] [Stop Track] Watcher ${socket.id} stopped watching trip ${tripId}.`);
    session.watchers.delete(socket.id);

    if (session.watchers.size === 0) {
      console.log(`[${stopTimestamp}] [Session End] Last watcher left for trip ${tripId}. Cleaning up.`);
      if (session.driverSocketId) {
        io.to(session.driverSocketId).emit("stopLocationUpdates", { tripId });
      }
      if (session.timeoutId) {
        clearTimeout(session.timeoutId);
      }
      trackingSessions.delete(tripId);
    }
  });

  socket.on("disconnect", () => {
    const disconnectTimestamp = new Date().toISOString();
    console.log(`[${disconnectTimestamp}] [Disconnect] Client disconnected: ${socket.id}`);
    let disconnectedUserId = null;

    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      userSocketMap.delete(disconnectedUserId);
      console.log(`[${disconnectTimestamp}] [User Disconnect] User ${disconnectedUserId} disconnected`);

      trackingSessions.forEach((session, tripId) => {
        if (session.driverId === disconnectedUserId) {
          console.log(`[${disconnectTimestamp}] [Driver Disconnect] Tracked driver for trip ${tripId} disconnected.`);
          io.to(tripId).emit("driver_went_offline", {
            tripId,
            reason: "Driver has disconnected.",
          });
          if (session.timeoutId) {
            clearTimeout(session.timeoutId);
          }
          trackingSessions.delete(tripId);
        }
      });
    }

    trackingSessions.forEach((session, tripId) => {
      if (session.watchers.has(socket.id)) {
        session.watchers.delete(socket.id);
        if (session.watchers.size === 0) {
          console.log(`[${disconnectTimestamp}] [Session End] Last watcher for trip ${tripId} disconnected. Cleaning up.`);
          if (session.driverSocketId) {
            io.to(session.driverSocketId).emit("stopLocationUpdates", { tripId });
          }
          if (session.timeoutId) {
            clearTimeout(session.timeoutId);
          }
          trackingSessions.delete(tripId);
        }
      }
    });
  });
});

export const sendNotification = (recipientId, data) => {
  const socketId = userSocketMap.get(recipientId);
  if (socketId) {
    io.to(socketId).emit("notification", data);
  }
};

server.listen(process.env.PORT, () => {
  console.log(`Server running on port: ${process.env.PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
