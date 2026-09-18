import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Layers, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Globe 
} from 'lucide-react';
import { FlowItem } from '../types';

interface ConnectionsViewProps {
  flows: FlowItem[];
  onSelectFlow: (flow: FlowItem) => void;
  onBlockIp: (ip: string) => void;
  onBlockDomain: (domain: string) => void;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  flows,
  onSelectFlow,
  onBlockIp,
  onBlockDomain,
}) => {
  const [search, setSearch] = useState('');
  const [appFilter, setAppFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [protoFilter, setProtoFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'total_packets' | 'total_bytes' | 'last_seen'>('total_packets');
  const [sortAsc, setSortAsc] = useState(false);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFlows = useMemo(() => {
    return flows.filter((f) => {
      // Search
      if (search.trim()) {
        const s = search.toLowerCase();
        const match = 
          f.src_ip.toLowerCase().includes(s) ||
          f.dst_ip.toLowerCase().includes(s) ||
          f.sni.toLowerCase().includes(s) ||
          f.app.toLowerCase().includes(s) ||
          String(f.src_port).includes(s) ||
          String(f.dst_port).includes(s);
        if (!match) return false;
      }

      // App filter
      if (appFilter !== 'ALL' && f.app.toUpperCase() !== appFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && f.status.toUpperCase() !== statusFilter) {
        return false;
      }

      // Proto filter
      if (protoFilter !== 'ALL' && f.protocol.toUpperCase() !== protoFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [flows, search, appFilter, statusFilter, protoFilter, sortField, sortAsc]);

  const uniqueApps = Array.from(new Set(flows.map(f => f.app.toUpperCase()))).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls Bar */}
      <div className="panel-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP, Port, SNI, App..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* App Select */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono">
            <span className="text-slate-400">APP:</span>
            <select
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              className="bg-transparent text-cyan-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">ALL APPS</option>
              {uniqueApps.map(a => (
                <option key={a} value={a} className="bg-slate-900">{a}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono">
            <span className="text-slate-400">STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-cyan-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">ALL STATUS</option>
              <option value="CLASSIFIED" className="bg-slate-900">CLASSIFIED</option>
              <option value="BLOCKED" className="bg-slate-900">BLOCKED</option>
              <option value="IN_PROGRESS" className="bg-slate-900">IN_PROGRESS</option>
            </select>
          </div>

          {/* Proto Select */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono">
            <span className="text-slate-400">PROTO:</span>
            <select
              value={protoFilter}
              onChange={(e) => setProtoFilter(e.target.value)}
              className="bg-transparent text-cyan-400 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">ALL</option>
              <option value="TCP" className="bg-slate-900">TCP</option>
              <option value="UDP" className="bg-slate-900">UDP</option>
            </select>
          </div>
        </div>

        {/* Counter */}
        <div className="text-xs font-mono text-slate-400 shrink-0">
          Showing <strong className="text-cyan-400">{filteredFlows.length}</strong> of {flows.length} flows
        </div>
      </div>

      {/* Flows Table */}
      <div className="panel-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">Connection 5-Tuple</th>
                <th className="p-3.5">Proto</th>
                <th className="p-3.5">L7 App</th>
                <th className="p-3.5">Extracted SNI / Host</th>
                <th 
                  className="p-3.5 cursor-pointer hover:text-cyan-400 select-none"
                  onClick={() => {
                    if (sortField === 'total_packets') setSortAsc(!sortAsc);
                    else { setSortField('total_packets'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Packets</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  className="p-3.5 cursor-pointer hover:text-cyan-400 select-none"
                  onClick={() => {
                    if (sortField === 'total_bytes') setSortAsc(!sortAsc);
                    else { setSortField('total_bytes'); setSortAsc(false); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Bytes</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right pr-4">Pipeline Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFlows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No active network flows match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredFlows.map((flow) => (
                  <tr 
                    key={flow.flow_key}
                    onClick={() => onSelectFlow(flow)}
                    className="hover:bg-slate-850/70 transition-colors cursor-pointer group"
                  >
                    {/* 5-Tuple */}
                    <td className="p-3.5 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-300 font-semibold">{flow.src_ip}</span>
                        <span className="text-slate-400">:{flow.src_port}</span>
                        <span className="text-slate-400 text-[10px]">➔</span>
                        <span className="text-indigo-300 font-semibold">{flow.dst_ip}</span>
                        <span className="text-slate-400">:{flow.dst_port}</span>
                      </div>
                    </td>

                    {/* Proto */}
                    <td className="p-3.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {flow.protocol}
                      </span>
                    </td>

                    {/* App */}
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        flow.app === 'HTTPS' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                        flow.app === 'DNS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        flow.app === 'HTTP' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {flow.app}
                      </span>
                    </td>

                    {/* SNI */}
                    <td className="p-3.5 max-w-xs truncate">
                      {flow.sni && flow.sni !== '-' ? (
                        <div className="flex items-center gap-1.5 text-purple-300 font-semibold truncate">
                          <Globe className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">{flow.sni}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Packets */}
                    <td className="p-3.5 font-bold text-slate-200">
                      {flow.total_packets.toLocaleString()}
                    </td>

                    {/* Bytes */}
                    <td className="p-3.5 text-slate-400">
                      {formatBytes(flow.total_bytes)}
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        flow.status === 'BLOCKED' ? 'badge-rose' :
                        flow.status === 'CLASSIFIED' ? 'badge-emerald' :
                        'badge-amber'
                      }`}>
                        {flow.status}
                      </span>
                    </td>

                    {/* Trace Action */}
                    <td className="p-3.5 text-right pr-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFlow(flow);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 group-hover:bg-cyan-950 border border-slate-800 group-hover:border-cyan-500/40 text-slate-400 group-hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                      >
                        <span className="text-[10px] hidden sm:inline">Trace</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
