import { useEffect, useRef, useState, useCallback } from 'react';
import { DPIRule, DPIStats, FlowItem, SecurityEvent, ThreadStat, TrafficPoint, TelemetryWebSocketMessage } from '../types';

const INITIAL_STATS: DPIStats = {
  total_packets: 0,
  total_bytes: 0,
  active_flows: 0,
  completed_flows: 0,
  dropped_packets: 0,
  forwarded_packets: 0,
  sni_detected: 0,
  apps_classified: 0,
  current_pps: 0.0,
  current_bps: 0.0,
  drop_rate_pct: 0.0,
  runtime_seconds: 0.0,
};

export function useTelemetry() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [engineStatus, setEngineStatus] = useState<string>('STOPPED');
  const [currentPcap, setCurrentPcap] = useState<string>('test_dpi.pcap');
  const [stats, setStats] = useState<DPIStats>(INITIAL_STATS);
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [threads, setThreads] = useState<ThreadStat[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [applications, setApplications] = useState<Record<string, number>>({});
  const [domains, setDomains] = useState<Record<string, number>>({});
  const [rules, setRules] = useState<DPIRule[]>([]);
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>([]);
  const [threadImbalancePct, setThreadImbalancePct] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/telemetry`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[WebSocket] Connected to DPI Telemetry Stream');
      };

      ws.onmessage = (event) => {
        try {
          const msg: TelemetryWebSocketMessage = JSON.parse(event.data);

          if (msg.type === 'SNAPSHOT') {
            if (msg.stats) setStats(msg.stats);
            if (msg.flows) setFlows(msg.flows);
            if (msg.threads) setThreads(msg.threads);
            if (msg.security_events) setSecurityEvents(msg.security_events);
            if (msg.applications) setApplications(msg.applications);
            if (msg.domains) setDomains(msg.domains);
            if (msg.rules) setRules(msg.rules);
            if (msg.status) setEngineStatus(msg.status);
            if (msg.pcap) setCurrentPcap(msg.pcap);
            if (msg.is_running !== undefined) {
              setEngineStatus(msg.is_running ? 'RUNNING' : 'STOPPED');
            }
            if (msg.is_replaying !== undefined) {
              setIsReplaying(msg.is_replaying);
            }
          } else if (msg.type === 'HEARTBEAT') {
            if (msg.stats) setStats(msg.stats);
            if (msg.thread_imbalance_pct !== undefined) {
              setThreadImbalancePct(msg.thread_imbalance_pct);
            }
          } else if (msg.type === 'ENGINE_STATUS') {
            if (msg.status) setEngineStatus(msg.status);
            if (msg.pcap) setCurrentPcap(msg.pcap);
          } else if (msg.type === 'REPLAY_STATUS') {
            setIsReplaying(msg.status === 'RUNNING');
          } else if (msg.type === 'RULE_ADDED' && msg.data?.rule) {
            setRules(prev => [...prev, msg.data.rule]);
          } else if (msg.type === 'RULE_REMOVED' && msg.data?.rule_id) {
            setRules(prev => prev.filter(r => r.id !== msg.data.rule_id));
          } else if (msg.type === 'TELEMETRY_EVENT') {
            if (msg.stats) setStats(msg.stats);
            const evType = msg.event;
            const data = msg.data;

            if (evType === 'STATS_UPDATE') {
              setTrafficHistory(prev => {
                const next = [...prev, {
                  time: new Date().toLocaleTimeString(),
                  timestamp: Date.now(),
                  pps: data.pps || 0,
                  bps: data.bps || 0,
                  total_packets: data.packets_total || 0,
                  dropped: data.dropped_packets || 0,
                  forwarded: data.forwarded_packets || 0,
                }];
                return next.slice(-60); // keep last 60 points
              });
            } else if (evType === 'FLOW_UPDATED') {
              setFlows(prev => {
                const fKey = data.flow_key || `${data.src_ip}:${data.src_port}->${data.dst_ip}:${data.dst_port}`;
                const idx = prev.findIndex(f => f.flow_key === fKey);
                const updatedFlow: FlowItem = {
                  flow_key: fKey,
                  src_ip: data.src_ip,
                  dst_ip: data.dst_ip,
                  src_port: data.src_port,
                  dst_port: data.dst_port,
                  protocol: data.protocol || 'TCP',
                  app: data.app || 'UNKNOWN',
                  sni: data.sni || '-',
                  status: data.status || 'IN_PROGRESS',
                  total_packets: data.total_packets || 1,
                  total_bytes: data.total_bytes || 0,
                  first_seen: data.first_seen || new Date().toISOString(),
                  last_seen: new Date().toISOString(),
                  journey_steps: data.journey_steps || [],
                  block_reason: data.block_reason || '',
                };

                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = updatedFlow;
                  return copy;
                } else {
                  return [updatedFlow, ...prev.slice(0, 199)]; // keep latest 200
                }
              });

              if (data.app && data.app !== 'UNKNOWN') {
                setApplications(prev => ({
                  ...prev,
                  [data.app]: (prev[data.app] || 0) + 1,
                }));
              }
              if (data.sni && data.sni !== '-' && data.sni !== '') {
                setDomains(prev => ({
                  ...prev,
                  [data.sni]: (prev[data.sni] || 0) + 1,
                }));
              }
            } else if (evType === 'SECURITY_EVENT') {
              const secEv: SecurityEvent = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                time_str: new Date().toLocaleTimeString(),
                reason: data.reason || 'BLOCKED',
                rule_matched: data.rule_matched || 'N/A',
                src_ip: data.src_ip || '',
                dst_ip: data.dst_ip || '',
                src_port: data.src_port || 0,
                dst_port: data.dst_port || 0,
                sni: data.sni || '-',
                app: data.app || '-',
              };
              setSecurityEvents(prev => [secEv, ...prev.slice(0, 99)]);
            } else if (evType === 'THREAD_STATS') {
              setThreads(prev => {
                const tName = data.thread_name;
                const idx = prev.findIndex(t => t.thread_name === tName);
                const stat: ThreadStat = {
                  thread_name: tName,
                  thread_type: data.thread_type || 'WORKER',
                  packets_processed: data.packets_processed || 0,
                  bytes_processed: data.bytes_processed || 0,
                  queue_current: data.queue_current || 0,
                  queue_peak: data.queue_peak || 0,
                  utilization_pct: data.queue_peak > 0 ? Math.min(100, Math.round((data.queue_current / data.queue_peak) * 100)) : 0,
                  is_overloaded: (data.queue_current || 0) > 500,
                };
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = stat;
                  return copy;
                } else {
                  return [...prev, stat];
                }
              });
            }
          }
        } catch (err) {
          console.error('[WebSocket] Error processing message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('[WebSocket] Disconnected. Retrying in 2s...');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  return {
    isConnected,
    engineStatus,
    setEngineStatus,
    currentPcap,
    setCurrentPcap,
    stats,
    setStats,
    flows,
    setFlows,
    threads,
    setThreads,
    securityEvents,
    applications,
    domains,
    rules,
    setRules,
    trafficHistory,
    threadImbalancePct,
    isReplaying,
  };
}
