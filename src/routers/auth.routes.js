import { Router } from "express";
import { getMe, login, logout } from "../controllers/auth.controller.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.get("/auth/me", authenticate, getMe);
router.post("/auth/login", login);
router.post("/auth/logout", logout);

export default router;
