import React from 'react';
import { 
  LayoutDashboard, 
  Network, 
  GitFork, 
  Cpu, 
  Shield, 
  Globe, 
  Binary, 
  History,
  Activity,
  HeartPulse,
  Radio,
  Server
} from 'lucide-react';

export type TabType = 
  | 'dashboard' 
  | 'connections' 
  | 'topology' 
  | 'threads' 
  | 'rules' 
  | 'domains' 
  | 'packets' 
  | 'replay'
  | 'health';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  flowsCount: number;
  threatsCount: number;
  rulesCount: number;
  imbalanceWarning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  flowsCount,
  threatsCount,
  rulesCount,
  imbalanceWarning,
}) => {
  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Telemetry Center',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'connections' as TabType,
      label: 'Active Flows',
      icon: Network,
      badge: flowsCount > 0 ? flowsCount : null,
      badgeColor: 'bg-cyan-950 text-cyan-400 border-cyan-800',
    },
    {
      id: 'topology' as TabType,
      label: 'Pipeline Topology',
      icon: GitFork,
      badge: 'LIVE',
      badgeColor: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    },
    {
      id: 'threads' as TabType,
      label: 'Multi-Thread Engine',
      icon: Cpu,
      badge: imbalanceWarning ? 'ALERT' : null,
      badgeColor: 'bg-amber-950 text-amber-400 border-amber-800 animate-pulse',
    },
    {
      id: 'rules' as TabType,
      label: 'Security & Rules',
      icon: Shield,
      badge: rulesCount > 0 ? `${rulesCount} RULES` : null,
      badgeColor: 'bg-indigo-950 text-indigo-400 border-indigo-800',
    },
    {
      id: 'health' as TabType,
      label: 'Health & Uptime',
      icon: HeartPulse,
      badge: '99.9%',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    },
    {
      id: 'domains' as TabType,
      label: 'SNI & Domains',
      icon: Globe,
      badge: null,
    },
    {
      id: 'packets' as TabType,
      label: 'Packet Inspector',
      icon: Binary,
      badge: null,
    },
    {
      id: 'replay' as TabType,
      label: 'Replay Laboratory',
      icon: History,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none min-h-[calc(100vh-4rem)]">
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
          <span>Navigation</span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-400">
            <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
          </span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium font-mono transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-950/70 to-slate-900 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Engine Architecture Metadata Footer */}
      <div className="p-4 m-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs font-mono space-y-2">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Server className="h-3.5 w-3.5 text-cyan-400" />
            <span>Architecture</span>
          </span>
          <span className="text-cyan-400 font-bold">C++17 MT</span>
        </div>
        <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800 pt-2">
          <div className="flex justify-between">
            <span>LB Workers:</span>
            <span className="text-slate-300">2 (IP Hash)</span>
          </div>
          <div className="flex justify-between">
            <span>FP Workers:</span>
            <span className="text-slate-300">4 (Connection Pin)</span>
          </div>
          <div className="flex justify-between">
            <span>Inspection:</span>
            <span className="text-emerald-400">TLS SNI + HTTP + DNS</span>
          </div>
          <div className="flex justify-between">
            <span>Security:</span>
            <span className="text-rose-400">ACL + Match Sink</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
