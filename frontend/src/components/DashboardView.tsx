import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Activity, 
  Zap, 
  ShieldAlert, 
  CheckCircle2, 
  Radio, 
  Globe, 
  Cpu, 
  Layers, 
  TrendingUp, 
  Lock 
} from 'lucide-react';
import { DPIStats, FlowItem, SecurityEvent, ThreadStat, TrafficPoint } from '../types';

interface DashboardViewProps {
  stats: DPIStats;
  flows: FlowItem[];
  threads: ThreadStat[];
  securityEvents: SecurityEvent[];
  applications: Record<string, number>;
  domains: Record<string, number>;
  trafficHistory: TrafficPoint[];
  onSelectFlow: (flow: FlowItem) => void;
}

const APP_COLORS: Record<string, string> = {
  HTTPS: '#00e5ff',
  HTTP: '#6366f1',
  DNS: '#10b981',
  TLS: '#38bdf8',
  SSH: '#f59e0b',
  FTP: '#ec4899',
  UNKNOWN: '#64748b',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  flows,
  threads,
  securityEvents,
  applications,
  domains,
  trafficHistory,
  onSelectFlow,
}) => {
  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const appChartData = Object.entries(applications).map(([name, value]) => ({
    name,
    value,
    color: APP_COLORS[name.toUpperCase()] || '#8b5cf6',
  }));

  const totalAppPackets = Object.values(applications).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* 1. Metric KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Packets & PPS */}
        <div className="panel-card p-4 panel-card-hover border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Packets Ingested</span>
            <div className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {stats.total_packets.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-cyan-400">
              {stats.current_pps.toFixed(0)} pps
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-2">
            <span>Payload Data:</span>
            <span className="text-slate-200 font-semibold">{formatBytes(stats.total_bytes)}</span>
          </div>
        </div>

        {/* Active Flows */}
        <div className="panel-card p-4 panel-card-hover border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Tracked Flows</span>
            <div className="p-2 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {stats.active_flows}
            </span>
            <span className="text-xs font-mono text-indigo-400">
              {flows.length} in table
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-2">
            <span>Completed Flows:</span>
            <span className="text-slate-200 font-semibold">{stats.completed_flows}</span>
          </div>
        </div>

        {/* Forward vs Dropped */}
        <div className="panel-card p-4 panel-card-hover border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">Forwarded vs Dropped</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              {stats.forwarded_packets.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-rose-400">
              / {stats.dropped_packets} drop
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-2">
            <span>Drop Rate:</span>
            <span className={`font-semibold ${stats.drop_rate_pct > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {stats.drop_rate_pct}%
            </span>
          </div>
        </div>

        {/* Intelligence (SNIs & Apps) */}
        <div className="panel-card p-4 panel-card-hover border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">DPI Classifications</span>
            <div className="p-2 rounded-lg bg-purple-950/60 text-purple-400 border border-purple-800/40">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {Object.keys(domains).length}
            </span>
            <span className="text-xs font-mono text-purple-400">
              SNIs Extracted
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-2">
            <span>App Protocols:</span>
            <span className="text-cyan-300 font-semibold">{Object.keys(applications).length} detected</span>
          </div>
        </div>
      </div>

      {/* 2. Charts Section: Traffic Timeline & Application Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Rate Timeline (2 cols) */}
        <div className="panel-card p-5 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold font-mono tracking-tight text-slate-200">
                REAL-TIME TRAFFIC THROUGHPUT
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span>Total PPS</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Forwarded</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span>Dropped</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {trafficHistory.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
                <Activity className="h-8 w-8 mb-2 opacity-30 animate-pulse" />
                <span>Waiting for telemetry packets stream...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ppsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="dropGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.5} />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0b0f19', 
                      borderColor: '#334155', 
                      borderRadius: '0.5rem',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }} 
                  />
                  <Area type="monotone" dataKey="pps" stroke="#00e5ff" strokeWidth={2} fillOpacity={1} fill="url(#ppsGradient)" name="PPS" />
                  <Area type="monotone" dataKey="dropped" stroke="#f43f5e" strokeWidth={1.5} fillOpacity={1} fill="url(#dropGradient)" name="Dropped" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Application Protocol Breakdown (1 col) */}
        <div className="panel-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-bold font-mono tracking-tight text-slate-200">
                APPLICATION MIX
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {totalAppPackets} classified
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {appChartData.length === 0 ? (
              <div className="text-xs font-mono text-slate-400">No applications identified yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {appChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0b0f19', 
                      borderColor: '#334155', 
                      borderRadius: '0.5rem',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* App breakdown list */}
          <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
            {appChartData.map((app) => (
              <div key={app.name} className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: app.color }} />
                  <span className="text-slate-300 font-semibold">{app.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{app.value}</span>
                  <span className="text-[10px] text-slate-400">
                    ({totalAppPackets > 0 ? Math.round((app.value / totalAppPackets) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Bottom Split: Live Security Event Alerts & Recent Active Flows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Events Feed */}
        <div className="panel-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              <h2 className="text-sm font-bold font-mono tracking-tight text-slate-200">
                SECURITY INTERCEPTIONS & DROPS
              </h2>
            </div>
            <span className="badge-rose">
              {securityEvents.length} INCIDENTS
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {securityEvents.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400 border border-dashed border-slate-800 rounded-lg">
                <Lock className="h-6 w-6 mx-auto mb-2 opacity-30 text-emerald-400" />
                No security violations or drop rules triggered yet.
              </div>
            ) : (
              securityEvents.map((ev) => (
                <div 
                  key={ev.id} 
                  className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 flex flex-col gap-1 text-xs font-mono hover:bg-rose-950/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="badge-rose text-[10px]">{ev.reason}</span>
                      <span className="text-rose-300 font-semibold">{ev.rule_matched}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{ev.time_str}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
                    <span>Target: <strong className="text-slate-300">{ev.src_ip}:{ev.src_port} ➔ {ev.dst_ip}:{ev.dst_port}</strong></span>
                    {ev.sni && ev.sni !== '-' && (
                      <span className="text-purple-300">SNI: {ev.sni}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Active Flows Quick List */}
        <div className="panel-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold font-mono tracking-tight text-slate-200">
                LIVE FLOWS FEED
              </h2>
            </div>
            <span className="badge-cyan">
              {flows.length} ACTIVE
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {flows.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400 border border-dashed border-slate-800 rounded-lg">
                No active flows detected in current engine run.
              </div>
            ) : (
              flows.slice(0, 8).map((flow) => (
                <div 
                  key={flow.flow_key}
                  onClick={() => onSelectFlow(flow)}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-850 cursor-pointer transition-all flex items-center justify-between text-xs font-mono"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        flow.app === 'HTTPS' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                        flow.app === 'DNS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {flow.app}
                      </span>
                      <span className="text-slate-200 font-semibold">{flow.src_ip}:{flow.src_port} ➔ {flow.dst_ip}:{flow.dst_port}</span>
                    </div>
                    {flow.sni && flow.sni !== '-' && (
                      <div className="text-[11px] text-cyan-400/90 truncate max-w-xs">
                        {flow.sni}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      flow.status === 'BLOCKED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                      flow.status === 'CLASSIFIED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {flow.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {flow.total_packets} pkts ({formatBytes(flow.total_bytes)})
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
