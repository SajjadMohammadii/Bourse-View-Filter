import type { ProfileDef } from '../../core/scoring/types';
import { technicalProfile } from './technical';
import { fundamentalLongProfile } from './fundamentalLong';
import { fundamentalQuarterlyProfile } from './fundamentalQuarterly';
import { fundamentalMonthlyProfile } from './fundamentalMonthly';

/** Registered profiles, in display order. Add a profile file here and its page is generated. */
export const profiles: readonly ProfileDef[] = [
  technicalProfile,
  fundamentalLongProfile,
  fundamentalQuarterlyProfile,
  fundamentalMonthlyProfile,
];

export const profileById = (id: string): ProfileDef | undefined => profiles.find((p) => p.id === id);
