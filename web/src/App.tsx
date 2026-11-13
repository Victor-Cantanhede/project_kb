import { useCallback, useEffect, useState } from 'react';
import { AppHeader, type ActiveTab } from './components/layout/app-header.js';
import { ToastBanner } from './components/ui/index.js';
import { HeroesView } from './features/heroes/index.js';
import { CsvImportModal } from './features/imports/index.js';
import { MissionsView } from './features/missions/index.js';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('heroes');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  // Auto-dismiss toast banner after 4 seconds
  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="app-shell">
      <AppHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <ToastBanner message={toastMessage} onClose={() => setToastMessage(null)} />

      <main className="main-container">
        {activeTab === 'heroes' ? (
          <HeroesView
            onToast={showToast}
            onOpenCsvImport={() => setCsvImportOpen(true)}
          />
        ) : (
          <MissionsView onToast={showToast} />
        )}
      </main>

      {csvImportOpen && (
        <CsvImportModal
          onClose={() => setCsvImportOpen(false)}
          onImportCompleted={() => {
            showToast('Importação de CSV concluída!');
            setCsvImportOpen(false);
          }}
        />
      )}
    </div>
  );
}
