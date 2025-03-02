# Entities & Schema Breakdown

This document outlines the entities and their schemas for the mining and transportation management system.

## 🏢 User (Mine Owner / Truck Owner / Driver)

A single User model with a `role` field to differentiate between mine owners, truck owners, and drivers.

**Fields:**

* `name` (String): User's name.
* `email` (String): User's email address.
* `phone` (String): User's phone number.
* `password` (String): User's password (hashed).
* `role` (Enum: `mine_owner`, `truck_owner`, `driver`): User's role in the system.
* `wallet_balance` (Decimal): User's wallet balance for financial transactions.
* `mine_id` (ObjectID, ref: `Mine`, optional): If `role` is `mine_owner`, the ID of the owned mine.
* `truck_ids` (Array of ObjectID, ref: `Truck`, optional): If `role` is `truck_owner`, the IDs of owned trucks.
* `assigned_trip_id` (ObjectID, ref: `Trip`, optional): If `role` is `driver`, the ID of the assigned trip.

## ⛏ Mine (Owned by Mine Owner)

Represents a mine owned by a mine owner.

**Fields:**

* `name` (String): Mine's name.
* `location` (String): Mine's location.
* `owner_id` (ObjectID, ref: `User`): ID of the mine owner.
* `materials` (Array of `Material` objects): List of materials available at the mine.
* `requests` (Array of `Request` objects): List of requests from truck owners.
* `assigned_trucks` (Array of ObjectID, ref: `Truck`): List of trucks currently assigned to the mine.

## 🏗 Material (Available at a Mine)

Represents a material available at a mine.

**Fields:**

* `name` (String): Material's name.
* `price_per_ton` (Decimal): Price per ton of the material.
* `mine_id` (ObjectID, ref: `Mine`): ID of the mine where the material is available.
* `availability_status` (Boolean): Indicates whether the material is currently available.
* `stock_quantity` (Decimal): Current stock quantity of the material.

## 📥 Request (Truck Owner Requesting Material from a Mine)

Represents a request from a truck owner for material from a mine.

**Fields:**

* `mine_id` (ObjectID, ref: `Mine`): ID of the mine the request is for.
* `material_id` (ObjectID, ref: `Material`): ID of the requested material.
* `truck_owner_id` (ObjectID, ref: `User`): ID of the truck owner making the request.
* `truck_id` (ObjectID, ref: `Truck`, optional): ID of the truck used for the request (if provided by the truck owner).
* `status` (Enum: `pending`, `accepted`, `rejected`): Status of the request.
* `pickup_schedule` (Object: `{ date: Date, time: Time }`): Scheduled pickup date and time.
* `amount` (Decimal): Requested amount of material.

## 🚛 Truck (Owned by Truck Owner)

Represents a truck owned by a truck owner.

**Fields:**

* `truck_owner_id` (ObjectID, ref: `User`): ID of the truck owner.
* `driver_id` (ObjectID, ref: `User`, where `role` is `driver`): ID of the assigned driver.
* `current_location` (String): Current location of the truck.
* `status` (Enum: `idle`, `on_trip`, `unavailable`): Current status of the truck.
* `assigned_trip_id` (ObjectID, ref: `Trip`, optional): ID of the assigned trip.

## 📦 Trip (Delivery Assigned to Truck)

Represents a delivery trip assigned to a truck.

**Fields:**

* `truck_id` (ObjectID, ref: `Truck`): ID of the assigned truck.
* `driver_id` (ObjectID, ref: `User`): ID of the assigned driver.
* `mine_id` (ObjectID, ref: `Mine`): ID of the mine for pickup.
* `pickup_time` (DateTime): Scheduled pickup time.
* `dropoff_location` (String): Drop-off location.
* `current_milestone` (Enum: `at_mine`, `on_route`, `delivered`): Current milestone of the trip.
* `qr_code` (String): QR code generated for verification.
* `verified_by_mine_owner` (Boolean): Indicates whether the trip has been verified by the mine owner.