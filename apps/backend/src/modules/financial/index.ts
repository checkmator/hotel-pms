import { FastifyInstance } from 'fastify';
import { supplierRoutes } from './shared/suppliers.routes';
import { costCenterRoutes } from './shared/cost-centers.routes';
import { apRoutes } from './accounts-payable/ap.routes';
import { arRoutes } from './accounts-receivable/ar.routes';
import { financialDashboardRoutes } from './shared/dashboard.routes';
import { recurrenceRoutes } from './shared/recurrences.routes';
import { reconciliationRoutes } from './shared/reconciliation.routes';

export async function financialRoutes(app: FastifyInstance) {
  await supplierRoutes(app);
  await costCenterRoutes(app);
  await apRoutes(app);
  await arRoutes(app);
  await financialDashboardRoutes(app);
  await recurrenceRoutes(app);
  await reconciliationRoutes(app);
}
