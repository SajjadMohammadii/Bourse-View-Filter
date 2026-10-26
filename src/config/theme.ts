/**
 * Chart palette, kept in sync with ui/styles/tokens.css (PLAN.md §12.1).
 * The categorical order was validated with the dataviz palette validator against --surface-1
 * (#0C1730): all adjacent-pair checks pass. For scatter plots (all pairs) use at most 3 slots
 * and fold the rest into `other`.
 */
export const chartTheme = {
  surface: '#0C1730',
  surface2: '#112042',
  border: '#22396B',
  grid: '#172A50',
  text: '#E6EEF8',
  textMuted: '#93A6C4',
  textFaint: '#7B8EB0',
  font: 'Vazirmatn, system-ui, sans-serif',
  categorical: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  other: '#5F7397',
  sequential: ['#0C1730', '#1E3A8A', '#3B82F6', '#14B8A6', '#2DD4BF'],
  diverging: ['#F06A7A', '#112042', '#2DD4BF'],
  positive: '#2DD4BF',
  negative: '#F06A7A',
  warning: '#F2B85B',
  accent: '#2DD4BF',
  grades: { A: '#2DD4BF', B: '#3B82F6', C: '#7C8DB0', D: '#C77D9A', E: '#F06A7A' } as Record<string, string>,
  /** Market-risk regimes (status colors; always shown with a text label). */
  regimes: { low: '#2DD4BF', balanced: '#3B82F6', high: '#F2B85B', critical: '#F06A7A' } as Record<
    string,
    string
  >,
};

/** Max categorical slots in scatter plots before folding into "other". */
export const SCATTER_MAX_GROUPS = 3;
