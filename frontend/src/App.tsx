import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight, LockKeyhole, Network, ShieldCheck, Zap } from 'lucide-react';
import { useTelemetry } from './hooks/useTelemetry';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ConnectionsView } from './components/ConnectionsView';
import { TopologyView } from './components/TopologyView';
import { ThreadsView } from './components/ThreadsView';
import { RulesView } from './components/RulesView';
import { DomainsView } from './components/DomainsView';
import { PacketInspectorView } from './components/PacketInspectorView';
import { ReplayView } from './components/ReplayView';
import { JourneyDrawer } from './components/JourneyDrawer';
import { FlowItem } from './types';
import './App.css';

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="welcome-shell">
      <div className="welcome-grid" />
      <div className="welcome-orbit welcome-orbit-one" />
      <div className="welcome-orbit welcome-orbit-two" />
      <nav className="welcome-nav">
        <div className="welcome-brand">
          <span className="welcome-brand-mark"><Zap size={18} fill="currentColor" /></span>
          <span>DPI-X</span><span className="welcome-brand-divider" /><span className="welcome-brand-subtitle">CONTROL CENTER</span>
        </div>
        <div className="welcome-status"><span /> PRIVATE NETWORK / READY</div>
      </nav>

      <section className="welcome-content">
        <div className="welcome-copy">
          <p className="welcome-kicker"><span /> DEEP PACKET INTELLIGENCE</p>
          <h1>See the signal<br /><em>behind the noise.</em></h1>
          <p className="welcome-description">A live command surface for understanding traffic, tracing connections, and keeping every packet accountable.</p>
          <button className="welcome-enter" onClick={onEnter}>
            <span>ENTER CONTROL CENTER</span><ArrowUpRight size={18} />
          </button>
          <div className="welcome-trust"><LockKeyhole size={14} /> LOCAL ANALYSIS <span /> NO DATA LEAVES YOUR MACHINE</div>
        </div>

        <div className="welcome-console" aria-label="Network activity preview">
          <div className="console-topline"><span>LIVE TELEMETRY</span><span className="console-live"><i /> STREAMING</span></div>
          <div className="console-route">
            <div className="console-node console-node-source"><span className="node-pulse" /><strong>INGRESS</strong><small>enp0s3 / 10.0.0.1</small></div>
            <div className="console-line"><span /><span /><span /></div>
            <div className="console-node console-node-core"><Network size={18} /><strong>DPI-X CORE</strong><small>inspection layer</small></div>
            <div className="console-line console-line-reverse"><span /><span /><span /></div>
            <div className="console-node console-node-destination"><ShieldCheck size={18} /><strong>VERIFIED</strong><small>policy gateway</small></div>
          </div>
          <div className="console-chart">
            <div className="chart-label"><span>THROUGHPUT</span><strong>8.42 <small>GB/s</small></strong></div>
            <svg viewBox="0 0 520 120" preserveAspectRatio="none" role="img" aria-label="Throughput activity graph">
              <defs><linearGradient id="welcome-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#25d9d0" stopOpacity=".32" /><stop offset="100%" stopColor="#25d9d0" stopOpacity="0" /></linearGradient></defs>
              <path className="chart-area" d="M0 96 C30 88 34 68 62 76 S94 98 120 68 S148 28 176 52 S206 80 230 48 S255 60 280 35 S315 20 340 46 S367 86 394 62 S424 46 450 54 S480 20 520 30 V120 H0Z" />
              <path className="chart-line" d="M0 96 C30 88 34 68 62 76 S94 98 120 68 S148 28 176 52 S206 80 230 48 S255 60 280 35 S315 20 340 46 S367 86 394 62 S424 46 450 54 S480 20 520 30" />
            </svg>
            <div className="chart-axis"><span>00:00</span><span>00:15</span><span>00:30</span><span>NOW</span></div>
          </div>
          <div className="console-metrics">
            <div><Activity size={15} /><span>PACKETS / SEC</span><strong>24,891</strong></div>
            <div><ShieldCheck size={15} /><span>POLICY MATCH</span><strong>99.98%</strong></div>
            <div><Network size={15} /><span>ACTIVE FLOWS</span><strong>1,284</strong></div>
          </div>
        </div>
      </section>
      <footer className="welcome-footer"><span>BUILD 2.4.17</span><span>THREAD-SAFE ENGINE</span><span>© DPI-X SYSTEMS</span></footer>
    </main>
  );
}

