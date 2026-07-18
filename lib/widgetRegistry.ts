import {
  RevenueTrendWidget,
  AgingSummaryWidget,
  TopCustomersWidget,
  TopSuppliersWidget,
  CashBalanceWidget,
  ProfitSnapshotWidget,
  RecentTransactionsWidget,
} from '@/components/accounting/DashboardWidgets'

export type WidgetType = 'revenue_trend' | 'aging_summary' | 'top_customers' | 'top_suppliers' | 'cash_balance' | 'profit_snapshot' | 'recent_transactions'

export const WIDGET_REGISTRY: Record<WidgetType, { label: string; component: any; defaultW: number; defaultH: number }> = {
  revenue_trend: { label: 'Revenue & Expense Trend', component: RevenueTrendWidget, defaultW: 8, defaultH: 8 },
  aging_summary: { label: 'Debtors vs Payables Aging', component: AgingSummaryWidget, defaultW: 6, defaultH: 8 },
  top_customers: { label: 'Top Customers by Amount Owed', component: TopCustomersWidget, defaultW: 6, defaultH: 8 },
  top_suppliers: { label: 'Top Suppliers by Amount Owed', component: TopSuppliersWidget, defaultW: 6, defaultH: 8 },
  cash_balance: { label: 'Cash Balance', component: CashBalanceWidget, defaultW: 4, defaultH: 6 },
  profit_snapshot: { label: "This Month's Profit", component: ProfitSnapshotWidget, defaultW: 4, defaultH: 6 },
  recent_transactions: { label: 'Recent Activity', component: RecentTransactionsWidget, defaultW: 4, defaultH: 8 },
}

export const DEFAULT_WIDGETS: { widget_type: WidgetType; x: number; y: number; w: number; h: number }[] = [
  { widget_type: 'profit_snapshot', x: 0, y: 0, w: 4, h: 6 },
  { widget_type: 'cash_balance', x: 4, y: 0, w: 4, h: 6 },
  { widget_type: 'recent_transactions', x: 8, y: 0, w: 4, h: 8 },
  { widget_type: 'revenue_trend', x: 0, y: 6, w: 8, h: 8 },
  { widget_type: 'aging_summary', x: 0, y: 14, w: 6, h: 8 },
  { widget_type: 'top_customers', x: 6, y: 14, w: 6, h: 8 },
]
