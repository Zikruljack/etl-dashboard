import { assertFound } from '../../core/errors.js';
import {
  dashboardRepository,
  pageRepository,
  componentRepository,
  type DashboardRecord,
  type DashboardFull,
  type PageRecord,
  type ComponentRecord,
} from './dashboard.repository.js';

/**
 * Create a new dashboard with a default first page.
 *
 * @param title - Dashboard title
 * @param createdBy - UUID of the creating user
 * @param description - Optional description
 * @returns Dashboard with first page (empty components)
 */
export async function createDashboard(
  title: string,
  createdBy: string,
  description?: string,
): Promise<DashboardFull> {
  const dashboard = await dashboardRepository.create({
    title,
    description: description || null,
    createdBy,
  });

  const page = await pageRepository.create({
    dashboardId: dashboard.id,
    title: 'Page 1',
    sortOrder: 0,
  });

  return { ...dashboard, pages: [{ ...page, components: [] }] };
}

/**
 * List all dashboard.
 *
 * @returns Array of all dashboard ordered by creation date
 */
export async function listdashboard(): Promise<DashboardRecord[]> {
  return dashboardRepository.findAllOrdered();
}

/**
 * Get a dashboard with all pages and components.
 *
 * @param id - Dashboard UUID
 * @returns Full dashboard with pages and components
 * @throws AppError(404) if not found
 */
export async function getDashboard(id: string): Promise<DashboardFull> {
  const dashboard = await dashboardRepository.findFullById(id);
  assertFound(dashboard, 'Dashboard not found');
  return dashboard;
}

/**
 * Update dashboard metadata (title, description, published status).
 *
 * @param id - Dashboard UUID
 * @param data - Fields to update
 * @returns Updated dashboard
 * @throws AppError(404) if not found
 */
export async function updateDashboard(
  id: string,
  data: Partial<{ title: string; description: string; isPublished: boolean }>,
): Promise<DashboardRecord> {
  const dashboard = await dashboardRepository.update(id, { ...data, updatedAt: new Date() } as any);
  assertFound(dashboard, 'Dashboard not found');
  return dashboard;
}

/**
 * Delete a dashboard and all associated pages/components (cascade).
 *
 * @param id - Dashboard UUID
 * @throws AppError(404) if not found
 */
export async function deleteDashboard(id: string): Promise<void> {
  const dashboard = await dashboardRepository.delete(id);
  assertFound(dashboard, 'Dashboard not found');
}

/**
 * Add a new page to a dashboard.
 *
 * @param dashboardId - Parent dashboard UUID
 * @param title - Page title
 * @returns Newly created page with empty components array
 */
export async function addPage(dashboardId: string, title: string) {
  const count = await pageRepository.countByDashboard(dashboardId);
  const page = await pageRepository.create({
    dashboardId,
    title,
    sortOrder: count,
  });
  return { ...page, components: [] as ComponentRecord[] };
}

/**
 * Update a page's title or sort order.
 *
 * @param pageId - Page UUID
 * @param data - Fields to update
 * @returns Updated page
 * @throws AppError(404) if not found
 */
export async function updatePage(
  pageId: string,
  data: Partial<{ title: string; sortOrder: number }>,
): Promise<PageRecord> {
  const page = await pageRepository.update(pageId, { ...data, updatedAt: new Date() } as any);
  assertFound(page, 'Page not found');
  return page;
}

/**
 * Delete a dashboard page and its components (cascade).
 *
 * @param pageId - Page UUID
 * @throws AppError(404) if not found
 */
export async function deletePage(pageId: string): Promise<void> {
  const page = await pageRepository.delete(pageId);
  assertFound(page, 'Page not found');
}

/**
 * Bulk save components for a page.
 * Replaces all existing components with the provided list.
 *
 * @param pageId - Page UUID
 * @param components - Array of component data
 * @returns Array of saved components
 */
export async function saveComponents(
  pageId: string,
  components: Array<{
    type: 'table' | 'chart' | 'map' | 'timeline' | 'kpi';
    title?: string;
    layout: { x: number; y: number; w: number; h: number };
    config: Record<string, unknown>;
    datasetId?: string;
  }>,
): Promise<ComponentRecord[]> {
  return componentRepository.bulkSave(
    pageId,
    components.map((c) => ({
      type: c.type,
      title: c.title || null,
      layout: c.layout,
      config: c.config,
      datasetId: c.datasetId || null,
    })),
  );
}
