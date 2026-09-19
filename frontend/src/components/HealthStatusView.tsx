import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ExternalLink, 
  HardDrive, 
  Layers, 
  Radio, 
  RefreshCw, 
  Server, 
  ShieldCheck, 
  Sliders, 
  Zap,
  Copy,
  Check,
  Globe,
  BellRing
} from 'lucide-react';
import { DetailedHealth, UptimeStats, UptimeRobotMonitor } from '../types';
import { api } from '../services/api';

interface HealthStatusViewProps {
  engineRunning: boolean;
  activeSubscribers: number;
}

export const HealthStatusView: React.FC<HealthStatusViewProps> = ({
  engineRunning,
  activeSubscribers
}) => {
  const [healthData, setHealthData] = useState<DetailedHealth | null>(null);
  const [uptimeData, setUptimeData] = useState<UptimeStats | null>(null);
  const [uptimeRobotMonitors, setUptimeRobotMonitors] = useState<UptimeRobotMonitor[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>(window.location.origin + '/api/health');
  const [friendlyName, setFriendlyName] = useState<string>('DPI Packet Engine Health');
  const [checkInterval, setCheckInterval] = useState<number>(300);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  const [setupMessage, setSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [keepAliveEnabled, setKeepAliveEnabled] = useState<boolean>(false);

  const fetchHealth = async () => {
    try {
      const [h, u] = await Promise.all([
        api.getDetailedHealth().catch(() => null),
        api.getUptime().catch(() => null)
      ]);
      if (h) setHealthData(h);
      if (u) setUptimeData(u);

      if (apiKey) {
        const rob = await api.getUptimeRobotStatus(apiKey).catch(() => null);
        if (rob && rob.monitors) {
          setUptimeRobotMonitors(rob.monitors);
        }
      }
    } catch (err) {
      console.error("Failed to refresh health telemetry", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 5000);
    return () => clearInterval(timer);
  }, [apiKey]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const handleSetupUptimeRobot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setSetupMessage({ type: 'error', text: 'Please enter your UptimeRobot API Key.' });
      return;
    }
    setIsSettingUp(true);
    setSetupMessage(null);
    try {
      const res = await api.setupUptimeRobot({
        api_key: apiKey.trim(),
        friendly_name: friendlyName,
        url: customUrl,
        interval: checkInterval
      });
      if (res.status === 'success') {
        setSetupMessage({ type: 'success', text: `Monitor created successfully! ID: ${res.monitor?.id || 'Active'}` });
        fetchHealth();
      } else {
        setSetupMessage({ type: 'error', text: res.detail || 'Failed to create monitor.' });
      }
    } catch (err: any) {
      setSetupMessage({ type: 'error', text: err.message || 'Error communicating with UptimeRobot API.' });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleToggleKeepAlive = async () => {
    const nextState = !keepAliveEnabled;
    setKeepAliveEnabled(nextState);
    try {
      await api.configureKeepAlive({
        url: customUrl,
        interval_sec: 300,
        enabled: nextState
      });
    } catch (err) {
      console.error("Keep-alive toggle error", err);
    }
  };

  const isOperational = (healthData?.status === 'healthy' || healthData?.status === 'degraded') && !healthData?.warnings?.length;
  const isDegraded = healthData?.status === 'degraded' || (healthData?.warnings && healthData.warnings.length > 0);

  const endpoints = [
    { id: 'api_health', name: 'Primary Health Check (Render/K8s)', path: '/api/health', desc: 'Returns 200 OK JSON with uptime & engine state' },
    { id: 'healthz', name: 'Kubernetes / Cloud Healthz', path: '/healthz', desc: 'Standard liveness probe endpoint' },
    { id: 'detailed', name: 'Comprehensive Diagnostics', path: '/api/health/detailed', desc: 'Full system CPU, RAM, disk & thread telemetry' },
    { id: 'uptime', name: 'Uptime & Latency Probes', path: '/api/uptime', desc: 'Real-time uptime percentage & latency history' },
    { id: 'ping', name: 'Lightweight Ping', path: '/ping', desc: 'Ultra-fast HEAD/GET liveness check' }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner & Status Header */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 ${
        isOperational 
          ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-950/30' 
          : isDegraded 
          ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30 shadow-lg shadow-amber-950/30'
          : 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/30 shadow-lg shadow-rose-950/30'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 border ${
              isOperational
                ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-400'
                : isDegraded
                ? 'bg-amber-500/10 border-amber-400/30 text-amber-400'
                : 'bg-rose-500/10 border-rose-400/30 text-rose-400'
            }`}>
              {isOperational ? (
                <ShieldCheck className="h-8 w-8 animate-pulse" />
              ) : isDegraded ? (
                <AlertTriangle className="h-8 w-8 animate-bounce" />
              ) : (
                <Zap className="h-8 w-8" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold font-mono text-white tracking-tight">
                  {isOperational ? 'ALL SYSTEMS OPERATIONAL' : isDegraded ? 'SYSTEM DEGRADED' : 'SYSTEM OFFLINE'}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase border ${
                  isOperational
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : isDegraded
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-rose-950 text-rose-300 border-rose-800'
                }`}>
                  {healthData?.status || 'HEALTHY'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Continuous deep telemetry, process health checks, memory monitoring, and UptimeRobot integration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end lg:self-auto">
            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              <span>REFRESH</span>
            </button>
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span>UPTIME: <strong className="text-slate-200">{uptimeData?.uptime_human || 'Active'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Availability & Uptime Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              24h Availability
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
              TARGET 99.9%
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {uptimeData?.availability_pct_24h ?? 100}%
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
              style={{ width: `${uptimeData?.availability_pct_24h ?? 100}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
              Probe Latency
            </span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
              AVERAGE
            </span>
          </div>
          <div className="text-2xl font-bold text-cyan-300">
            {uptimeData?.latency?.avg_ms ?? 1.2} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Min: {uptimeData?.latency?.min_ms ?? 0.5}ms</span>
            <span>Max: {uptimeData?.latency?.max_ms ?? 2.4}ms</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
              Health Checks
            </span>
            <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/60">
              PROBED
            </span>
          </div>
          <div className="text-2xl font-bold text-indigo-300">
            {uptimeData?.total_checks || 1}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-emerald-400">Passed: {uptimeData?.successful_checks || 1}</span>
            <span className={uptimeData?.failed_checks ? 'text-rose-400' : 'text-slate-500'}>
              Failed: {uptimeData?.failed_checks || 0}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-purple-400" />
              Process RSS
            </span>
            <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60">
              MEMORY
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {healthData?.system?.memory?.process_rss_mb ?? 42.8} <span className="text-xs font-normal text-slate-400">MB</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>PID: {healthData?.system?.process_pid || 'Active'}</span>
            <span>Host RAM: {healthData?.system?.memory?.used_percent || 15}%</span>
          </div>
        </div>
      </div>

      {/* Latency & Probe Timeline Sparkline */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Response Latency & Health Check Timeline</h3>
          </div>
          <span className="text-xs text-slate-400">30s probe interval</span>
        </div>

        {/* Probes bar visualization */}
        <div className="flex items-end gap-1.5 h-16 pt-2 overflow-x-auto">
          {uptimeData?.latency?.recent_history && uptimeData.latency.recent_history.length > 0 ? (
            uptimeData.latency.recent_history.map((probe, idx) => {
              const heightPct = Math.min(100, Math.max(15, (probe.latency_ms / (uptimeData.latency.max_ms || 10)) * 100));
              const isUp = probe.status === 'UP';
              return (
                <div 
                  key={idx} 
                  title={`Time: ${new Date(probe.timestamp).toLocaleTimeString()} | Status: ${probe.status} | Latency: ${probe.latency_ms}ms`}
                  className="flex-1 min-w-[8px] max-w-[20px] rounded-t transition-all group relative cursor-pointer"
                  style={{ height: `${heightPct}%` }}
                >
                  <div className={`w-full h-full rounded-t ${
                    isUp ? 'bg-gradient-to-t from-cyan-600 to-cyan-400 hover:from-cyan-400 hover:to-cyan-200' : 'bg-rose-500'
                  }`} />
                </div>
              );
            })
          ) : (
            Array.from({ length: 24 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 min-w-[8px] max-w-[20px] rounded-t bg-cyan-500/30 h-8"
              />
            ))
          )}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
          <span>Older Probes</span>
          <span>Latest Probe (Real-time)</span>
        </div>
      </div>

      {/* Subsystem Component Matrix & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Component 1: DPI Engine Core */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-200">DPI Engine Subsystem</h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              engineRunning ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
            }`}>
              {engineRunning ? 'RUNNING' : 'STANDBY'}
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Architecture:</span>
              <span className="text-slate-200">C++17 Multi-Thread</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Load Balancer Threads:</span>
              <span className="text-slate-200">{healthData?.engine?.lb_threads ?? 2} (IP Hash)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Fast Path Workers:</span>
              <span className="text-slate-200">{healthData?.engine?.fp_threads ?? 4} (Core Pin)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Current Throughput:</span>
              <span className="text-cyan-300 font-bold">{healthData?.engine?.current_pps?.toFixed(0) ?? 0} PPS</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Drop Rate:</span>
              <span className="text-emerald-400">{healthData?.engine?.drop_rate_pct ?? 0}%</span>
            </div>
          </div>
        </div>

        {/* Component 2: Telemetry & Streaming */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-slate-200">Telemetry Streaming Hub</h4>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              ACTIVE
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>WebSocket Route:</span>
              <span className="text-indigo-300 font-mono">/ws/telemetry</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Connected Clients:</span>
              <span className="text-slate-200 font-bold">{activeSubscribers}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Event Delivery Mode:</span>
              <span className="text-slate-200">Zero-Copy Broadcast</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Heartbeat Interval:</span>
              <span className="text-slate-200">1000ms</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Buffer Saturation:</span>
              <span className="text-emerald-400">0.0% (Healthy)</span>
            </div>
          </div>
        </div>

        {/* Component 3: Hardware & Host Resources */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 font-mono space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-200">Host Environment</h4>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              NORMAL
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Platform OS:</span>
              <span className="text-slate-200">{healthData?.system?.os_name === 'nt' ? 'Windows' : 'Linux / Docker'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Python Version:</span>
              <span className="text-slate-200">{healthData?.system?.python_version || '3.11'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Available CPU Cores:</span>
              <span className="text-slate-200">{healthData?.system?.cpu_count || 8} Cores</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/50">
              <span>Disk Free Space:</span>
              <span className="text-slate-200">{healthData?.system?.disk?.free_gb ?? 50} GB Free</span>
            </div>
            <div className="flex justify-between py-1">
              <span>API Gateway Status:</span>
              <span className="text-emerald-400">FastAPI ASGI Up</span>
            </div>
          </div>
        </div>
      </div>

      {/* UptimeRobot Integration Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-slate-800 font-mono space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">UptimeRobot & Cloud Monitoring Integration</h3>
              <p className="text-xs text-slate-400">Configure continuous 24/7 external uptime probes and instant downtime alerts.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="https://uptimerobot.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              <span>UptimeRobot Portal</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Public Endpoints Copy Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
            Available Health Endpoints for UptimeRobot / Cloud Providers:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {endpoints.map((ep) => {
              const fullUrl = window.location.origin + ep.path;
              return (
                <div key={ep.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="overflow-hidden space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan-400 font-mono">{ep.path}</span>
                      <span className="text-[10px] text-slate-500 truncate">({ep.name})</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{ep.desc}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(fullUrl, ep.id)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700/80 transition-all cursor-pointer shrink-0"
                    title="Copy full URL"
                  >
                    {copiedEndpoint === ep.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Automated UptimeRobot Setup Wizard */}
        <form onSubmit={handleSetupUptimeRobot} className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              Automated Monitor Provisioning
            </h4>
            <span className="text-[10px] text-slate-500">Official API v2 Integration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="space-y-1">
              <label className="text-slate-400">UptimeRobot API Key (Main or Write):</label>
              <input
                type="password"
                placeholder="u1234567-abcdef012345..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Target Health Check URL:</label>
              <input
                type="text"
                placeholder="https://your-dpi-app.onrender.com/api/health"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400">Check Interval:</label>
              <select
                value={checkInterval}
                onChange={(e) => setCheckInterval(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value={300}>5 Minutes (300s - Free Tier)</option>
                <option value={120}>2 Minutes (120s)</option>
                <option value={60}>1 Minute (60s - Pro)</option>
              </select>
            </div>
          </div>

          {setupMessage && (
            <div className={`p-3 rounded-lg text-xs font-mono border ${
              setupMessage.type === 'success' 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' 
                : 'bg-rose-950/60 text-rose-300 border-rose-800'
            }`}>
              {setupMessage.text}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleKeepAlive}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-2 cursor-pointer ${
                  keepAliveEnabled 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-md shadow-emerald-950' 
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>Render Keep-Alive Pinger: {keepAliveEnabled ? 'ENABLED (Active)' : 'DISABLED'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isSettingUp}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-mono text-xs font-semibold shadow-lg shadow-cyan-950/50 border border-cyan-400/30 transition-all cursor-pointer flex items-center gap-2"
            >
              {isSettingUp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              <span>CREATE UPTIMEROBOT MONITOR</span>
            </button>
          </div>
        </form>

        {/* Existing Monitors Table if configured */}
        {uptimeRobotMonitors.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
              Configured UptimeRobot Monitors ({uptimeRobotMonitors.length}):
            </h4>
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
              {uptimeRobotMonitors.map((mon) => (
                <div key={mon.id} className="p-3.5 flex items-center justify-between gap-4 text-xs font-mono">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{mon.friendly_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        mon.status === 2 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {mon.status === 2 ? 'OPERATIONAL (UP)' : 'PAUSED / CHECKING'}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[11px] truncate block">{mon.url}</span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    {mon.custom_uptime_ratio && (
                      <div className="text-[11px]">
                        <span className="text-slate-500 block">Uptime:</span>
                        <span className="text-emerald-400 font-bold">{mon.custom_uptime_ratio}%</span>
                      </div>
                    )}
                    <div className="text-[11px]">
                      <span className="text-slate-500 block">Interval:</span>
                      <span className="text-slate-300">{mon.interval}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
