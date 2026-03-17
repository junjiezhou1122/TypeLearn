import type { ReactNode } from 'react';

type NavItemProps = {
  active: boolean;
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
};

export function NavItem({ active, icon, label, hint, onClick }: NavItemProps) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <span className="nav-item-icon">{icon}</span>
      <span>{label}</span>
      {hint ? <span className="nav-hint-badge">{hint}</span> : null}
    </button>
  );
}
