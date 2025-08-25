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

const PUSH_RESPONSE_TIMEOUT_MS = 20000;
const HEARTBEAT_TIMEOUT_MS = 90000;
const LOCATION_STALENESS_THRESHOLD_MS = 10 * 60 * 1000;

const userSocketMap = new Map();
const trackingSessions = new Map();
const driverLocations = new Map();

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
});

// Helper function to check if location is fresh (under 10 minutes)
const isLocationFresh = (timestamp) => {
  const now = Date.now();
  const locationTime = new Date(timestamp).getTime();
  const ageMs = now - locationTime;
  console.log(`🕐 [Location Age Check] Location age: ${Math.round(ageMs / 60000)} minutes (Fresh: ${ageMs < LOCATION_STALENESS_THRESHOLD_MS})`);
  return ageMs < LOCATION_STALENESS_THRESHOLD_MS;
};

// Helper function to get trip's live_location from database
const getTripLiveLocation = async (tripId) => {
  try {
    const trip = await Trip.findById(tripId).select('live_location driver_id');
    if (!trip) {
      console.log(`🔍 [DB Check] Trip ${tripId} not found`);
      return { trip: null, location: null, driver: null };
    }

    const liveLocation = trip.live_location;
    console.log(`🔍 [DB Check] Trip ${tripId} live_location:`, {
      exists: !!liveLocation,
      coordinates: liveLocation?.coordinates,
      timestamp: liveLocation?.timestamp ? new Date(liveLocation.timestamp).toISOString() : null,
      ageMinutes: liveLocation?.timestamp ? Math.round((Date.now() - new Date(liveLocation.timestamp).getTime()) / 60000) : 'N/A'
    });

    return {
      trip,
      location: liveLocation,
      driver: trip.driver_id
    };
  } catch (error) {
    console.error(`🔍 [DB Check] Error fetching trip ${tripId}:`, error);
    return { trip: null, location: null, driver: null };
  }
};

// Helper function to update trip's live_location in database
const updateTripLiveLocation = async (tripId, locationData) => {
  try {
    const updatedTrip = await Trip.findByIdAndUpdate(
      tripId,
      {
        live_location: {
          type: "Point",
          coordinates: locationData.coordinates,
          timestamp: new Date(locationData.timestamp),
          accuracy: locationData.accuracy,
        },
      },
      { new: true }
    );

    console.log(`📍 [DB Update] Updated trip ${tripId} live_location successfully`);
    return updatedTrip;
  } catch (error) {
    console.error(`📍 [DB Update] Failed to update trip ${tripId} live_location:`, error);
    return null;
  }
};

// Helper function to update all active trips for a driver (for periodic updates)
const updateAllDriverTripLocations = async (driverId, locationData) => {
  try {
    const activeTrips = await Trip.find({
      driver_id: driverId,
      status: 'active'
    });

    console.log(`📍 [Bulk Update] Found ${activeTrips.length} active trips for driver ${driverId}`);

    const updatePromises = activeTrips.map(trip => 
      Trip.findByIdAndUpdate(trip._id, {
        live_location: {
          type: "Point",
          coordinates: locationData.coordinates,
          timestamp: new Date(locationData.timestamp),
          accuracy: locationData.accuracy,
        },
      })
    );

    await Promise.all(updatePromises);
    console.log(`📍 [Bulk Update] Updated live_location for ${activeTrips.length} trips`);
    return activeTrips;
  } catch (error) {
    console.error(`📍 [Bulk Update] Failed to update driver trips:`, error);
    return [];
  }
};

