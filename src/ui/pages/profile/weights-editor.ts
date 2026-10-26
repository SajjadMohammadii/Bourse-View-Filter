import { h, replace } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { ProfileDef } from '../../../core/scoring/types';
import type { App } from '../../../app/appState';
import { fv } from '../../format';

const CUSTOM = 'custom';
const TOTAL = 100;

/** Current weights of a profile: user-edited, otherwise the profile defaults. */
export function currentWeights(app: App, p: ProfileDef): Record<string, number> {
  const saved = app.store.get().settings.scoring.factorWeights?.[p.id];
  return Object.fromEntries(p.factors.map((f) => [f.id, saved?.[f.id] ?? f.weight]));
}

/**
 * Rescales the other weights proportionally so the total stays 100 (PLAN.md §12.3-ب).
 */
export function rebalance(
  weights: Record<string, number>,
  changed: string,
  value: number,
): Record<string, number> {
  const v = Math.min(TOTAL, Math.max(0, value));
  const others = Object.keys(weights).filter((k) => k !== changed);
  const otherSum = others.reduce((a, k) => a + (weights[k] ?? 0), 0);
  const remaining = TOTAL - v;
  const out: Record<string, number> = { [changed]: v };
  for (const k of others) {
    out[k] = otherSum > 0 ? ((weights[k] ?? 0) / otherSum) * remaining : remaining / others.length;
  }
  return Object.fromEntries(Object.entries(out).map(([k, w]) => [k, Math.round(w * 10) / 10]));
}

function save(app: App, p: ProfileDef, weights: Record<string, number>, preset: string): void {
  const s = app.store.get().settings;
  app.updateSettings({
    scoring: { ...s.scoring, factorWeights: { ...s.scoring.factorWeights, [p.id]: weights } },
    presetByProfile: { ...s.presetByProfile, [p.id]: preset },
  });
}

export function presetSelect(app: App, p: ProfileDef): HTMLSelectElement {
  const selected = app.store.get().settings.presetByProfile[p.id] ?? 'balanced';
  const select = h(
    'select',
    { class: 'select', attrs: { 'aria-label': fa.profile.preset } },
    Object.entries(p.weightPresets).map(([id, preset]) =>
      h('option', { attrs: { value: id, selected: id === selected }, text: preset.label }),
    ),
    h('option', {
      attrs: { value: CUSTOM, selected: selected === CUSTOM, disabled: selected !== CUSTOM },
      text: fa.profile.custom,
    }),
  );
  select.addEventListener('change', () => {
    const preset = p.weightPresets[select.value];
    if (preset) save(app, p, { ...preset.weights }, select.value);
  });
  return select;
}

/** Sliders per factor; the total is kept at 100 automatically. */
export function weightsEditor(app: App, p: ProfileDef): HTMLElement {
  let weights = currentWeights(app, p);
  const rows = h('div', { class: 'grid', style: 'gap:6px' });
  const draw = () =>
    replace(
      rows,
      p.factors.map((f) => {
        const out = h('bdi', {
          class: 'num',
          style: 'width:48px',
          text: `${fv(weights[f.id] ?? 0, 'number')}٪`,
        });
        const slider = h('input', {
          attrs: {
            type: 'range',
            min: 0,
            max: 60,
            step: 1,
            value: weights[f.id] ?? 0,
            'aria-label': f.label,
          },
          style: 'flex:1',
        });
        slider.addEventListener('input', () => (out.textContent = `${fv(Number(slider.value), 'number')}٪`));
        slider.addEventListener('change', () => {
          weights = rebalance(weights, f.id, Number(slider.value));
          save(app, p, weights, CUSTOM);
          draw();
        });
        return h(
          'label',
          { class: 'row', style: 'flex-wrap:nowrap' },
          h('span', { style: 'width:220px', text: `${f.id} ${f.label}` }),
          slider,
          out,
        );
      }),
    );
  draw();
  const reset = h('button', {
    class: 'btn sm',
    text: fa.profile.resetWeights,
    on: {
      click: () => {
        weights = Object.fromEntries(p.factors.map((f) => [f.id, f.weight]));
        save(app, p, weights, 'balanced');
        draw();
      },
    },
  });
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', { text: fa.profile.editWeights }), reset),
    rows,
  );
}
