import React from 'react';
import { 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Activity, 
  Disc, 
  HardDrive 
} from 'lucide-react';
import { ThreadStat } from '../types';

interface ThreadsViewProps {
  threads: ThreadStat[];
  imbalancePct: number;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  threads,
  imbalancePct,
}) => {
  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImbalanced = imbalancePct > 35.0;

  return (
    <div className="space-y-6">
      {/* Imbalance Warning / Health Banner */}
      {isImbalanced ? (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-start gap-3 text-xs font-mono text-amber-300 shadow-lg shadow-amber-950/40">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-amber-300">
              FAST-PATH THREAD WORKLOAD VARIANCE DETECTED ({imbalancePct}% Variance)
            </h3>
            <p className="text-amber-200/80 leading-relaxed">
              Worker distribution variance is elevated. This commonly occurs when one heavy stream (elephant flow) pins to a single Fast-Path queue via IP 2-tuple hashing while other queues handle lighter mice flows.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between text-xs font-mono text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-sm text-emerald-200">THREAD HEALTH NOMINAL</span>
              <span className="text-emerald-400/80 block text-[11px]">
                Workload is evenly balanced across Fast-Path ring buffers ({imbalancePct}% variance)
              </span>
            </div>
          </div>
          <span className="badge-emerald">OPTIMAL</span>
        </div>
      )}

      {/* Grid of Thread Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {threads.map((t) => {
          const isLb = t.thread_type === 'LOAD_BALANCER' || t.thread_name.includes('LB');
          const isFp = t.thread_type === 'FAST_PATH' || t.thread_name.includes('FP');
          const isHeavy = t.queue_current > 100 || t.is_overloaded;

          return (
            <div 
              key={t.thread_name}
              className={`panel-card p-5 border-t-4 transition-all duration-200 ${
                isLb ? 'border-t-indigo-500' : 'border-t-emerald-500'
              } ${isHeavy ? 'shadow-rose-950/40 border-rose-500/50' : ''}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    isLb ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' :
                    'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}>
                    {isLb ? <Disc className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
                  </div>
                  <div>
                    <h3 className="font-bold font-mono text-sm text-slate-100">
                      {t.thread_name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      {isLb ? 'Load Balancer (IP Hash)' : 'Fast-Path Worker (L7 DPI)'}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isHeavy ? 'badge-rose' : 'badge-emerald'
                }`}>
                  {isHeavy ? 'OVERLOADED' : 'HEALTHY'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="space-y-3 font-mono text-xs">
                {/* Packets Processed */}
                <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="text-slate-400">PACKETS PROCESSED:</span>
                  <span className="text-cyan-300 font-bold text-sm">{t.packets_processed.toLocaleString()}</span>
                </div>

                {/* Bytes Throughput */}
                <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="text-slate-400">DATA VOLUME:</span>
                  <span className="text-slate-200 font-semibold">{formatBytes(t.bytes_processed)}</span>
                </div>

                {/* Queue Current / Peak */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Ring Queue Depth:</span>
                    <span className="text-slate-300">
                      <strong>{t.queue_current}</strong> / {t.queue_peak || 1000} (Peak: {t.queue_peak})
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        t.queue_current > 500 ? 'bg-rose-500' :
                        t.queue_current > 100 ? 'bg-amber-500' :
                        'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, (t.queue_current / Math.max(1, t.queue_peak || 100)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
