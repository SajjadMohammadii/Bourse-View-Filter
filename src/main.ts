import './ui/styles/fonts.css';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/components.css';
import { Shell } from './ui/shell';
import { App } from './app/appState';

const root = document.getElementById('app');
if (root) {
  const app = new App();
  void app.init().then(() => {
    new Shell(app).mount(root);
    void app.restoreLastFile();
  });
}
