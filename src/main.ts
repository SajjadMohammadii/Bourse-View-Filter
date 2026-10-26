import './ui/styles/fonts.css';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/components.css';
import { Shell } from './ui/shell';

const root = document.getElementById('app');
if (root) new Shell().mount(root);