const sendTrackingPushNotification = async (pushToken, tripId, driverId) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Push Notification] Sending tracking notification to driver ${driverId} for trip ${tripId}`);

  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`[${timestamp}] [Push Error] Invalid Expo push token: ${pushToken}`);
    return false;
  }

  const message = {
    to: pushToken,
    title: "Location Request",
    body: "Mine owner is requesting your current location",
    data: {
      action: "LOCATION_REQUEST",
      tripId: tripId,
      timestamp: timestamp,
      driverId: driverId,
    },
    priority: "high",
    sound: "default",
    channelId: "location-tracking",
  };

  try {
    console.log(`[${timestamp}] [Push Send] Sending location request notification for trip ${tripId}`);
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

  // Handle periodic location updates from drivers (every 10 minutes)
  socket.on("driverLocationUpdate", async ({ driverId, coordinates, accuracy, timestamp, source }) => {
    const updateTimestamp = new Date().toISOString();
    console.log(`[${updateTimestamp}] [Periodic Location] Received update from driver ${driverId} (${source}):`, {
      coordinates,
      accuracy,
      timestamp: new Date(timestamp).toISOString()
    });

    // Store driver location in memory for quick access
    driverLocations.set(driverId, {
      coordinates,
      accuracy,
      timestamp,
      lastUpdated: Date.now(),
      source
    });

    // Update all active trips for this driver in database
    const updatedTrips = await updateAllDriverTripLocations(driverId, {
      coordinates,
      accuracy,
      timestamp
    });

    console.log(`[${updateTimestamp}] [Periodic Location] Updated ${updatedTrips.length} active trips for driver ${driverId}`);
  });

  // Handle immediate location updates for specific trip tracking (in response to requests)
  socket.on("driverTrackingLocationUpdate", async ({ tripId, driverId, coordinates, accuracy, timestamp, source }) => {
    const trackingTimestamp = new Date().toISOString();
    console.log(`[${trackingTimestamp}] [Location Response] Received location response for trip ${tripId} from driver ${driverId}:`, {
      coordinates,
      accuracy,
      timestamp: new Date(timestamp).toISOString(),
      source
    });

    // Update driver location in memory
    driverLocations.set(driverId, {
      coordinates,
      accuracy,
      timestamp,
      lastUpdated: Date.now(),
      source
    });

    // Update specific trip's live_location in database
    const updatedTrip = await updateTripLiveLocation(tripId, {
      coordinates,
      accuracy,
      timestamp
    });

    if (updatedTrip) {
      // Send fresh location to mine app clients tracking this trip
      io.to(tripId).emit("driverLocationUpdated", {
        coordinates,
        accuracy,
        timestamp: timestamp || new Date().toISOString(),
        source: 'real_time_tracking',
        isStale: false
      });

      // Notify that tracking started successfully
      io.to(tripId).emit("tracking_started", {
        tripId,
        message: "Driver location received successfully.",
        isStale: false
      });

      console.log(`[${trackingTimestamp}] [Location Response] ✅ Sent fresh location to trip ${tripId} watchers`);
    }

    // Clear timeout if this was in response to a request
    const session = trackingSessions.get(tripId);
    if (session && session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
      session.status = "active";
      console.log(`[${trackingTimestamp}] [Location Response] Cleared timeout for trip ${tripId} - location received`);
    }
  });

  socket.on("driverLocationError", ({ driverId, error, timestamp }) => {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [Location Error] Driver ${driverId} location error: ${error}`);
  });

  socket.on("trackingRequestReceived", ({ tripId, status }) => {
    const responseTimestamp = new Date().toISOString();
    console.log(`[${responseTimestamp}] [Request Ack] Driver received tracking request for trip ${tripId} - Status: ${status}`);
  });

  socket.on("trackingRequestResponse", ({ tripId, status, reason, message }) => {
    const responseTimestamp = new Date().toISOString();
    console.log(`[${responseTimestamp}] [Request Response] Driver response for trip ${tripId}: ${status}`, reason ? `Reason: ${reason}` : "", message ? `Message: ${message}` : "");

    const session = trackingSessions.get(tripId);
    if (!session) return;

    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = null;
    }

    switch (status) {
      case "location_failed":
        const locationFailureMessage = message || reason || "Driver could not provide current location.";
        io.to(tripId).emit("tracking_failed", {
          tripId,
          reason: locationFailureMessage,
          errorType: "location_unavailable",
        });
        trackingSessions.delete(tripId);
        console.log(`[${responseTimestamp}] [Request Response] ❌ Driver failed to provide location for trip ${tripId}: ${locationFailureMessage}`);
        break;

      case "failed":
        const failureMessage = message || reason || "Driver failed to respond to location request.";
        io.to(tripId).emit("tracking_failed", {
          tripId,
          reason: failureMessage,
          errorType: "request_failed",
        });
        trackingSessions.delete(tripId);
        console.log(`[${responseTimestamp}] [Request Response] ❌ Driver request failed for trip ${tripId}: ${failureMessage}`);
        break;
    }
  });

  socket.on("stopTrackingResponse", ({ status, tripId, error }) => {
    const stopTimestamp = new Date().toISOString();
    console.log(`[${stopTimestamp}] [Stop Response] Driver stop response: ${status} for trip: ${tripId || "unknown"}`, error ? `Error: ${error}` : "");
  });

  socket.on("trackingError", ({ tripId, error, message }) => {
    const errorTimestamp = new Date().toISOString();
    console.log(`[${errorTimestamp}] [Track Error] Error for trip ${tripId}: ${error} - ${message}`);

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
    }
  });

  // MAIN TRACKING LOGIC - Database-First Approach
  socket.on("startTrackingTrip", async (payload) => {
    const startTimestamp = new Date().toISOString();
    const { userId, tripId, driverId } = payload;
    console.log(`[${startTimestamp}] [🚀 Track Request] User ${userId} requested location for trip ${tripId} (Driver: ${driverId})`);

    socket.join(tripId);

    // Handle existing session
    if (trackingSessions.has(tripId)) {
      const session = trackingSessions.get(tripId);
      session.watchers.add(socket.id);
      console.log(`[${startTimestamp}] [Track Request] Added watcher to existing session for trip ${tripId}`);
      return;
    }

    try {
      // Step 1: Check trip's live_location from database
      console.log(`[${startTimestamp}] [📍 Step 1] Checking trip ${tripId} live_location from database...`);
      const { trip, location: liveLocation, driver } = await getTripLiveLocation(tripId);

      if (!trip) {
        socket.emit("tracking_failed", { 
          tripId, 
          reason: "Trip not found.",
          errorType: "trip_not_found"
        });
        return;
      }

      if (!driver) {
        socket.emit("tracking_failed", { 
          tripId, 
          reason: "Driver not assigned to this trip.",
          errorType: "driver_not_found"
        });
        return;
      }

      // Step 2: Check if live_location exists and its age
      const hasLiveLocation = liveLocation && liveLocation.coordinates && liveLocation.timestamp;
      const isFreshLocation = hasLiveLocation && isLocationFresh(liveLocation.timestamp);

      console.log(`[${startTimestamp}] [📍 Step 2] Live location analysis:`, {
        hasLocation: hasLiveLocation,
        isFresh: isFreshLocation,
        ageMinutes: hasLiveLocation ? Math.round((Date.now() - new Date(liveLocation.timestamp).getTime()) / 60000) : 'N/A'
      });

      const session = {
        watchers: new Set([socket.id]),
        driverId: driver,
        driverSocketId: userSocketMap.get(driver) || null,
        status: "pending",
        timeoutId: null,
      };
      trackingSessions.set(tripId, session);

      // Step 3: Send location data (fresh or stale) and conditionally request new location
      if (hasLiveLocation) {
        // Always send the location data we have
        console.log(`[${startTimestamp}] [📍 Step 3] Sending existing location to client (Age: ${Math.round((Date.now() - new Date(liveLocation.timestamp).getTime()) / 60000)} min)`);
        
        io.to(tripId).emit("driverLocationUpdated", {
          coordinates: liveLocation.coordinates,
          accuracy: liveLocation.accuracy || 0,
          timestamp: new Date(liveLocation.timestamp).toISOString(),
          source: isFreshLocation ? 'cached_recent' : 'cached_old',
          isStale: !isFreshLocation
        });

        io.to(tripId).emit("tracking_started", {
          tripId,
          message: isFreshLocation 
            ? `Driver location available (${Math.round((Date.now() - new Date(liveLocation.timestamp).getTime()) / 60000)} minutes ago)`
            : `Latest location unavailable, showing location from ${Math.round((Date.now() - new Date(liveLocation.timestamp).getTime()) / 60000)} minutes ago.`,
          isStale: !isFreshLocation
        });

        // If location is stale (>10 min), request fresh location
        if (!isFreshLocation) {
          console.log(`[${startTimestamp}] [📱 Step 4] Location is stale, requesting fresh location...`);
          await requestFreshLocation(tripId, driver, session, startTimestamp);
        } else {
          // Fresh location - we're done
          session.status = "active";
          console.log(`[${startTimestamp}] [✅ Complete] Fresh location provided, tracking active`);
        }
      } else {
        // No location data at all
        console.log(`[${startTimestamp}] [📍 Step 3] No location data found, must request fresh location`);
        
        // Request fresh location immediately
        await requestFreshLocation(tripId, driver, session, startTimestamp);
      }

    } catch (error) {
      console.error(`[${startTimestamp}] [❌ Error] Error in tracking request:`, error);
      socket.emit("tracking_failed", {
        tripId,
        reason: "Server error occurred while fetching location.",
        errorType: "server_error"
      });
      trackingSessions.delete(tripId);
    }
  });

  // Helper function to request fresh location from driver
  const requestFreshLocation = async (tripId, driverId, session, startTimestamp) => {
    try {
      const driver = await User.findById(driverId);
      if (!driver) {
        io.to(tripId).emit("tracking_failed", {
          tripId,
          reason: "Driver information not found.",
          errorType: "driver_not_found"
        });
        trackingSessions.delete(tripId);
        return;
      }

      // Set 20-second timeout for fresh location response
      session.timeoutId = setTimeout(async () => {
        console.log(`[${new Date().toISOString()}] [⏰ Timeout] Driver ${driverId} did not provide fresh location within 20 seconds for trip ${tripId}`);
        
        // Check if we had any old location to show
        const { location: oldLocation } = await getTripLiveLocation(tripId);
        if (oldLocation && oldLocation.coordinates) {
          // We already showed the old location, so just keep it - NO ERROR MESSAGE
          console.log(`[${new Date().toISOString()}] [📍 Keep Old] Driver didn't respond but we have old location, keeping it visible`);
          session.status = "active"; // Keep session active with old location
          // Don't send any error - just keep showing the old location
        } else {
          // No location data at all - only then send error
          console.log(`[${new Date().toISOString()}] [❌ No Data] No location data available at all`);
          io.to(tripId).emit("tracking_failed", {
            tripId,
            reason: "Cannot get driver location. No location data available.",
            errorType: "no_location_available"
          });
          trackingSessions.delete(tripId);
        }
      }, PUSH_RESPONSE_TIMEOUT_MS);

      // Try to request location from driver
      if (session.driverSocketId) {
        console.log(`[${startTimestamp}] [🔌 Online] Driver ${driverId} is online, requesting immediate location via socket`);
        io.to(session.driverSocketId).emit("requestImmediateLocation", { 
          tripId,
          urgent: true,
          reason: "Mine owner requesting current location"
        });
      } else if (driver.pushToken) {
        console.log(`[${startTimestamp}] [📱 Offline] Driver ${driverId} is offline, sending push notification`);
        const notificationSent = await sendTrackingPushNotification(driver.pushToken, tripId, driverId);

        if (!notificationSent) {
          console.log(`[${startTimestamp}] [❌ Push Failed] Failed to send push notification to driver ${driverId}`);
          clearTimeout(session.timeoutId);
          
          // Check if we have any old location data to fall back on
          const { location: fallbackLocation } = await getTripLiveLocation(tripId);
          if (fallbackLocation && fallbackLocation.coordinates) {
            // Keep showing old location, don't send error since we have location data
            console.log(`[${startTimestamp}] [📍 Fallback] Push failed but we have old location, keeping it visible`);
            session.status = "active"; // Keep session active with old location
          } else {
            // No location data at all - send error
            io.to(tripId).emit("tracking_failed", {
              tripId,
              reason: "Failed to notify driver and no location data available.",
              errorType: "notification_failed"
            });
            trackingSessions.delete(tripId);
          }
        }
      } else {
        console.log(`[${startTimestamp}] [❌ Unreachable] Cannot reach driver ${driverId}: offline and no push token`);
        clearTimeout(session.timeoutId);
        
        // Check if we have any old location data
        const { location: fallbackLocation } = await getTripLiveLocation(tripId);
        if (fallbackLocation && fallbackLocation.coordinates) {
          // Keep showing old location, no error message
          console.log(`[${startTimestamp}] [📍 Fallback] Driver unreachable but we have old location, keeping it visible`);
          session.status = "active"; // Keep session active with old location
        } else {
          // No location data at all - send error
          io.to(tripId).emit("tracking_failed", {
            tripId,
            reason: "Driver is unreachable and no location data is available.",
            errorType: "driver_unreachable"
          });
          trackingSessions.delete(tripId);
        }
      }
    } catch (error) {
      console.error(`[${startTimestamp}] [❌ Request Error] Error requesting fresh location:`, error);
      clearTimeout(session.timeoutId);
      io.to(tripId).emit("tracking_failed", {
        tripId,
        reason: "Server error while requesting driver location.",
        errorType: "server_error"
      });
      trackingSessions.delete(tripId);
    }
  };

  // Legacy support
  socket.on("updateLocation", async ({ tripId, coordinates, accuracy, timestamp }) => {
    console.log(`[Legacy] Received updateLocation event - converting to new format`);
    
    try {
      const trip = await Trip.findById(tripId).populate('driver_id');
      if (trip && trip.driver_id) {
        socket.emit("driverTrackingLocationUpdate", {
          tripId,
          driverId: trip.driver_id._id,
          coordinates,
          accuracy,
          timestamp,
          source: 'legacy_update'
        });
      }
    } catch (error) {
      console.error(`[Legacy] Failed to handle legacy updateLocation:`, error);
    }
  });

  socket.on("stopTrackingTrip", ({ tripId }) => {
    const stopTimestamp = new Date().toISOString();
    const session = trackingSessions.get(tripId);
    if (!session) return;

    console.log(`[${stopTimestamp}] [🛑 Stop] Watcher ${socket.id} stopped watching trip ${tripId}`);
    session.watchers.delete(socket.id);

    if (session.watchers.size === 0) {
      console.log(`[${stopTimestamp}] [🧹 Cleanup] Last watcher left for trip ${tripId}, cleaning up session`);
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
    console.log(`[${disconnectTimestamp}] [🔌 Disconnect] Client disconnected: ${socket.id}`);
    let disconnectedUserId = null;

    // Find which user disconnected
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        break;
      }
    }

    if (disconnectedUserId) {
      userSocketMap.delete(disconnectedUserId);
      console.log(`[${disconnectTimestamp}] [👤 User Disconnect] User ${disconnectedUserId} disconnected`);

      // Don't immediately clear driver location data - keep it for a while
      // Only clear it after some time or when driver explicitly goes offline
      console.log(`[${disconnectTimestamp}] [💾 Location Kept] Keeping location data for driver ${disconnectedUserId} (might reconnect)`);

      // Update tracking sessions but don't immediately fail them
      trackingSessions.forEach((session, tripId) => {
        if (session.driverId === disconnectedUserId) {
          console.log(`[${disconnectTimestamp}] [📱 Driver Offline] Driver for trip ${tripId} went offline, but keeping session active`);
          session.driverSocketId = null; // Mark as offline but don't end session
          
          // If there was a pending request, they might still respond via push notification
          if (session.status === "pending" && session.timeoutId) {
            console.log(`[${disconnectTimestamp}] [⏳ Keep Waiting] Driver offline but still waiting for location response via push`);
          }
        }
      });
    }

    // Clean up watcher sessions
    trackingSessions.forEach((session, tripId) => {
      if (session.watchers.has(socket.id)) {
        session.watchers.delete(socket.id);
        if (session.watchers.size === 0) {
          console.log(`[${disconnectTimestamp}] [🧹 Session End] Last watcher for trip ${tripId} disconnected`);
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

server.listen(process.env.PORT, () => {
  console.log(`Server running on port: ${process.env.PORT}`);
});

process.on("unhandledRejection", (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});