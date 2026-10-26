import { h, replace } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { Page, PageContext } from '../../page';
import type { App, AppState } from '../../../app/appState';
import type { PeerMode } from '../../../core/scoring/types';
import type { WeightingMode } from '../../../core/market/types';
import type { MoneyUnit, DigitStyle } from '../../../core/utils/format';
import { RIAL_PER_BILLION_TOMAN } from '../../../core/utils/format';
import { formatDate } from '../../../core/utils/format';
import { profiles } from '../../../config/profiles';
import { card } from '../page-helpers';
import { numberField, pctIn, segField, toggleField } from './controls';
import { profileEditor } from './profile-editor';
import { toast } from '../../components/toast';
import { downloadText, pickTextFile } from '../../../app/services/exportService';
import {
  clearAllData,
  clearHistory,
  deleteSnapshot,
  exportBundle,
  importBundle,
  importHistory,
} from '../../../app/settingsActions';
import { fv } from '../../format';

const t = fa.settings;
const openEditors = new Set<string>();

/** Settings (PLAN.md §12.3-ح). Works without a loaded file. */
export function createSettingsPage(ctx: PageContext): Page {
  const root = h('div', { class: 'page' });
  let unsub: (() => void) | null = null;
  const draw = (s: AppState) => replace(root, h('h1', { text: t.title }), ...sections(ctx.app, s));
  return {
    title: t.title,
    mount(el) {
      el.append(root);
      draw(ctx.app.store.get());
      unsub = ctx.app.store.subscribe((s, prev) => {
        if (
          s.settings !== prev.settings ||
          s.history !== prev.history ||
          s.customMetrics !== prev.customMetrics
        )
          draw(s);
      });
    },
    unmount() {
      unsub?.();
    },
  };
}

function sections(app: App, s: AppState): HTMLElement[] {
  return [
    h('div', { class: 'grid grid-2' }, assumptionsCard(app, s), scoringCard(app, s)),
    h('div', { class: 'grid grid-2' }, displayCard(app, s), backupCard(app)),
    historyCard(app, s),
    editorsCard(app),
  ];
}

function assumptionsCard(app: App, s: AppState): HTMLElement {
  const a = s.settings.assumptions;
  const th = s.settings.thresholds;
  const sc = s.settings.scoring;
  return card(
    t.assumptions,
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' },
      numberField(
        t.inflation,
        pctIn(a.inflation),
        (v) => app.updateSettings({ assumptions: { ...a, inflation: v / 100 } }),
        { min: 0, max: 500 },
      ),
      numberField(
        t.riskFree,
        pctIn(a.riskFreeRate),
        (v) => app.updateSettings({ assumptions: { ...a, riskFreeRate: v / 100 } }),
        { min: 0, max: 200 },
      ),
      numberField(
        t.illiquid,
        th.illiquidAvgValue / RIAL_PER_BILLION_TOMAN,
        (v) => app.updateSettings({ thresholds: { ...th, illiquidAvgValue: v * RIAL_PER_BILLION_TOMAN } }),
        { min: 0 },
      ),
      numberField(
        t.staleDays,
        th.staleStatementDays,
        (v) => app.updateSettings({ thresholds: { ...th, staleStatementDays: v } }),
        { min: 1, step: 1 },
      ),
    ),
    h(
      'div',
      { class: 'stack', style: 'gap:6px;margin-top:12px' },
      toggleField(t.stalePenalty, sc.stalePenalty, (v) =>
        app.updateSettings({ scoring: { ...sc, stalePenalty: v } }),
      ),
      toggleField(t.seasonality, !!sc.seasonality, (v) =>
        app.updateSettings({ scoring: { ...sc, seasonality: v } }),
      ),
    ),
  );
}

function scoringCard(app: App, s: AppState): HTMLElement {
  const sc = s.settings.scoring;
  const weights = sc.compositeWeights ?? {};
  const peer: Array<[PeerMode, string]> = [
    ['default', fa.profile.peerDefault],
    ['market', fa.profile.peerMarket],
    ['industry', fa.profile.peerIndustry],
    ['blend', fa.profile.peerBlend],
  ];
  return card(
    t.scoring,
    segField(t.peerMode, peer, sc.peerMode, (v) => app.updateSettings({ scoring: { ...sc, peerMode: v } })),
    h('h3', { style: 'margin-top:12px', text: t.composite }),
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(160px,1fr))' },
      profiles.map((p) =>
        numberField(
          p.label,
          pctIn(weights[p.id] ?? 0),
          (v) =>
            app.updateSettings({ scoring: { ...sc, compositeWeights: { ...weights, [p.id]: v / 100 } } }),
          { min: 0, max: 100 },
        ),
      ),
    ),
  );
}

