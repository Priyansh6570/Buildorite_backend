# Controller Files and Functions

This document outlines the controller files and their corresponding functions for the mining and transportation management system.

## 📲 Controller Files

### authController.js

* `loginUser(req, res)`:
    * Logs in a user via their phone number.
    * Stores a JWT (JSON Web Token) after Firebase authentication.
* `logoutUser(req, res)`:
    * Logs out a user by removing the JWT cookie.
* `getUserProfile(req, res)`:
    * Retrieves and returns the user's detailed profile information.

### mineController.js

* `createMine(req, res)`:
    * Adds a new mine to the system.
* `updateMine(req, res)`:
    * Updates the details of an existing mine.
* `getAllMines(req, res)`:
    * Fetches and returns a list of all mines, primarily for truck owners.
* `getMineById(req, res)`:
    * Retrieves and returns the details of a specific mine, including its materials, assigned trucks, and pending requests.

### materialController.js

* `addMaterial(req, res)`:
    * Adds a new material to a specific mine.
* `updateMaterial(req, res)`:
    * Updates the details of an existing material.
* `getMaterialsByMine(req, res)`:
    * Fetches and returns a list of materials available at a specific mine.

### requestController.js

* `createRequest(req, res)`:
    * Allows a truck owner to send a request for materials to a mine.
* `getRequestsByMine(req, res)`:
    * Allows a mine owner to view all incoming requests for their mine.
* `updateRequestStatus(req, res)`:
    * Allows a mine owner to accept or reject a request.
    * Allows setting the pickup or delivery date.
* `getMyRequests(req, res)`:
    * Allows a truck owner to view all their sent requests.

### truckController.js

* `addTruck(req, res)`:
    * Allows a truck owner to add a new truck to their fleet.
* `assignDriver(req, res)`:
    * Allows a truck owner to assign a driver to a truck.
* `getMyTrucks(req, res)`:
    * Lists all trucks owned by a specific truck owner.
* `getTruckById(req, res)`:
    * Retrieves and returns the details of a specific truck, including its current location and status.

### tripController.js

* `createTrip(req, res)`:
    * Allows a mine owner to assign a trip to a truck after accepting a material request.
* `updateTripMilestone(req, res)`:
    * Allows a driver to update the current milestone of a trip (e.g., at mine, on route, delivered).
* `getTripById(req, res)`:
    * Retrieves and returns the details of a specific trip, accessible to both mine owners and truck owners.

### notificationController.js

* `sendNotification(req, res)`:
    * Sends in-app notifications to users (to be implemented).
* `getNotifications(req, res)`:
    * Lists all notifications for a specific user.