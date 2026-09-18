import React from 'react';
import { 
  Activity, 
  Play, 
  Square, 
  RotateCcw, 
  Radio, 
  ShieldAlert, 
  Cpu, 
  Zap, 
  Clock, 
  FileText
} from 'lucide-react';
import { DPIStats } from '../types';

interface NavbarProps {
  isConnected: boolean;
  engineStatus: string;
  isReplaying: boolean;
  currentPcap: string;
  stats: DPIStats;
  pacingUs: number;
  setPacingUs: (val: number) => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onPcapChange: (pcap: string) => void;
  pcapsList: string[];
}

export const Navbar: React.FC<NavbarProps> = ({
  isConnected,
  engineStatus,
  isReplaying,
  currentPcap,
  stats,
  pacingUs,
  setPacingUs,
  onStart,
  onStop,
  onRestart,
  onPcapChange,
  pcapsList,
}) => {
  const isRunning = engineStatus === 'RUNNING';

  return (
    <header className="glass-header sticky top-0 z-40 h-16 px-6 flex items-center justify-between">
      {/* Brand & Engine Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                DPI-X CONTROL CENTER
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                C++17 MT Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Deep Packet Inspection & Security Monitor</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800 mx-2" />

        {/* Engine State Indicator */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-medium shadow-sm shadow-emerald-950">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ENGINE LIVE</span>
            </div>
          ) : isReplaying ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-400 text-xs font-mono font-medium shadow-sm shadow-purple-950">
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
              <span>REPLAY ACTIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span>ENGINE IDLE</span>
            </div>
          )}

          {/* WebSocket Status */}
          <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded ${
            isConnected ? 'text-emerald-400/80' : 'text-rose-400/80'
          }`}>
            <Radio className="h-3 w-3" />
            <span>{isConnected ? 'STREAM CONNECTED' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* Center Ticker: Runtime & Throughput */}
      <div className="hidden lg:flex items-center gap-6 text-xs font-mono bg-slate-900/60 px-4 py-1.5 rounded-lg border border-slate-800/60">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Clock className="h-3.5 w-3.5 text-cyan-400" />
          <span>RUN: <strong className="text-cyan-300">{stats.runtime_seconds.toFixed(1)}s</strong></span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div className="flex items-center gap-1.5 text-slate-300">
          <Activity className="h-3.5 w-3.5 text-indigo-400" />
          <span>PPS: <strong className="text-indigo-300">{stats.current_pps.toFixed(0)}</strong></span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div className="flex items-center gap-1.5 text-slate-300">
          <Cpu className="h-3.5 w-3.5 text-emerald-400" />
          <span>PKTS: <strong className="text-emerald-300">{stats.total_packets.toLocaleString()}</strong></span>
        </div>
        <div className="h-3 w-px bg-slate-800" />
        <div className="flex items-center gap-1.5 text-slate-300">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          <span>DROPS: <strong className="text-rose-300">{stats.dropped_packets} ({stats.drop_rate_pct}%)</strong></span>
        </div>
      </div>

      {/* Right Controls: PCAP Switcher & Engine Control Buttons */}
      <div className="flex items-center gap-3">
        {/* PCAP Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
          <FileText className="h-3.5 w-3.5 text-slate-400" />
          <select 
            value={currentPcap}
            onChange={(e) => onPcapChange(e.target.value)}
            disabled={isRunning}
            className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer disabled:opacity-50"
          >
            {pcapsList.map(p => (
              <option key={p} value={p} className="bg-slate-900 text-slate-200">
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Pacing Selector (Slow-mo for visual inspection) */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-400 font-mono">
          <span>PACE:</span>
          <select
            value={pacingUs}
            onChange={(e) => setPacingUs(Number(e.target.value))}
            disabled={isRunning}
            className="bg-transparent text-cyan-400 font-mono text-xs focus:outline-none cursor-pointer disabled:opacity-50"
          >
            <option value={0} className="bg-slate-900">0ms (Full Speed)</option>
            <option value={5000} className="bg-slate-900">5ms</option>
            <option value={20000} className="bg-slate-900">20ms (Smooth)</option>
            <option value={50000} className="bg-slate-900">50ms (Inspect)</option>
            <option value={100000} className="bg-slate-900">100ms (Slow-Mo)</option>
          </select>
        </div>

        {/* Action Buttons */}
        {!isRunning ? (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-mono text-xs font-semibold shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>START ENGINE</span>
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-mono text-xs font-semibold shadow-lg shadow-rose-950/50 border border-rose-400/40 transition-all cursor-pointer"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>STOP</span>
          </button>
        )}

        <button
          onClick={onRestart}
          title="Restart Engine"
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
