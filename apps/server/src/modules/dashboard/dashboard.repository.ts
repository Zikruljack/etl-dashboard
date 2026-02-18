import { eq, asc } from 'drizzle-orm';
import { dashboard, dashboardPages, dashboardComponents } from '../../db/schema/index.js';
import { BaseRepository } from '../../core/base.repository.js';
import { db } from '../../config/database.js';

/** Dashboard record type */
export type DashboardRecord = typeof dashboard.$inferSelect;

/** Dashboard insert type */
export type DashboardInsert = typeof dashboard.$inferInsert;

/** Dashboard page record type */
export type PageRecord = typeof dashboardPages.$inferSelect;

/** Dashboard page insert type */
export type PageInsert = typeof dashboardPages.$inferInsert;

/** Component record type */
export type ComponentRecord = typeof dashboardComponents.$inferSelect;

/** Component insert type */
export type ComponentInsert = typeof dashboardComponents.$inferInsert;

/** Dashboard with nested pages and components */
export interface DashboardFull extends DashboardRecord {
  pages: Array<PageRecord & { components: ComponentRecord[] }>;
}

/**
 * Repository for dashboard metadata.
 */
class DashboardRepository extends BaseRepository<typeof dashboard, DashboardRecord, DashboardInsert> {
  constructor() {
    super(dashboard, 'dashboard');
  }

  /**
   * List all dashboard ordered by creation date.
   *
   * @returns Array of all dashboard
   */
  async findAllOrdered(): Promise<DashboardRecord[]> {
    return this.findAll(dashboard.createdAt);
  }

  /**
   * Get a dashboard with all pages and components.
   *
   * @param id - Dashboard UUID
   * @returns Full dashboard with pages and components, or null
   */
  async findFullById(id: string): Promise<DashboardFull | null> {
    const dashboard = await this.findById(id);
    if (!dashboard) return null;

    const pages = await this.db.select()
      .from(dashboardPages)
      .where(eq(dashboardPages.dashboardId, id))
      .orderBy(asc(dashboardPages.sortOrder));

    const pagesWithComponents = await Promise.all(
      pages.map(async (page) => {
        const components = await this.db.select()
          .from(dashboardComponents)
          .where(eq(dashboardComponents.pageId, page.id));
        return { ...page, components };
      }),
    );

    return { ...dashboard, pages: pagesWithComponents };
  }
}

/**
 * Repository for dashboard pages.
 */
class PageRepository extends BaseRepository<typeof dashboardPages, PageRecord, PageInsert> {
  constructor() {
    super(dashboardPages, 'dashboard_pages');
  }

  /**
   * Count pages for a dashboard (for sort order calculation).
   *
   * @param dashboardId - Parent dashboard UUID
   * @returns Number of pages
   */
  async countByDashboard(dashboardId: string): Promise<number> {
    return this.count(eq(dashboardPages.dashboardId, dashboardId));
  }
}

/**
 * Repository for dashboard components (widgets).
 */
class ComponentRepository extends BaseRepository<typeof dashboardComponents, ComponentRecord, ComponentInsert> {
  constructor() {
    super(dashboardComponents, 'dashboard_components');
  }

  /**
   * Delete all components for a page (before bulk save).
   *
   * @param pageId - Parent page UUID
   */
  async deleteByPage(pageId: string): Promise<void> {
    await this.deleteWhere(eq(dashboardComponents.pageId, pageId));
  }

  /**
   * Bulk save components for a page within a transaction.
   * Deletes existing components then inserts new ones atomically —
   * if insert fails, delete is rolled back to prevent data loss.
   *
   * @param pageId - Parent page UUID
   * @param components - Array of components to save
   * @returns Array of saved components
   */
  async bulkSave(pageId: string, components: Omit<ComponentInsert, 'pageId'>[]): Promise<ComponentRecord[]> {
    return db.transaction(async (tx) => {
      await tx.delete(dashboardComponents).where(eq(dashboardComponents.pageId, pageId));

      if (components.length === 0) return [];

      return tx
        .insert(dashboardComponents)
        .values(components.map((c) => ({ ...c, pageId }) as ComponentInsert))
        .returning();
    });
  }
}

/** Singleton instances */
export const dashboardRepository = new DashboardRepository();
export const pageRepository = new PageRepository();
export const componentRepository = new ComponentRepository();
