import { h } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { Dataset } from '../../../core/types';
import type { ProfileDef } from '../../../core/scoring/types';
import { datasetRows, type TableColumn, type TableRow } from '../../components/data-table';
import {
  activeFlags,
  confidenceText,
  deltaText,
  factorBar,
  flagChips,
  scoreBadge,
} from '../../components/score';

/** Flags shown per profile (technical flags on the technical page, etc.). */
export const profileFlags: Record<string, string[]> = {
  technical: ['goldenCross', 'breakout200', 'oversold', 'smartMoneyIn', 'illiquid'],
  fundamentalLong: ['staleStatement'],
  fundamentalQuarterly: ['turnaroundQ', 'marginBreakout', 'earningsSurprise', 'staleStatement', 'oneOffRisk'],
  fundamentalMonthly: ['recordMonth', 'monthlyTurn', 'cheapOnMonthly'],
};

export function profileRows(ds: Dataset, p: ProfileDef, indices: number[]): TableRow[] {
  const fields = [
    'Symbol',
    'Company',
    'Industry',
    `score.${p.id}`,
    `conf.${p.id}`,
    `rank.${p.id}`,
    `delta.score.${p.id}`,
    ...p.factors.map((f) => `factor.${p.id}.${f.id}`),
  ];
  return datasetRows(ds, fields, indices).map((r) => ({
    ...r,
    __flags: activeFlags(ds, r.__i, profileFlags[p.id]).join(','),
  }));
}

export function profileColumns(ds: Dataset, p: ProfileDef): TableColumn[] {
  const labels = p.factors.map((f) => `${f.id} ${f.label}`);
  const cols: TableColumn[] = [
    { id: `rank.${p.id}`, title: fa.score.rank, unit: 'rank', width: 64 },
    {
      id: 'Symbol',
      title: fa.profile.symbol,
      kind: 'text',
      render: (v) => h('b', { text: String(v ?? '') }),
    },
    { id: 'Company', title: fa.profile.company, kind: 'text', width: 180 },
    { id: 'Industry', title: fa.profile.industry, kind: 'text', width: 160 },
    {
      id: `score.${p.id}`,
      title: p.label,
      render: (v) => scoreBadge(v as number | null, p.ineligibleLabel ?? fa.score.insufficient),
    },
    {
      id: '__factors',
      title: fa.score.factors,
      kind: 'text',
      render: (_v, row) =>
        factorBar(
          p.factors.map((f) => row[`factor.${p.id}.${f.id}`] as number | null),
          labels,
        ),
    },
    {
      id: `conf.${p.id}`,
      title: fa.score.confidence,
      render: (v) => confidenceText((v as number | null) ?? NaN),
    },
    {
      id: '__flags',
      title: fa.score.flags,
      kind: 'text',
      render: (v) =>
        flagChips(
          String(v ?? '')
            .split(',')
            .filter(Boolean),
        ),
    },
  ];
  if (ds.num[`delta.score.${p.id}`]) {
    cols.push({
      id: `delta.score.${p.id}`,
      title: fa.score.delta,
      render: (v) => deltaText(v as number | null),
    });
  }
  for (const f of p.factors) {
    cols.push({
      id: `factor.${p.id}.${f.id}`,
      title: f.id,
      unit: 'score',
      tooltip: `${f.label}: ${f.description}`,
      width: 62,
    });
  }
  return cols;
}
