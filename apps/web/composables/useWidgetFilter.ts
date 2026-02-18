import type { DashboardFilter } from '~/components/dashboard/GlobalFilter.vue';

/**
 * Converts a DashboardFilter (date range + extra fields) into the API filter array
 * format expected by POST /data/query.
 *
 * @param config - Widget config (checked for dateColumn / xAxis)
 * @param globalFilter - Current global filter state
 * @returns Array of { column, operator, value } filter conditions
 */
export function useWidgetFilter(
  config: Ref<any>,
  globalFilter: Ref<DashboardFilter | undefined | null>,
) {
  return computed(() => {
    const filters: Array<{ column: string; operator: string; value: unknown }> = [];
    const gf = globalFilter.value;
    if (!gf) return filters;

    // Date range — applies to dateColumn (Timeline) or xAxis (Chart)
    const dateCol: string | undefined = config.value?.dateColumn || config.value?.xAxis;
    if (dateCol) {
      if (gf.dateFrom) filters.push({ column: dateCol, operator: 'gte', value: gf.dateFrom });
      if (gf.dateTo) filters.push({ column: dateCol, operator: 'lte', value: gf.dateTo });
    }

    // Extra text filters: { columnName → containsValue }
    for (const [col, val] of Object.entries(gf.extra || {})) {
      if (val && col) filters.push({ column: col, operator: 'contains', value: val });
    }

    return filters;
  });
}
