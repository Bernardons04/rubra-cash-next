import './panel.css';
import PanelShell from './PanelShell';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
