import type { Assumptions } from '../core/metrics/types';
import type { ScoringOptions } from '../core/scoring/types';
import type { WeightingMode } from '../core/market/types';
import type { FormatOptions } from '../core/utils/format';
import { defaultAssumptions, thresholds } from '../config/assumptions';
import { defaultScoringOptions, scoringConfig } from '../config/scoring';
import { db, safe } from './persistence/db';

export interface AppSettings {
  assumptions: Assumptions;
  thresholds: { illiquidAvgValue: number; staleStatementDays: number };
  scoring: ScoringOptions;
  /** profileId → selected weight preset id ('custom' when edited). */
  presetByProfile: Record<string, string>;
  display: FormatOptions;
  marketRiskMode: WeightingMode;
  historyRetention: number;
}

export const defaultSettings: AppSettings = {
  assumptions: { ...defaultAssumptions },
  thresholds: {
    illiquidAvgValue: thresholds.illiquidAvgValue,
    staleStatementDays: thresholds.staleStatementDays,
  },
  scoring: { ...defaultScoringOptions, compositeWeights: { ...scoringConfig.compositeWeights } },
  presetByProfile: {},
  display: { moneyUnit: 'hemat', digits: 'fa' },
  marketRiskMode: 'equal',
  historyRetention: 250,
};

const KEY = 'settings';

/** Deep-ish merge so settings saved by older versions gain new defaults. */
export function mergeSettings(saved: Partial<AppSettings> | undefined): AppSettings {
  if (!saved) return structuredClone(defaultSettings);
  return {
    ...defaultSettings,
    ...saved,
    assumptions: { ...defaultSettings.assumptions, ...saved.assumptions },
    thresholds: { ...defaultSettings.thresholds, ...saved.thresholds },
    scoring: { ...defaultSettings.scoring, ...saved.scoring },
    display: { ...defaultSettings.display, ...saved.display },
  };
}

export const settingsRepo = {
  load: () =>
    safe(
      async () => mergeSettings((await (await db()).get('kv', KEY)) as Partial<AppSettings> | undefined),
      structuredClone(defaultSettings),
    ),
  save: (s: AppSettings) => safe(async () => void (await (await db()).put('kv', s, KEY)), undefined),
};