function displayCard(app: App, s: AppState): HTMLElement {
  const d = s.settings.display;
  const money: Array<[MoneyUnit, string]> = [
    ['hemat', t.hemat],
    ['billionToman', t.billionToman],
    ['rial', t.rial],
  ];
  const digits: Array<[DigitStyle, string]> = [
    ['fa', t.digitsFa],
    ['latin', t.digitsLatin],
  ];
  const modes: Array<[WeightingMode, string]> = [
    ['equal', fa.risk.equal],
    ['cap', fa.risk.cap],
    ['sqrtCap', fa.risk.sqrtCap],
  ];
  return card(
    t.display,
    h(
      'div',
      { class: 'stack' },
      segField(t.moneyUnit, money, d.moneyUnit, (v) =>
        app.updateSettings({ display: { ...d, moneyUnit: v } }, false),
      ),
      segField(t.digits, digits, d.digits, (v) =>
        app.updateSettings({ display: { ...d, digits: v } }, false),
      ),
      segField(t.riskMode, modes, s.settings.marketRiskMode, (v) =>
        app.updateSettings({ marketRiskMode: v }, false),
      ),
    ),
  );
}

function backupCard(app: App): HTMLElement {
  return card(
    t.backup,
    h(
      'div',
      { class: 'row' },
      h('button', {
        class: 'btn',
        text: t.exportAll,
        on: { click: () => downloadText(exportBundle(app), 'bourse-view-settings.json') },
      }),
      h('button', {
        class: 'btn',
        text: t.importAll,
        on: {
          click: () =>
            void pickTextFile().then(async (text) => {
              if (!text) return;
              const r = await importBundle(app, text);
              toast(r.ok ? t.imported : r.error.message, r.ok ? 'ok' : 'error');
            }),
        },
      }),
      h('button', {
        class: 'btn danger',
        text: t.clearAll,
        on: {
          click: () => {
            if (!window.confirm(t.confirmClearAll)) return;
            void clearAllData().then(() => location.reload());
          },
        },
      }),
    ),
  );
}

function historyCard(app: App, s: AppState): HTMLElement {
  const rows = [...s.history].sort((a, b) => b.key.localeCompare(a.key));
  const retention = numberField(
    t.retention,
    s.settings.historyRetention,
    (v) => app.updateSettings({ historyRetention: Math.max(1, Math.round(v)) }, false),
    { min: 1, step: 1 },
  );
  const actions = h(
    'div',
    { class: 'row' },
    retention,
    h('button', {
      class: 'btn',
      text: t.exportHistory,
      on: {
        click: () =>
          void app.history.exportAll().then((txt) => downloadText(txt, 'bourse-view-history.json')),
      },
    }),
    h('button', {
      class: 'btn',
      text: t.importHistory,
      on: {
        click: () =>
          void pickTextFile().then(async (text) => {
            if (!text) return;
            const r = await importHistory(app, text);
            toast(r.ok ? fa.studio.imported(r.value) : r.error.message, r.ok ? 'ok' : 'error');
          }),
      },
    }),
    rows.length
      ? h('button', {
          class: 'btn danger',
          text: t.clearHistory,
          on: {
            click: () => {
              if (window.confirm(t.confirmClearHistory)) void clearHistory(app);
            },
          },
        })
      : null,
  );
  const table = rows.length
    ? h(
        'table',
        { class: 'simple-table' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            [t.snapshotDate, t.snapshotCount, t.snapshotRisk, ''].map((x) => h('th', { text: x })),
          ),
        ),
        h(
          'tbody',
          {},
          rows.map((m) =>
            h(
              'tr',
              {},
              h('td', {}, h('bdi', { class: 'num', text: formatDate(m.date, s.settings.display) })),
              h('td', {}, h('bdi', { class: 'num', text: fv(m.count, 'rank') })),
              h(
                'td',
                {},
                h('bdi', {
                  class: 'num',
                  text: fv(m.marketRisk[s.settings.marketRiskMode]?.thermometer ?? NaN, 'rank'),
                }),
              ),
              h(
                'td',
                {},
                h('button', {
                  class: 'btn sm ghost',
                  text: t.deleteSnapshot,
                  on: { click: () => void deleteSnapshot(app, m.key) },
                }),
              ),
            ),
          ),
        ),
      )
    : h('p', { class: 'muted', text: t.noHistory });
  return card(`${t.history} — ${fa.history.count(rows.length)}`, actions, table);
}

function editorsCard(app: App): HTMLElement {
  return card(
    t.profileEditor,
    h('p', { class: 'muted', text: t.profileEditorHint }),
    profiles.map((p) => {
      const el = profileEditor(app, p);
      el.dataset['profile'] = p.id;
      if (openEditors.has(p.id)) el.setAttribute('open', '');
      el.addEventListener('toggle', () =>
        (el as HTMLDetailsElement).open ? openEditors.add(p.id) : openEditors.delete(p.id),
      );
      return el;
    }),
  );
}
