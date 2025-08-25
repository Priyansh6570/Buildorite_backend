import express from "express";
import {
  createMine,
  getAllMines,
  getMineById,
  deleteMine,
  updateMine,
  getMyMines,
  getMineAndMaterialCount,
  getTruckOwnerDriverStats,
  getGlobalMineAndMaterialCount
} from "../controllers/mineController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router
  .route("/mine")
  .get(protect, getAllMines)
  .post(protect, authorizeRoles("mine_owner"), createMine);
router.route("/my-mines").get(protect, getMyMines);

router.route("/count").get(protect, getMineAndMaterialCount);

router.route("/truckstats").get(protect, getTruckOwnerDriverStats);

router.route("/global-count").get(protect, getGlobalMineAndMaterialCount);

router
  .route("/mine/:id")
  .get(getMineById)
  .put(protect, authorizeRoles("mine_owner"), updateMine)
  .delete(protect, authorizeRoles("mine_owner"), deleteMine);

export default router;
