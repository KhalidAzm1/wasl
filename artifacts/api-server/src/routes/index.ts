import { Router, type IRouter } from "express";
import healthRouter from "./health";
import banksRouter from "./banks";
import productsRouter from "./products";
import meetingsRouter from "./meetings";
import risksRouter from "./risks";
import actionItemsRouter from "./action-items";
import documentsRouter from "./documents";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import adminUsersRouter from "./admin-users";
import productTypesRouter from "./product-types";
import auditLogsRouter from "./audit-logs";
import archiveRouter from "./archive";
import systemRouter from "./system";
import implementationRouter from "./implementation";
import implementationV2Router from "./implementation-v2";
import adminPerfRouter from "./admin-perf";
import aiChatRouter from "./ai-chat";
import productStagesRouter from "./product-stages";
import quickUpdateRouter from "./quick-update";
import eventsRouter from "./events";
import authRouter from "./auth";

const router: IRouter = Router();

// ── Public routes (no auth) — must come BEFORE any secured router
// because secured routers use router.use(requireAuth) which intercepts
// every unauthenticated request regardless of path.
router.use(authRouter);       // forgot-password (Resend)
router.use(eventsRouter);
router.use(quickUpdateRouter);

router.use(healthRouter);
router.use(banksRouter);
router.use(productsRouter);
router.use(productTypesRouter);
router.use(meetingsRouter);
router.use(risksRouter);
router.use(actionItemsRouter);
router.use(documentsRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(adminUsersRouter);
router.use(auditLogsRouter);
router.use(archiveRouter);
router.use(systemRouter);
router.use(implementationRouter);
router.use(implementationV2Router);
router.use(adminPerfRouter);
router.use(aiChatRouter);
router.use(productStagesRouter);

export default router;
