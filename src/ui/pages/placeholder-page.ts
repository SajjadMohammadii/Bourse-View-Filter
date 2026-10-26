import { h } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page } from '../page';

export function createPlaceholderPage(title: string): Page {
  return {
    title,
    mount(root) {
      root.append(
        h(
          'div',
          { class: 'page' },
          h('h1', { text: title }),
          h('div', { class: 'card empty', text: fa.app.comingSoon }),
        ),
      );
    },
  };
}
