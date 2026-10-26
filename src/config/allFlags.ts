import type { FlagDef } from '../core/scoring/types';
import { monthlyFlags, quarterlyFlags, technicalFlags } from './flags';

/** Every flag evaluated by the pipeline. */
export const allFlags: readonly FlagDef[] = [...technicalFlags, ...quarterlyFlags, ...monthlyFlags];
