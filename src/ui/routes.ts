import { fa } from '../i18n/fa';
import type { RouteDef } from './router';
import { createPlaceholderPage } from './pages/placeholder-page';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  separatorBefore?: boolean;
}

export const navItems: NavItem[] = [
  { path: '/overview', label: fa.nav.overview, icon: '◈' },
  { path: '/technical', label: fa.nav.technical, icon: '📈' },
  { path: '/market-risk', label: fa.nav.marketRisk, icon: '🌡' },
  { path: '/fundamental-long', label: fa.nav.fundamentalLong, icon: '🏛' },
  { path: '/fundamental-quarterly', label: fa.nav.fundamentalQuarterly, icon: '📊' },
  { path: '/fundamental-monthly', label: fa.nav.fundamentalMonthly, icon: '🗓' },
  { path: '/filter-studio', label: fa.nav.filterStudio, icon: '⚗', separatorBefore: true },
  { path: '/custom-metrics', label: fa.nav.customMetrics, icon: 'ƒ' },
  { path: '/raw-data', label: fa.nav.rawData, icon: '▦', separatorBefore: true },
  { path: '/data-health', label: fa.nav.dataHealth, icon: '✚' },
  { path: '/settings', label: fa.nav.settings, icon: '⚙' },
];

export function buildRoutes(): RouteDef[] {
  return navItems.map((item) => ({ path: item.path, factory: () => createPlaceholderPage(item.label) }));
}

export const defaultRoute = '/overview';
