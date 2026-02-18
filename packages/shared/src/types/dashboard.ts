export type ComponentType = 'table' | 'chart' | 'map' | 'timeline' | 'kpi';
export type ChartType = 'bar' | 'line' | 'pie';

export interface GridLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TableConfig {
  columns: string[];
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
}

export interface ChartConfig {
  chartType: ChartType;
  xAxis: string;
  yAxis: string;
  series?: string;
  colors?: string[];
}

export interface MapConfig {
  latitudeColumn: string;
  longitudeColumn: string;
  labelColumn?: string;
  popupColumns?: string[];
  center?: [number, number];
  zoom?: number;
}

/**
 * Configuration for a Timeline widget — a time-series chart using ECharts.
 *
 * Two modes:
 * - Dataset rows mode (default): smooth line chart; dateColumn on X, valueColumns as Y series.
 * - Change-history mode (useChangeHistory = true): stacked bar chart showing rows
 *   added / changed / deleted per time period from /datasets/:id/changes API.
 */
export interface TimelineConfig {
  /** Column whose values are used as the X axis (dataset rows mode). */
  dateColumn: string;
  /** Columns to plot as Y axis series — each becomes one line (dataset rows mode). */
  valueColumns: string[];
  /**
   * When true, visualise change history from the /changes API instead of dataset rows.
   * Shows a stacked bar chart of added/changed/deleted row counts per time period.
   */
  useChangeHistory?: boolean;
  /** How to group change timestamps: 'day' | 'week' | 'month'. Default: 'day'. */
  changeGroupBy?: 'day' | 'week' | 'month';
}

/** Trend direction for KPI widgets. */
export type KPITrend = 'up' | 'down' | 'neutral';

/**
 * Configuration for a KPI (Key Performance Indicator) widget.
 * Shows a large summary number with label, unit, and optional trend indicator.
 */
export interface KPIConfig {
  /** Column whose values are aggregated. */
  valueColumn: string;
  /** Aggregation function to apply. */
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  /** Unit label appended to the value (e.g. "jiwa", "%"). */
  unit?: string;
  /** Decimal places to display (default: 0). */
  decimals?: number;
  /** Whether higher value is good (up = green) or bad (up = red). */
  positiveDirection?: 'up' | 'down';
  /** Accent color for the KPI card. */
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange';
}

export type WidgetConfig = TableConfig | ChartConfig | MapConfig | TimelineConfig | KPIConfig;

export interface DashboardComponent {
  id: string;
  pageId: string;
  type: ComponentType;
  title: string | null;
  layout: GridLayout;
  config: WidgetConfig;
  datasetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPage {
  id: string;
  dashboardId: string;
  title: string;
  sortOrder: number;
  components: DashboardComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  createdBy: string;
  pages: DashboardPage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDashboardRequest {
  title: string;
  description?: string;
}

export interface CreatePageRequest {
  title: string;
}

export interface SaveComponentsRequest {
  components: Array<{
    id?: string;
    type: ComponentType;
    title?: string;
    layout: GridLayout;
    config: WidgetConfig;
    datasetId?: string;
  }>;
}
