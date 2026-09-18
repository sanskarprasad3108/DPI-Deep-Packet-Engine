import asyncio
import json
import logging
import os
import sys
import time
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("DPIManager")

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_ENGINE_EXE = os.getenv(
    "DPI_ENGINE_PATH",
    os.path.join(WORKSPACE_ROOT, "dpi_engine.exe" if os.name == "nt" else "build", "dpi_engine"),
)
DEFAULT_PCAP = os.path.join(WORKSPACE_ROOT, "test_dpi.pcap")


class DPIEngineManager:
    def __init__(self):
        self.process: Optional[asyncio.subprocess.Process] = None
        self.is_running: bool = False
        self.is_replaying: bool = False
        self.replay_task: Optional[asyncio.Task] = None
        
        # Current config
        self.engine_path: str = DEFAULT_ENGINE_EXE
        self.current_pcap: str = DEFAULT_PCAP
        self.lb_threads: int = 2
        self.fp_threads: int = 4
        self.pacing_us: int = 20000  # 20ms pacing between packets for smooth live visualization
        
        # State storage
        self.stats: Dict[str, Any] = {
            "total_packets": 0,
            "total_bytes": 0,
            "active_flows": 0,
            "completed_flows": 0,
            "dropped_packets": 0,
            "forwarded_packets": 0,
            "sni_detected": 0,
            "apps_classified": 0,
            "current_pps": 0.0,
            "current_bps": 0.0,
            "drop_rate_pct": 0.0,
            "runtime_seconds": 0.0,
        }
        
        self.flows: Dict[str, Dict[str, Any]] = {}  # key -> flow details
        self.traffic_history: deque = deque(maxlen=120)  # sliding window for charts
        self.security_events: deque = deque(maxlen=200)
        self.packet_samples: deque = deque(maxlen=100)
        self.thread_stats: Dict[str, Dict[str, Any]] = {}
        self.application_breakdown: Dict[str, int] = {}
        self.domain_breakdown: Dict[str, int] = {}
        
        # Rules tracked in backend (synced to C++ engine)
        self.rules: List[Dict[str, Any]] = []
        self._rule_id_counter = 1
        
        # Recorded telemetry events for replay
        self.recorded_events: List[Dict[str, Any]] = []
        self.is_recording: bool = True
        
        # WebSocket subscriber queues
        self.subscribers: Set[asyncio.Queue] = set()
        
        # Background reader task
        self.reader_task: Optional[asyncio.Task] = None
        self.stats_heartbeat_task: Optional[asyncio.Task] = None
        self.start_time: float = 0.0

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a JSON message to all connected WebSocket clients."""
        if not self.subscribers:
            return
        dead_subs = set()
        for q in self.subscribers:
            try:
                if q.qsize() > 500:
                    # Drop oldest if queue is backing up
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(message)
            except Exception:
                dead_subs.add(q)
        for dead in dead_subs:
            self.subscribers.discard(dead)

    def register_subscriber(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=1000)
        self.subscribers.add(q)
        return q

    def unregister_subscriber(self, q: asyncio.Queue):
        self.subscribers.discard(q)

    def _reset_state(self):
        """Reset live counters and in-memory flow state for new run."""
        self.stats = {
            "total_packets": 0,
            "total_bytes": 0,
            "active_flows": 0,
            "completed_flows": 0,
            "dropped_packets": 0,
            "forwarded_packets": 0,
            "sni_detected": 0,
            "apps_classified": 0,
            "current_pps": 0.0,
            "current_bps": 0.0,
            "drop_rate_pct": 0.0,
            "runtime_seconds": 0.0,
        }
        self.flows.clear()
        self.traffic_history.clear()
        self.security_events.clear()
        self.packet_samples.clear()
        self.thread_stats.clear()
        self.application_breakdown.clear()
        self.domain_breakdown.clear()
        self.start_time = time.time()

    async def start_engine(
        self,
        pcap_file: Optional[str] = None,
        lb_threads: int = 2,
        fp_threads: int = 4,
        pacing_us: int = 20000,
        custom_rules: Optional[List[Dict[str, str]]] = None,
    ) -> bool:
        """Start the C++ DPI engine as a subprocess with telemetry streaming."""
        if self.is_running:
            await self.stop_engine()

        if self.is_replaying:
            await self.stop_replay()

        self._reset_state()
        self.recorded_events.clear()

        pcap_path = pcap_file or self.current_pcap
        if not os.path.isabs(pcap_path):
            pcap_path = os.path.join(WORKSPACE_ROOT, pcap_path)

        if not os.path.exists(pcap_path):
            logger.error(f"PCAP file not found: {pcap_path}")
            return False

        if not os.path.exists(self.engine_path):
            logger.error(f"DPI Engine executable not found: {self.engine_path}")
            return False

        self.current_pcap = pcap_path
        self.lb_threads = lb_threads
        self.fp_threads = fp_threads
        self.pacing_us = pacing_us

        cmd = [
            self.engine_path,
            "--pcap", pcap_path,
            "--telemetry-json",
            "--interactive",
            "--pacing-us", str(pacing_us),
            "--lb-threads", str(lb_threads),
            "--fp-threads", str(fp_threads),
        ]

        # Add existing rules or custom rules
        active_rules = custom_rules if custom_rules is not None else [
            {"type": r["type"], "value": r["value"]} for r in self.rules
        ]
        for r in active_rules:
            rtype = r.get("type", "").upper()
            val = r.get("value", "")
            if rtype == "IP":
                cmd.extend(["--block-ip", val])
            elif rtype == "DOMAIN":
                cmd.extend(["--block-domain", val])
            elif rtype == "APP":
                cmd.extend(["--block-app", val])
            elif rtype == "PORT":
                cmd.extend(["--block-port", val])

        logger.info(f"Launching DPI Engine: {' '.join(cmd)}")

        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self.is_running = True
            self.start_time = time.time()

            self.reader_task = asyncio.create_task(self._process_stdout_loop())
            self.stats_heartbeat_task = asyncio.create_task(self._stats_heartbeat_loop())

            await self.broadcast({
                "type": "ENGINE_STATUS",
                "status": "RUNNING",
                "pcap": os.path.basename(pcap_path),
                "lb_threads": lb_threads,
                "fp_threads": fp_threads,
                "pacing_us": pacing_us,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            return True
        except Exception as e:
            logger.exception(f"Failed to start DPI engine: {e}")
            self.is_running = False
            return False

    async def stop_engine(self):
        """Stop the running DPI engine process."""
        if not self.is_running or not self.process:
            return

        logger.info("Stopping DPI Engine...")
        try:
            if self.process.stdin and not self.process.stdin.is_closing():
                try:
                    self.process.stdin.write(b"QUIT\n")
                    await self.process.stdin.drain()
                except Exception:
                    pass
            
            try:
                await asyncio.wait_for(self.process.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()
        except Exception as e:
            logger.warning(f"Error while terminating process: {e}")
        finally:
            self.is_running = False
            if self.reader_task and not self.reader_task.done():
                self.reader_task.cancel()
            if self.stats_heartbeat_task and not self.stats_heartbeat_task.done():
                self.stats_heartbeat_task.cancel()

            await self.broadcast({
                "type": "ENGINE_STATUS",
                "status": "STOPPED",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })

    async def restart_engine(self) -> bool:
        """Restart engine with current parameters."""
        await self.stop_engine()
        await asyncio.sleep(0.5)
        return await self.start_engine(
            pcap_file=self.current_pcap,
            lb_threads=self.lb_threads,
            fp_threads=self.fp_threads,
            pacing_us=self.pacing_us,
        )

    async def add_rule(self, rule_type: str, value: str) -> Dict[str, Any]:
        """Dynamically push a rule into the C++ engine via stdin and track it."""
        rule_obj = {
            "id": self._rule_id_counter,
            "type": rule_type.upper(),
            "value": value.strip(),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "match_count": 0,
        }
        self._rule_id_counter += 1
        self.rules.append(rule_obj)

        if self.is_running and self.process and self.process.stdin and not self.process.stdin.is_closing():
            cmd_map = {
                "IP": "BLOCK_IP",
                "DOMAIN": "BLOCK_DOMAIN",
                "APP": "BLOCK_APP",
                "PORT": "BLOCK_PORT",
            }
            cmd_prefix = cmd_map.get(rule_type.upper(), "BLOCK_DOMAIN")
            line = f"{cmd_prefix} {value.strip()}\n"
            try:
                self.process.stdin.write(line.encode("utf-8"))
                await self.process.stdin.drain()
                logger.info(f"Dispatched stdin command to DPI Engine: {line.strip()}")
            except Exception as e:
                logger.error(f"Failed to send rule to engine stdin: {e}")

        await self.broadcast({
            "type": "RULE_ADDED",
            "rule": rule_obj,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        return rule_obj

    async def delete_rule(self, rule_id: int) -> bool:
        """Remove a rule from backend tracking."""
        initial_len = len(self.rules)
        self.rules = [r for r in self.rules if r["id"] != rule_id]
        if len(self.rules) < initial_len:
            await self.broadcast({
                "type": "RULE_REMOVED",
                "rule_id": rule_id,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            return True
        return False

    async def _process_stdout_loop(self):
        """Read stdout from C++ engine and dispatch JSON telemetry lines."""
        if not self.process or not self.process.stdout:
            return

        try:
            while self.is_running:
                line_bytes = await self.process.stdout.readline()
                if not line_bytes:
                    break
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                if line.startswith("[TELEMETRY_JSON]"):
                    json_str = line[len("[TELEMETRY_JSON]"):].strip()
                    try:
                        data = json.loads(json_str)
                        await self._handle_telemetry_event(data)
                    except json.JSONDecodeError as jde:
                        logger.debug(f"JSON decode err: {jde} for line: {line}")
                else:
                    logger.debug(f"[DPI Stdout] {line}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception(f"Error in stdout loop: {e}")
        finally:
            self.is_running = False
            await self.broadcast({
                "type": "ENGINE_STATUS",
                "status": "FINISHED",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
            logger.info("DPI Engine stdout processing finished.")

    async def _handle_telemetry_event(self, data: Dict[str, Any]):
        """Update internal state and broadcast event."""
        if self.is_recording:
            self.recorded_events.append(data)

        event_type = data.get("type") or data.get("event")
        payload = data.get("data") if "data" in data else data

        if event_type == "STATS_UPDATE" and isinstance(payload, dict):
            self.stats["total_packets"] = payload.get("total_packets", payload.get("packets_total", self.stats["total_packets"]))
            self.stats["total_bytes"] = payload.get("total_bytes", payload.get("bytes_total", self.stats["total_bytes"]))
            self.stats["active_flows"] = payload.get("active_flows", max(len(self.flows), self.stats["active_flows"]))
            self.stats["completed_flows"] = payload.get("completed_flows", self.stats["completed_flows"])
            self.stats["dropped_packets"] = payload.get("dropped_packets", payload.get("dropped", self.stats["dropped_packets"]))
            self.stats["forwarded_packets"] = payload.get("forwarded_packets", payload.get("forwarded", self.stats["forwarded_packets"]))
            self.stats["sni_detected"] = len(self.domain_breakdown)
            self.stats["apps_classified"] = len(self.application_breakdown)
            self.stats["current_pps"] = payload.get("pps", 0.0)
            self.stats["current_bps"] = payload.get("bps", 0.0)
            self.stats["runtime_seconds"] = round(time.time() - self.start_time, 2)

            total = self.stats["total_packets"]
            dropped = self.stats["dropped_packets"]
            self.stats["drop_rate_pct"] = round((dropped / total * 100.0), 2) if total > 0 else 0.0

            # Add to traffic history
            self.traffic_history.append({
                "time": datetime.utcnow().strftime("%H:%M:%S"),
                "timestamp": time.time(),
                "pps": self.stats["current_pps"] or (total / max(1.0, self.stats["runtime_seconds"])),
                "bps": self.stats["current_bps"],
                "total_packets": total,
                "dropped": dropped,
                "forwarded": self.stats["forwarded_packets"],
            })

        elif event_type == "FLOW_UPDATED" and isinstance(payload, dict):
            src_ip = payload.get("src_ip", "")
            dst_ip = payload.get("dst_ip", "")
            src_port = payload.get("src_port", 0)
            dst_port = payload.get("dst_port", 0)
            f_key = payload.get("flow_id") or payload.get("flow_key") or f"{src_ip}:{src_port}->{dst_ip}:{dst_port}"
            
            existing = self.flows.get(f_key, {})
            app = payload.get("application") or payload.get("app") or existing.get("app", "UNKNOWN")
            sni = payload.get("sni") if payload.get("sni") is not None else existing.get("sni", "-")
            status = payload.get("status") or existing.get("status", "IN_PROGRESS")
            if status == "FORWARDED":
                status = "CLASSIFIED"
            elif status == "DROPPED":
                status = "BLOCKED"
            
            journey = payload.get("journey") or payload.get("journey_steps") or existing.get("journey_steps", [])
            block_reason = payload.get("block_reason") or existing.get("block_reason", "")
            
            # Update app breakdown
            if app and app != "UNKNOWN":
                self.application_breakdown[app] = self.application_breakdown.get(app, 0) + 1
            if sni and sni != "-" and sni != "":
                self.domain_breakdown[sni] = self.domain_breakdown.get(sni, 0) + 1

            flow_entry = {
                "flow_key": f_key,
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "src_port": src_port,
                "dst_port": dst_port,
                "protocol": payload.get("protocol", existing.get("protocol", "TCP")),
                "app": app,
                "sni": sni,
                "status": status,
                "total_packets": payload.get("packets", payload.get("total_packets", existing.get("total_packets", 1))),
                "total_bytes": payload.get("bytes", payload.get("total_bytes", existing.get("total_bytes", 0))),
                "first_seen": existing.get("first_seen", datetime.utcnow().isoformat() + "Z"),
                "last_seen": datetime.utcnow().isoformat() + "Z",
                "journey_steps": journey,
                "block_reason": block_reason,
            }
            self.flows[f_key] = flow_entry

        elif event_type == "SECURITY_EVENT" and isinstance(payload, dict):
            sec_ev = {
                "id": len(self.security_events) + 1,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "time_str": datetime.utcnow().strftime("%H:%M:%S"),
                "reason": payload.get("reason", "BLOCKED"),
                "rule_matched": payload.get("rule_matched", "N/A"),
                "src_ip": payload.get("src_ip"),
                "dst_ip": payload.get("dst_ip"),
                "src_port": payload.get("src_port"),
                "dst_port": payload.get("dst_port"),
                "sni": payload.get("sni", "-"),
                "app": payload.get("app", "-"),
            }
            self.security_events.appendleft(sec_ev)
            rule_matched = payload.get("rule_matched", "")
            for r in self.rules:
                if r["value"].lower() in rule_matched.lower():
                    r["match_count"] += 1

        elif event_type == "THREAD_STATS":
            if isinstance(payload, list):
                for t in payload:
                    t_type = t.get("thread_type", "WORKER")
                    t_id = t.get("thread_id", 0)
                    t_name = f"{t_type}{t_id}"
                    pkts = t.get("packets_processed", 0)
                    utilization = round(float(t.get("utilization", 0.0)) * 100.0, 1)
                    q_cur = t.get("queue_depth", 0)
                    self.thread_stats[t_name] = {
                        "thread_name": t_name,
                        "thread_type": "LOAD_BALANCER" if t_type == "LB" else ("FAST_PATH" if t_type == "FP" else "WORKER"),
                        "packets_processed": pkts,
                        "bytes_processed": t.get("bytes_processed", pkts * 80),
                        "queue_current": q_cur,
                        "queue_peak": max(q_cur, self.thread_stats.get(t_name, {}).get("queue_peak", q_cur)),
                        "utilization_pct": utilization,
                        "is_overloaded": q_cur > 500,
                        "last_update": time.time(),
                    }
            elif isinstance(payload, dict):
                t_name = payload.get("thread_name", "Unknown")
                q_cur = payload.get("queue_current", 0)
                q_peak = payload.get("queue_peak", 0)
                pkts = payload.get("packets_processed", 0)
                utilization = min(100.0, round((q_cur / max(1, q_peak or 100)) * 100.0, 1)) if q_peak > 0 else 0.0

                self.thread_stats[t_name] = {
                    "thread_name": t_name,
                    "thread_type": payload.get("thread_type", "WORKER"),
                    "packets_processed": pkts,
                    "bytes_processed": payload.get("bytes_processed", 0),
                    "queue_current": q_cur,
                    "queue_peak": q_peak,
                    "utilization_pct": utilization,
                    "is_overloaded": q_cur > 500,
                    "last_update": time.time(),
                }

        elif event_type == "PACKET_SAMPLE":
            pkt_data = {
                "packet_id": data.get("packet_id"),
                "src_ip": data.get("src_ip"),
                "dst_ip": data.get("dst_ip"),
                "src_port": data.get("src_port"),
                "dst_port": data.get("dst_port"),
                "protocol": data.get("protocol"),
                "size_bytes": data.get("size_bytes"),
                "action": data.get("action", "FORWARD"),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "time_str": datetime.utcnow().strftime("%H:%M:%S.%f")[:-3],
                "payload_snippet": data.get("payload_snippet", ""),
                "journey_steps": data.get("journey_steps", []),
            }
            self.packet_samples.appendleft(pkt_data)

        # Broadcast live event to WebSocket clients
        await self.broadcast({
            "type": "TELEMETRY_EVENT",
            "event": event_type,
            "data": data,
            "stats": self.stats,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

    async def _stats_heartbeat_loop(self):
        """Emit periodic aggregate stats update for charts when packets are streaming."""
        try:
            while self.is_running:
                await asyncio.sleep(1.0)
                if self.is_running:
                    # Calculate load imbalance among FP threads
                    fp_counts = [t["packets_processed"] for t in self.thread_stats.values() if t.get("thread_type") == "FAST_PATH"]
                    imbalance_pct = 0.0
                    if len(fp_counts) > 1 and max(fp_counts) > 0:
                        imbalance_pct = round(((max(fp_counts) - min(fp_counts)) / max(fp_counts)) * 100.0, 1)

                    await self.broadcast({
                        "type": "HEARTBEAT",
                        "stats": self.stats,
                        "thread_imbalance_pct": imbalance_pct,
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    })
        except asyncio.CancelledError:
            pass

    async def start_replay(self, speed_multiplier: float = 1.0) -> bool:
        """Replay recorded telemetry events for offline inspection and demoing."""
        if not self.recorded_events:
            logger.warning("No recorded events to replay.")
            return False

        if self.is_running:
            await self.stop_engine()
        if self.is_replaying:
            await self.stop_replay()

        self._reset_state()
        self.is_replaying = True

        async def _replay_worker():
            try:
                delay = 0.02 / max(0.1, min(10.0, speed_multiplier))
                for event in self.recorded_events:
                    if not self.is_replaying:
                        break
                    await self._handle_telemetry_event(event)
                    await asyncio.sleep(delay)
            except asyncio.CancelledError:
                pass
            finally:
                self.is_replaying = False
                await self.broadcast({
                    "type": "REPLAY_STATUS",
                    "status": "FINISHED",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })

        self.replay_task = asyncio.create_task(_replay_worker())
        await self.broadcast({
            "type": "REPLAY_STATUS",
            "status": "RUNNING",
            "speed": speed_multiplier,
            "total_events": len(self.recorded_events),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        return True

    async def stop_replay(self):
        """Stop replay task."""
        if self.replay_task and not self.replay_task.done():
            self.replay_task.cancel()
        self.is_replaying = False
        await self.broadcast({
            "type": "REPLAY_STATUS",
            "status": "STOPPED",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })


# Global singleton instance
engine_manager = DPIEngineManager()
