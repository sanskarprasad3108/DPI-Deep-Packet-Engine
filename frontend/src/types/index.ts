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

export interface HealthProbe {
  timestamp: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  latency_ms: number;
  components?: Record<string, any>;
  error?: string | null;
}

export interface OperationalIncident {
  id: number;
  timestamp: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  type: string;
  message: string;
  resolved: boolean;
}

export interface UptimeStats {
  status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  uptime_seconds: number;
  uptime_human: string;
  availability_pct_24h: number;
  availability_pct_7d: number;
  availability_pct_30d: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  latency: {
    avg_ms: number;
    min_ms: number;
    max_ms: number;
    recent_history: HealthProbe[];
  };
  incidents: OperationalIncident[];
}

export interface DetailedHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: {
    seconds: number;
    human: string;
    availability_24h: number;
    availability_7d: number;
    availability_30d: number;
  };
  engine: {
    running: boolean;
    replaying: boolean;
    current_pcap: string;
    lb_threads: number;
    fp_threads: number;
    total_packets: number;
    current_pps: number;
    drop_rate_pct: number;
    active_flows: number;
  };
  system: {
    platform: string;
    python_version: string;
    os_name: string;
    cpu_count: number;
    process_pid: number;
    disk: {
      total_gb: number;
      used_gb: number;
      free_gb: number;
      used_percent: number;
    };
    memory: {
      total_mb: number;
      available_mb: number;
      used_percent: number;
      process_rss_mb: number;
    };
    cpu_percent: number;
    process_cpu_percent: number;
  };
  telemetry: {
    active_subscribers: number;
    traffic_points_recorded: number;
    security_events_count: number;
  };
  warnings: string[];
}

export interface UptimeRobotMonitor {
  id: number;
  friendly_name: string;
  url: string;
  type: number;
  status: number; // 0: paused, 1: not checked, 2: up, 8: seems down, 9: down
  interval: number;
  custom_uptime_ratio?: string;
  response_times?: Array<{ datetime: number; value: number }>;
}

