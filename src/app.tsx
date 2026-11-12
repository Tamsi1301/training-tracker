import { useEffect } from 'preact/hooks';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { NewPage } from './pages/NewPage';
import { SettingsPage } from './pages/SettingsPage';
import { applyTheme, loadError, ready, tab, theme, type Tab } from './store';
import { DialogHost, ToastHost } from './ui/components';
import { IconHistory, IconOverview, IconPlus, IconSettings } from './ui/icons';

const TABS: { id: Tab; label: string; icon: typeof IconOverview }[] = [
  { id: 'dashboard', label: 'Übersicht', icon: IconOverview },
  { id: 'verlauf', label: 'Verlauf', icon: IconHistory },
];
const TABS_RIGHT: { id: Tab; label: string; icon: typeof IconOverview }[] = [{ id: 'einstellungen', label: 'Einstellungen', icon: IconSettings }];

function TabButton({ id, label, icon: I }: { id: Tab; label: string; icon: typeof IconOverview }) {
  return (
    <button
      class="tab"
      aria-current={tab.value === id ? 'page' : undefined}
      onClick={() => {
        if (tab.value === id) window.scrollTo({ top: 0, behavior: 'smooth' });
        tab.value = id;
      }}
    >
      <I size={24} />
      <span>{label}</span>
    </button>
  );
}

export function App() {
  useEffect(() => {
    applyTheme(theme.value);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(theme.value);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [theme.value]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab.value]);

  if (!ready.value) return <div class="splash" aria-busy="true" />;

  return (
    <div class="app">
      {loadError.value && (
        <div class="page" style={{ paddingBottom: 0 }}>
          <div class="notice warn">{loadError.value}</div>
        </div>
      )}
      <main key={tab.value}>
        {tab.value === 'dashboard' && <DashboardPage />}
        {tab.value === 'neu' && <NewPage />}
        {tab.value === 'verlauf' && <HistoryPage />}
        {tab.value === 'einstellungen' && <SettingsPage />}
      </main>
      <nav class="tabbar" aria-label="Navigation">
        {TABS.map((t) => (
          <TabButton {...t} />
        ))}
        <button class="tab-new" aria-label="Neue Einheit" aria-current={tab.value === 'neu' ? 'page' : undefined} onClick={() => (tab.value = 'neu')}>
          <span>
            <IconPlus size={24} strokeWidth={2} />
          </span>
        </button>
        {TABS_RIGHT.map((t) => (
          <TabButton {...t} />
        ))}
      </nav>
      <ToastHost />
      <DialogHost />
    </div>
  );
}
