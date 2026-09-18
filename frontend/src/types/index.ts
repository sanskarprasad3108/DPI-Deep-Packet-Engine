export type EngineStatus = 'STOPPED' | 'RUNNING' | 'FINISHED';

export interface DPIStats {
  total_packets: number;
  total_bytes: number;
  active_flows: number;
  completed_flows: number;
  dropped_packets: number;
  forwarded_packets: number;
  sni_detected: number;
  apps_classified: number;
  current_pps: number;
  current_bps: number;
  drop_rate_pct: number;
  runtime_seconds: number;
}

export interface FlowItem {
  flow_key: string;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  app: string;
  sni: string;
  status: 'IN_PROGRESS' | 'CLASSIFIED' | 'BLOCKED';
  total_packets: number;
  total_bytes: number;
  first_seen: string;
  last_seen: string;
  journey_steps?: string[];
  block_reason?: string;
}

export interface ThreadStat {
  thread_name: string;
  thread_type: 'LOAD_BALANCER' | 'FAST_PATH' | 'WORKER';
  packets_processed: number;
  bytes_processed: number;
  queue_current: number;
  queue_peak: number;
  utilization_pct: number;
  is_overloaded: boolean;
  last_update?: number;
}

export interface SecurityEvent {
  id: number;
  timestamp: string;
  time_str: string;
  reason: string;
  rule_matched: string;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  sni: string;
  app: string;
}

export interface DPIRule {
  id: number;
  type: 'IP' | 'DOMAIN' | 'APP' | 'PORT';
  value: string;
  created_at: string;
  match_count: number;
}

export interface TrafficPoint {
  time: string;
  timestamp: number;
  pps: number;
  bps: number;
  total_packets: number;
  dropped: number;
  forwarded: number;
}

export interface PacketSample {
  packet_id: number;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  size_bytes: number;
  action: 'FORWARD' | 'DROP';
  timestamp: string;
  time_str: string;
  payload_snippet?: string;
  journey_steps?: string[];
}

export interface PCAPFile {
  filename: string;
  size_bytes: number;
  is_current: boolean;
}

export interface TelemetryWebSocketMessage {
  type: 'SNAPSHOT' | 'TELEMETRY_EVENT' | 'ENGINE_STATUS' | 'REPLAY_STATUS' | 'RULE_ADDED' | 'RULE_REMOVED' | 'HEARTBEAT';
  event?: string;
  data?: any;
  stats?: DPIStats;
  flows?: FlowItem[];
  threads?: ThreadStat[];
  security_events?: SecurityEvent[];
  applications?: Record<string, number>;
  domains?: Record<string, number>;
  rules?: DPIRule[];
  status?: string;
  pcap?: string;
  timestamp?: string;
  thread_imbalance_pct?: number;
  is_running?: boolean;
  is_replaying?: boolean;
}
