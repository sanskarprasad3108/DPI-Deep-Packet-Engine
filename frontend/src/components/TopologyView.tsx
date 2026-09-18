import React, { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge, 
  Position, 
  MarkerType 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DPIStats, ThreadStat } from '../types';
import { Activity, ShieldAlert, CheckCircle2, Cpu, Disc, FileText } from 'lucide-react';

interface TopologyViewProps {
  stats: DPIStats;
  threads: ThreadStat[];
  isRunning: boolean;
}

export const TopologyView: React.FC<TopologyViewProps> = ({
  stats,
  threads,
  isRunning,
}) => {
  // Extract thread packet counters
  const lb0 = threads.find(t => t.thread_name.includes('LB0')) || { packets_processed: Math.floor(stats.total_packets * 0.5), queue_current: 0, queue_peak: 0 };
  const lb1 = threads.find(t => t.thread_name.includes('LB1')) || { packets_processed: Math.ceil(stats.total_packets * 0.5), queue_current: 0, queue_peak: 0 };
  
  const fp0 = threads.find(t => t.thread_name.includes('FP0')) || { packets_processed: Math.floor(stats.total_packets * 0.25), queue_current: 0, queue_peak: 0 };
  const fp1 = threads.find(t => t.thread_name.includes('FP1')) || { packets_processed: Math.floor(stats.total_packets * 0.25), queue_current: 0, queue_peak: 0 };
  const fp2 = threads.find(t => t.thread_name.includes('FP2')) || { packets_processed: Math.floor(stats.total_packets * 0.25), queue_current: 0, queue_peak: 0 };
  const fp3 = threads.find(t => t.thread_name.includes('FP3')) || { packets_processed: Math.floor(stats.total_packets * 0.25), queue_current: 0, queue_peak: 0 };

  const nodes: Node[] = useMemo(() => [
    // 1. PCAP Reader Ingestion Node
    {
      id: 'pcap_reader',
      type: 'default',
      position: { x: 50, y: 220 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-cyan-500/50 rounded-xl font-mono text-xs shadow-lg shadow-cyan-950/40 w-52">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1.5">
              <FileText className="h-4 w-4" />
              <span>PCAP READER</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              <div>Source: <strong className="text-slate-200">Raw PCAP File</strong></div>
              <div>Ingested: <strong className="text-cyan-300">{stats.total_packets} pkts</strong></div>
              <div>Rate: <strong className="text-slate-300">{stats.current_pps.toFixed(0)} pps</strong></div>
            </div>
          </div>
        ),
      },
    },

    // 2. Load Balancer Layer (LB0, LB1)
    {
      id: 'lb0',
      type: 'default',
      position: { x: 330, y: 120 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-indigo-500/50 rounded-xl font-mono text-xs shadow-lg shadow-indigo-950/40 w-52">
            <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1.5">
              <Disc className="h-4 w-4" />
              <span>LB0 (IP Hash)</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              <div>Processed: <strong className="text-indigo-300">{lb0.packets_processed} pkts</strong></div>
              <div>Queue: <strong className="text-slate-300">{lb0.queue_current} / {lb0.queue_peak}</strong></div>
            </div>
          </div>
        ),
      },
    },
    {
      id: 'lb1',
      type: 'default',
      position: { x: 330, y: 320 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-indigo-500/50 rounded-xl font-mono text-xs shadow-lg shadow-indigo-950/40 w-52">
            <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1.5">
              <Disc className="h-4 w-4" />
              <span>LB1 (IP Hash)</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              <div>Processed: <strong className="text-indigo-300">{lb1.packets_processed} pkts</strong></div>
              <div>Queue: <strong className="text-slate-300">{lb1.queue_current} / {lb1.queue_peak}</strong></div>
            </div>
          </div>
        ),
      },
    },

    // 3. Fast Path Worker Threads (FP0 - FP3)
    {
      id: 'fp0',
      type: 'default',
      position: { x: 620, y: 50 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-emerald-500/50 rounded-xl font-mono text-xs shadow-lg shadow-emerald-950/40 w-56">
            <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4" />
                <span>FP0 Worker</span>
              </div>
              <span className="text-[10px] text-slate-400">Queue: {fp0.queue_current}</span>
            </div>
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <div>L3/L4 Parsing + SNI Extractor</div>
              <div>Processed: <strong className="text-emerald-300">{fp0.packets_processed} pkts</strong></div>
            </div>
          </div>
        ),
      },
    },
    {
      id: 'fp1',
      type: 'default',
      position: { x: 620, y: 160 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-emerald-500/50 rounded-xl font-mono text-xs shadow-lg shadow-emerald-950/40 w-56">
            <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4" />
                <span>FP1 Worker</span>
              </div>
              <span className="text-[10px] text-slate-400">Queue: {fp1.queue_current}</span>
            </div>
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <div>L3/L4 Parsing + SNI Extractor</div>
              <div>Processed: <strong className="text-emerald-300">{fp1.packets_processed} pkts</strong></div>
            </div>
          </div>
        ),
      },
    },
    {
      id: 'fp2',
      type: 'default',
      position: { x: 620, y: 270 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-emerald-500/50 rounded-xl font-mono text-xs shadow-lg shadow-emerald-950/40 w-56">
            <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4" />
                <span>FP2 Worker</span>
              </div>
              <span className="text-[10px] text-slate-400">Queue: {fp2.queue_current}</span>
            </div>
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <div>L3/L4 Parsing + SNI Extractor</div>
              <div>Processed: <strong className="text-emerald-300">{fp2.packets_processed} pkts</strong></div>
            </div>
          </div>
        ),
      },
    },
    {
      id: 'fp3',
      type: 'default',
      position: { x: 620, y: 380 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-slate-900 border border-emerald-500/50 rounded-xl font-mono text-xs shadow-lg shadow-emerald-950/40 w-56">
            <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4" />
                <span>FP3 Worker</span>
              </div>
              <span className="text-[10px] text-slate-400">Queue: {fp3.queue_current}</span>
            </div>
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <div>L3/L4 Parsing + SNI Extractor</div>
              <div>Processed: <strong className="text-emerald-300">{fp3.packets_processed} pkts</strong></div>
            </div>
          </div>
        ),
      },
    },

    // 4. Output Action Sinks (Forward vs Drop)
    {
      id: 'forward_sink',
      type: 'default',
      position: { x: 950, y: 140 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-emerald-950/30 border border-emerald-500 rounded-xl font-mono text-xs shadow-lg shadow-emerald-950/40 w-52">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>FORWARD SINK</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              <div>Action: <strong className="text-emerald-300">ALLOW / FORWARD</strong></div>
              <div>Count: <strong className="text-emerald-400 font-bold">{stats.forwarded_packets}</strong></div>
            </div>
          </div>
        ),
      },
    },
    {
      id: 'drop_sink',
      type: 'default',
      position: { x: 950, y: 300 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div className="p-3 bg-rose-950/30 border border-rose-500 rounded-xl font-mono text-xs shadow-lg shadow-rose-950/40 w-52">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>DROP / ACL SINK</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5">
              <div>Action: <strong className="text-rose-300">BLOCK & LOG</strong></div>
              <div>Count: <strong className="text-rose-400 font-bold">{stats.dropped_packets}</strong></div>
            </div>
          </div>
        ),
      },
    },
  ], [stats, lb0, lb1, fp0, fp1, fp2, fp3]);

  const edges: Edge[] = useMemo(() => [
    // PCAP -> LBs
    { id: 'e-pcap-lb0', source: 'pcap_reader', target: 'lb0', animated: isRunning, style: { stroke: '#00e5ff' } },
    { id: 'e-pcap-lb1', source: 'pcap_reader', target: 'lb1', animated: isRunning, style: { stroke: '#00e5ff' } },

    // LB0 -> FP0, FP1
    { id: 'e-lb0-fp0', source: 'lb0', target: 'fp0', animated: isRunning, style: { stroke: '#6366f1' } },
    { id: 'e-lb0-fp1', source: 'lb0', target: 'fp1', animated: isRunning, style: { stroke: '#6366f1' } },

    // LB1 -> FP2, FP3
    { id: 'e-lb1-fp2', source: 'lb1', target: 'fp2', animated: isRunning, style: { stroke: '#6366f1' } },
    { id: 'e-lb1-fp3', source: 'lb1', target: 'fp3', animated: isRunning, style: { stroke: '#6366f1' } },

    // FPs -> Forward Sink
    { id: 'e-fp0-fwd', source: 'fp0', target: 'forward_sink', animated: isRunning, style: { stroke: '#10b981' } },
    { id: 'e-fp1-fwd', source: 'fp1', target: 'forward_sink', animated: isRunning, style: { stroke: '#10b981' } },
    { id: 'e-fp2-fwd', source: 'fp2', target: 'forward_sink', animated: isRunning, style: { stroke: '#10b981' } },
    { id: 'e-fp3-fwd', source: 'fp3', target: 'forward_sink', animated: isRunning, style: { stroke: '#10b981' } },

    // FPs -> Drop Sink
    { id: 'e-fp0-drop', source: 'fp0', target: 'drop_sink', animated: isRunning && stats.dropped_packets > 0, style: { stroke: '#f43f5e', strokeDasharray: '5,5' } },
    { id: 'e-fp1-drop', source: 'fp1', target: 'drop_sink', animated: isRunning && stats.dropped_packets > 0, style: { stroke: '#f43f5e', strokeDasharray: '5,5' } },
    { id: 'e-fp2-drop', source: 'fp2', target: 'drop_sink', animated: isRunning && stats.dropped_packets > 0, style: { stroke: '#f43f5e', strokeDasharray: '5,5' } },
    { id: 'e-fp3-drop', source: 'fp3', target: 'drop_sink', animated: isRunning && stats.dropped_packets > 0, style: { stroke: '#f43f5e', strokeDasharray: '5,5' } },
  ], [isRunning, stats.dropped_packets]);

  return (
    <div className="space-y-4">
      {/* Header Description */}
      <div className="panel-card p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span>INTERACTIVE MULTI-THREAD PIPELINE TOPOLOGY</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time visual dataflow map: PCAP Ingestion ➔ 2x LB IP Hash Ring ➔ 4x FP Workers ➔ Rule Evaluation Sinks
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="badge-cyan">2 LB THREADS</span>
          <span className="badge-emerald">4 FP WORKERS</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="panel-card h-[540px] w-full overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-left"
          className="bg-slate-950"
        >
          <Background color="#1e293b" gap={16} size={1} />
          <Controls className="bg-slate-900 border border-slate-800 fill-slate-300" />
        </ReactFlow>
      </div>
    </div>
  );
};
