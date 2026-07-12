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

const router: IRouter = Router();

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

export default router;
