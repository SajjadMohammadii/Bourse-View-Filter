import { fa } from '../i18n/fa';
import type { RouteDef } from './router';
import type { PageFactory } from './page';
import { createPlaceholderPage } from './pages/placeholder-page';
import { createDataHealthPage } from './pages/data-health-page';
import { createRawDataPage } from './pages/raw-data-page';
import { createOverviewPage } from './pages/overview-page';
import { createMarketRiskPage } from './pages/market-risk-page';
import { createProfilePage } from './pages/profile/profile-page';
import { profiles } from '../config/profiles';
import { createFilterStudioPage } from './pages/filter-studio-page';
import { createCustomMetricsPage } from './pages/custom-metrics-page';
import { createSettingsPage } from './pages/settings/settings-page';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  separatorBefore?: boolean;
  factory?: PageFactory;
}

const PROFILE_ICONS: Record<string, string> = {
  technical: '📈',
  fundamentalLong: '🏛',
  fundamentalQuarterly: '📊',
  fundamentalMonthly: '🗓',
};

/** One page per registered profile, generated from the shared ProfilePage (PLAN.md §16). */
const profileItems: NavItem[] = profiles.map((p) => ({
  path: `/profile/${p.id}`,
  label: p.label,
  icon: PROFILE_ICONS[p.id] ?? '◆',
  factory: (ctx) => createProfilePage(ctx, p),
}));

export const navItems: NavItem[] = [
  { path: '/overview', label: fa.nav.overview, icon: '◈', factory: createOverviewPage },
  ...profileItems.slice(0, 1),
  { path: '/market-risk', label: fa.nav.marketRisk, icon: '🌡', factory: createMarketRiskPage },
  ...profileItems.slice(1),
  {
    path: '/filter-studio',
    label: fa.nav.filterStudio,
    icon: '⚗',
    separatorBefore: true,
    factory: createFilterStudioPage,
  },
  { path: '/custom-metrics', label: fa.nav.customMetrics, icon: 'ƒ', factory: createCustomMetricsPage },
  { path: '/raw-data', label: fa.nav.rawData, icon: '▦', separatorBefore: true, factory: createRawDataPage },
  { path: '/data-health', label: fa.nav.dataHealth, icon: '✚', factory: createDataHealthPage },
  { path: '/settings', label: fa.nav.settings, icon: '⚙', factory: createSettingsPage },
];

export function buildRoutes(): RouteDef[] {
  return navItems.map((item) => ({
    path: item.path,
    factory: item.factory ?? (() => createPlaceholderPage(item.label)),
  }));
}

export const defaultRoute = '/overview';
