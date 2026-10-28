import { CompanionApp } from './components/companionApp';

const root = document.getElementById('root');
if (root) {
  const app = new CompanionApp(root);
  app.initialize();
}