export function App() {
  const {
    isConnected,
    engineStatus,
    setEngineStatus,
    currentPcap,
    setCurrentPcap,
    stats,
    flows,
    threads,
    securityEvents,
    applications,
    domains,
    rules,
    setRules,
    trafficHistory,
    threadImbalancePct,
    isReplaying,
  } = useTelemetry();

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [selectedFlow, setSelectedFlow] = useState<FlowItem | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [pacingUs, setPacingUs] = useState<number>(20000); // 20ms default pacing
  const [pcapsList, setPcapsList] = useState<string[]>(['test_dpi.pcap', 'test_out.pcap']);

  const refreshPcaps = async () => {
    try {
      const list = await api.getPcaps();
      if (list && list.length > 0) {
        setPcapsList(list.map(p => p.filename));
      }
    } catch (err) {
      console.error('Failed to load pcaps list:', err);
    }
  };

  useEffect(() => {
    refreshPcaps();
  }, []);

  const handleStartEngine = async () => {
    try {
      await api.startEngine({
        pcap_file: currentPcap,
        lb_threads: 2,
        fp_threads: 4,
        pacing_us: pacingUs,
      });
      setEngineStatus('RUNNING');
    } catch (err) {
      console.error('Failed to start engine:', err);
    }
  };

  const handleStopEngine = async () => {
    try {
      await api.stopEngine();
      setEngineStatus('STOPPED');
    } catch (err) {
      console.error('Failed to stop engine:', err);
    }
  };

  const handleRestartEngine = async () => {
    try {
      await api.restartEngine();
      setEngineStatus('RUNNING');
    } catch (err) {
      console.error('Failed to restart engine:', err);
    }
  };

  const handleAddRule = async (type: string, value: string) => {
    try {
      const newRule = await api.createRule({ type, value });
      setRules(prev => [...prev, newRule]);
    } catch (err) {
      console.error('Failed to add rule:', err);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      await api.deleteRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleStartReplay = async (speed: number) => {
    try {
      await api.startReplay(speed);
    } catch (err) {
      console.error('Failed to start replay:', err);
    }
  };

  const handleStopReplay = async () => {
    try {
      await api.stopReplay();
    } catch (err) {
      console.error('Failed to stop replay:', err);
    }
  };

  if (!hasEntered) {
    return <WelcomeScreen onEnter={() => setHasEntered(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <Navbar
        isConnected={isConnected}
        engineStatus={engineStatus}
        isReplaying={isReplaying}
        currentPcap={currentPcap}
        stats={stats}
        pacingUs={pacingUs}
        setPacingUs={setPacingUs}
        onStart={handleStartEngine}
        onStop={handleStopEngine}
        onRestart={handleRestartEngine}
        onPcapChange={(pcap) => setCurrentPcap(pcap)}
        pcapsList={pcapsList}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
          flowsCount={flows.length}
          threatsCount={securityEvents.length}
          rulesCount={rules.length}
          imbalanceWarning={threadImbalancePct > 35}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950/60">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                flows={flows}
                threads={threads}
                securityEvents={securityEvents}
                applications={applications}
                domains={domains}
                trafficHistory={trafficHistory}
                onSelectFlow={(flow) => setSelectedFlow(flow)}
              />
            )}

            {currentTab === 'connections' && (
              <ConnectionsView
                flows={flows}
                onSelectFlow={(flow) => setSelectedFlow(flow)}
                onBlockIp={(ip) => handleAddRule('IP', ip)}
                onBlockDomain={(domain) => handleAddRule('DOMAIN', domain)}
              />
            )}

            {currentTab === 'topology' && (
              <TopologyView
                stats={stats}
                threads={threads}
                isRunning={engineStatus === 'RUNNING' || isReplaying}
              />
            )}

            {currentTab === 'threads' && (
              <ThreadsView
                threads={threads}
                imbalancePct={threadImbalancePct}
              />
            )}

            {currentTab === 'rules' && (
              <RulesView
                rules={rules}
                onAddRule={handleAddRule}
                onDeleteRule={handleDeleteRule}
              />
            )}

            {currentTab === 'domains' && (
              <DomainsView
                domains={domains}
                onBlockDomain={(domain) => handleAddRule('DOMAIN', domain)}
              />
            )}

            {currentTab === 'packets' && (
              <PacketInspectorView />
            )}

            {currentTab === 'replay' && (
              <ReplayView
                isReplaying={isReplaying}
                onStartReplay={handleStartReplay}
                onStopReplay={handleStopReplay}
                currentPcap={currentPcap}
                pcapsList={pcapsList}
                onPcapUploaded={refreshPcaps}
              />
            )}
          </div>
        </main>
      </div>

      {/* Packet Journey Slideout Drawer */}
      <JourneyDrawer
        flow={selectedFlow}
        onClose={() => setSelectedFlow(null)}
        onBlockIp={(ip) => handleAddRule('IP', ip)}
        onBlockDomain={(domain) => handleAddRule('DOMAIN', domain)}
        onBlockApp={(app) => handleAddRule('APP', app)}
      />
    </div>
  );
}

export default App;
