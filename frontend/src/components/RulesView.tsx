import React, { useState } from 'react';
import { 
  Shield, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Zap, 
  Globe, 
  Lock, 
  Hash, 
  CheckCircle2 
} from 'lucide-react';
import { DPIRule } from '../types';

interface RulesViewProps {
  rules: DPIRule[];
  onAddRule: (type: string, value: string) => Promise<void>;
  onDeleteRule: (ruleId: number) => Promise<void>;
}

export const RulesView: React.FC<RulesViewProps> = ({
  rules,
  onAddRule,
  onDeleteRule,
}) => {
  const [ruleType, setRuleType] = useState<string>('DOMAIN');
  const [ruleValue, setRuleValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleValue.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddRule(ruleType, ruleValue.trim());
      setRuleValue('');
      setFeedback(`Rule added: ${ruleType} ${ruleValue.trim()}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to add rule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdd = async (type: string, val: string) => {
    await onAddRule(type, val);
    setFeedback(`Quick rule added: ${type} ${val}`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Add Rule Card */}
      <div className="panel-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold font-mono tracking-tight text-slate-100">
              DPI ACCESS CONTROL & TRAFFIC MITIGATION ENGINE
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Dynamically injected into C++ pipeline via IPC
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          {/* Rule Type Selector */}
          <div className="w-full sm:w-48 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono">
            <label className="block text-[10px] text-slate-400 uppercase mb-0.5">RULE TARGET</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full bg-transparent text-cyan-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="DOMAIN" className="bg-slate-900">DOMAIN / SNI</option>
              <option value="IP" className="bg-slate-900">IP ADDRESS</option>
              <option value="APP" className="bg-slate-900">APPLICATION (L7)</option>
              <option value="PORT" className="bg-slate-900">PORT NUMBER</option>
            </select>
          </div>

          {/* Rule Value Input */}
          <div className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono">
            <label className="block text-[10px] text-slate-400 uppercase mb-0.5">MATCH PATTERN / VALUE</label>
            <input
              type="text"
              value={ruleValue}
              onChange={(e) => setRuleValue(e.target.value)}
              placeholder={
                ruleType === 'DOMAIN' ? 'e.g., example.com or malicious-tracker.net' :
                ruleType === 'IP' ? 'e.g., 192.168.1.100 or 10.0.0.50' :
                ruleType === 'APP' ? 'e.g., HTTPS, DNS, HTTP, SSH' :
                'e.g., 443, 80, 53, 22'
              }
              className="w-full bg-transparent text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !ruleValue.trim()}
            className="w-full sm:w-auto h-[54px] px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 text-white font-mono text-xs font-semibold shadow-lg shadow-indigo-950/50 border border-indigo-400/30 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>INJECT RULE</span>
          </button>
        </form>

        {/* Quick Presets */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px] mr-1">QUICK INJECT:</span>
          <button
            onClick={() => handleQuickAdd('DOMAIN', 'example.com')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            + Block 'example.com'
          </button>
          <button
            onClick={() => handleQuickAdd('APP', 'DNS')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            + Block App 'DNS'
          </button>
          <button
            onClick={() => handleQuickAdd('IP', '192.168.1.100')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            + Block IP '192.168.1.100'
          </button>
        </div>

        {feedback && (
          <div className="mt-3 p-2 rounded bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* 2. Active Rules Table */}
      <div className="panel-card overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-200">
              Active In-Engine Blocking Rules
            </h3>
          </div>
          <span className="badge-indigo">{rules.length} RULES ACTIVE</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3.5 pl-4">Rule ID</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Blocked Target / Pattern</th>
                <th className="p-3.5">Matches Intercepted</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No active filtering rules configured. All network traffic is currently allowed.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="p-3.5 pl-4 text-slate-400">
                      #{rule.id}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.type === 'DOMAIN' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                        rule.type === 'IP' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                        rule.type === 'APP' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' :
                        'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {rule.type}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-slate-100 font-bold">{rule.value}</span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rule.match_count > 0 ? 'badge-rose' : 'badge-slate'
                      }`}>
                        {rule.match_count} DROPPED
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">
                      {rule.created_at ? new Date(rule.created_at).toLocaleTimeString() : 'INIT'}
                    </td>
                    <td className="p-3.5 text-right pr-4">
                      <button
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 className="h-4 w-4" />
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
