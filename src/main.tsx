import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { init } from './store';
import './styles/app.css';

void init();
render(<App />, document.getElementById('app')!);

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
