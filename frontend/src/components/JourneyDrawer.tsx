import React from 'react';
import { 
  X, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Lock, 
  Globe, 
  Hash, 
  Terminal, 
  Shield 
} from 'lucide-react';
import { FlowItem } from '../types';

interface JourneyDrawerProps {
  flow: FlowItem | null;
  onClose: () => void;
  onBlockIp: (ip: string) => void;
  onBlockDomain: (domain: string) => void;
  onBlockApp: (app: string) => void;
}

export const JourneyDrawer: React.FC<JourneyDrawerProps> = ({
  flow,
  onClose,
  onBlockIp,
  onBlockDomain,
  onBlockApp,
}) => {
  if (!flow) return null;

  // Generate fallback journey steps if engine didn't emit custom list
  const journeySteps = flow.journey_steps && flow.journey_steps.length > 0 ? flow.journey_steps : [
    "PCAP Reader ➔ Ingested raw Ethernet frame",
    `Load Balancer ➔ 2-Tuple Hashed to Fast Path worker`,
    `Fast Path Worker ➔ Parsed IPv4 / ${flow.protocol} headers`,
    `DPI Extractor ➔ Classified Application as ${flow.app}${flow.sni && flow.sni !== '-' ? ` (SNI: ${flow.sni})` : ''}`,
    flow.status === 'BLOCKED' 
      ? `Rule Engine ➔ Matched block rule: ${flow.block_reason || 'ACL DROP'}`
      : "Rule Engine ➔ Evaluated rules (No match - Traffic Allowed)",
    flow.status === 'BLOCKED' 
      ? "Action Sink ➔ PACKET DROPPED & LOGGED" 
      : "Action Sink ➔ PACKET FORWARDED TO OUTPUT",
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col justify-between">
      {/* Drawer Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
              <span>PACKET JOURNEY TRACE</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                flow.status === 'BLOCKED' 
                  ? 'bg-rose-950 text-rose-400 border-rose-800' 
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800'
              }`}>
                {flow.status}
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">DPI Fast-Path Pipeline Trace</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="p-6 space-y-6 overflow-y-auto flex-1 font-mono text-xs">
        {/* 5-Tuple Card */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Flow 5-Tuple & Metadata
          </span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">SOURCE:</span>
              <span className="text-cyan-300 font-bold">{flow.src_ip}:{flow.src_port}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">DESTINATION:</span>
              <span className="text-indigo-300 font-bold">{flow.dst_ip}:{flow.dst_port}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">PROTOCOL:</span>
              <span className="text-slate-200">{flow.protocol}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">APPLICATION (L7):</span>
              <span className="text-emerald-400 font-bold">{flow.app}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block text-[10px]">EXTRACTED SNI / HOSTNAME:</span>
              <span className="text-purple-300 font-semibold">{flow.sni || 'N/A (Non-TLS / Raw IP)'}</span>
            </div>
          </div>
        </div>

        {/* Pipeline Journey Timeline */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Step-by-Step Engine Processing Flow
            </span>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {journeySteps.map((step, idx) => {
              const isDropStep = step.includes('DROPPED') || step.includes('Matched block rule');
              const isForwardStep = step.includes('FORWARDED');

              return (
                <div key={idx} className="relative group">
                  {/* Step Node Icon */}
                  <div className={`absolute -left-6 top-1 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${
                    isDropStep ? 'bg-rose-950 border-rose-500 text-rose-400' :
                    isForwardStep ? 'bg-emerald-950 border-emerald-500 text-emerald-400' :
                    'bg-slate-900 border-cyan-500/50 text-cyan-400'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className={`p-3 rounded-lg border transition-all ${
                    isDropStep ? 'bg-rose-950/20 border-rose-900/50 text-rose-300' :
                    isForwardStep ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300' :
                    'bg-slate-900/60 border-slate-800/80 text-slate-300'
                  }`}>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-60 text-cyan-400" />
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Mitigation / Rule Trigger Actions */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-rose-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Enforce DPI Security Mitigations
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {flow.src_ip && (
              <button
                onClick={() => onBlockIp(flow.src_ip)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Block Source IP ({flow.src_ip})</span>
              </button>
            )}
            {flow.sni && flow.sni !== '-' && (
              <button
                onClick={() => onBlockDomain(flow.sni)}
                className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800/60 text-purple-300 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Block Domain ({flow.sni})</span>
              </button>
            )}
            {flow.app && flow.app !== 'UNKNOWN' && (
              <button
                onClick={() => onBlockApp(flow.app)}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/60 text-indigo-300 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Block App Protocol ({flow.app})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between font-mono text-xs text-slate-400">
        <span>Flow ID: <strong className="text-slate-300">{flow.flow_key}</strong></span>
        <span>Packets: <strong className="text-cyan-400">{flow.total_packets}</strong></span>
      </div>
    </div>
  );
};
