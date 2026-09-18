import { DPIRule, DPIStats, FlowItem, PCAPFile, SecurityEvent, ThreadStat, TrafficPoint } from '../types';

const API_BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getEngineStatus() {
    const res = await fetch(`${API_BASE}/engine/status`);
    return res.json();
  },

  async startEngine(config: {
    pcap_file?: string;
    lb_threads?: number;
    fp_threads?: number;
    pacing_us?: number;
    custom_rules?: Array<{ type: string; value: string }>;
  }) {
    const res = await fetch(`${API_BASE}/engine/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async stopEngine() {
    const res = await fetch(`${API_BASE}/engine/stop`, { method: 'POST' });
    return res.json();
  },

  async restartEngine() {
    const res = await fetch(`${API_BASE}/engine/restart`, { method: 'POST' });
    return res.json();
  },

  async getStats(): Promise<{ stats: DPIStats; active_rules_count: number; security_events_count: number; threads_count: number }> {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },

  async getTrafficHistory(): Promise<TrafficPoint[]> {
    const res = await fetch(`${API_BASE}/traffic/history`);
    return res.json();
  },

  async getFlows(params?: { app_filter?: string; status_filter?: string; search?: string; limit?: number }): Promise<{ total: number; flows: FlowItem[] }> {
    const query = new URLSearchParams();
    if (params?.app_filter) query.set('app_filter', params.app_filter);
    if (params?.status_filter) query.set('status_filter', params.status_filter);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/flows?${query.toString()}`);
    return res.json();
  },

  async getFlowDetail(flowKey: string): Promise<FlowItem> {
    const res = await fetch(`${API_BASE}/flows/${encodeURIComponent(flowKey)}`);
    return res.json();
  },

  async getApplications(): Promise<{ breakdown: Record<string, number>; total_classified: number }> {
    const res = await fetch(`${API_BASE}/applications`);
    return res.json();
  },

  async getDomains(): Promise<{ domains: Record<string, number>; total_domains: number }> {
    const res = await fetch(`${API_BASE}/domains`);
    return res.json();
  },

  async getThreads(): Promise<{ threads: ThreadStat[]; load_imbalance_pct: number; is_imbalanced: boolean }> {
    const res = await fetch(`${API_BASE}/threads`);
    return res.json();
  },

  async getSecurityEvents(limit: number = 50): Promise<SecurityEvent[]> {
    const res = await fetch(`${API_BASE}/security/events?limit=${limit}`);
    return res.json();
  },

  async getRules(): Promise<DPIRule[]> {
    const res = await fetch(`${API_BASE}/rules`);
    return res.json();
  },

  async createRule(rule: { type: string; value: string }): Promise<DPIRule> {
    const res = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return res.json();
  },

  async deleteRule(ruleId: number): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/rules/${ruleId}`, { method: 'DELETE' });
    return res.json();
  },

  async startReplay(speed: number = 1.0) {
    const res = await fetch(`${API_BASE}/replay/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed }),
    });
    return res.json();
  },

  async stopReplay() {
    const res = await fetch(`${API_BASE}/replay/stop`, { method: 'POST' });
    return res.json();
  },

  async getPcaps(): Promise<PCAPFile[]> {
    const res = await fetch(`${API_BASE}/pcap/list`);
    return res.json();
  },

  async uploadPcap(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/pcap/upload`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  }
};
