import React, { useState } from 'react';
import { Globe, Search, ShieldAlert, CheckCircle2, Lock, ExternalLink } from 'lucide-react';

interface DomainsViewProps {
  domains: Record<string, number>;
  onBlockDomain: (domain: string) => void;
}

export const DomainsView: React.FC<DomainsViewProps> = ({
  domains,
  onBlockDomain,
}) => {
  const [search, setSearch] = useState('');
  const domainEntries = Object.entries(domains);
  const totalQueries = domainEntries.reduce((acc, [, count]) => acc + count, 0);

  const filtered = domainEntries.filter(([domain]) => 
    domain.toLowerCase().includes(search.toLowerCase())
  ).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="panel-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-400" />
            <span>EXTRACTED TLS SNI & HOSTNAME INTELLIGENCE</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            DPI engine parses ClientHello extensions and HTTP headers to detect destination endpoints.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain or TLD..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Domains Table */}
      <div className="panel-card overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400 uppercase">
            Identified Endpoints ({filtered.length} Domains)
          </span>
          <span className="badge-purple">{totalQueries} Total Invocations</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">Target FQDN / SNI</th>
                <th className="p-3.5">Protocol Type</th>
                <th className="p-3.5">Flow Occurrences</th>
                <th className="p-3.5">Traffic Share</th>
                <th className="p-3.5 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No domains or SNIs detected in active streams.
                  </td>
                </tr>
              ) : (
                filtered.map(([domain, count]) => {
                  const sharePct = totalQueries > 0 ? Math.round((count / totalQueries) * 100) : 0;

                  return (
                    <tr key={domain} className="hover:bg-slate-850/60 transition-colors">
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-purple-400 shrink-0" />
                          <span className="text-slate-200 font-bold">{domain}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                          TLS ClientHello
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-300">
                        {count} flows
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${Math.max(5, sharePct)}%` }}
                            />
                          </div>
                          <span className="text-slate-400 text-[11px]">{sharePct}%</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <button
                          onClick={() => onBlockDomain(domain)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Block SNI</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
