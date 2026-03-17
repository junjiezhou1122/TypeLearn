import { RefreshCcw } from 'lucide-react';
import { VIEW_DETAILS, type ViewType } from '../ui';

type TopBarProps = {
  view: ViewType;
  loading: boolean;
  lastSyncAt: number | null;
  syncError: string | null;
  onSync: () => void;
};

export function TopBar({ view, loading, lastSyncAt, syncError, onSync }: TopBarProps) {
  const syncLabel = syncError
    ? 'Service unreachable'
    : lastSyncAt
      ? `Synced ${new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Not synced yet';

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="top-bar glass-panel">
      <div className="top-bar-minimal">
        <div className="top-bar-minimal-title">{VIEW_DETAILS[view].title}</div>
        <span className="top-bar-date">{todayLabel}</span>
      </div>
      <div className="top-bar-right">
        <button className={`sync-pill ${syncError ? 'error' : ''}`} type="button" onClick={onSync}>
          <RefreshCcw size={13} className={loading ? 'spinning' : ''} />
          <span>{syncLabel}</span>
        </button>
      </div>
    </header>
  );
}
