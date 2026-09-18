import asyncio
import os
import shutil
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .engine_manager import engine_manager, WORKSPACE_ROOT

FRONTEND_DIST = os.path.join(WORKSPACE_ROOT, "frontend", "dist")

app = FastAPI(
    title="DPI Engine Telemetry & Control API",
    description="Real-time Deep Packet Inspection Engine Telemetry & Network Security API",
    version="2.0.0"
)

# CORS configuration for Vite dev server & frontend ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartEngineRequest(BaseModel):
    pcap_file: Optional[str] = None
    lb_threads: Optional[int] = 2
    fp_threads: Optional[int] = 4
    pacing_us: Optional[int] = 20000  # 20ms default pacing for live visual inspection
    custom_rules: Optional[List[Dict[str, str]]] = None


class RuleRequest(BaseModel):
    type: str  # IP, DOMAIN, APP, PORT
    value: str


class ReplayRequest(BaseModel):
    speed: Optional[float] = 1.0


@app.get("/")
async def root():
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "status": "online",
        "service": "DPI Deep Packet Engine API",
        "version": "2.0.0",
        "docs_url": "/docs",
        "health_check": "/api/health",
        "engine_status": "/api/engine/status"
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "dpi-backend",
        "engine_running": engine_manager.is_running,
        "is_replaying": engine_manager.is_replaying,
        "recorded_events_count": len(engine_manager.recorded_events),
    }


@app.get("/api/engine/status")
async def get_engine_status():
    return {
        "is_running": engine_manager.is_running,
        "is_replaying": engine_manager.is_replaying,
        "current_pcap": os.path.basename(engine_manager.current_pcap),
        "lb_threads": engine_manager.lb_threads,
        "fp_threads": engine_manager.fp_threads,
        "pacing_us": engine_manager.pacing_us,
        "runtime_seconds": engine_manager.stats.get("runtime_seconds", 0.0),
        "total_flows": len(engine_manager.flows),
        "total_packets": engine_manager.stats.get("total_packets", 0),
        "dropped_packets": engine_manager.stats.get("dropped_packets", 0),
    }


@app.post("/api/engine/start")
async def start_engine(req: StartEngineRequest):
    success = await engine_manager.start_engine(
        pcap_file=req.pcap_file,
        lb_threads=req.lb_threads or 2,
        fp_threads=req.fp_threads or 4,
        pacing_us=req.pacing_us if req.pacing_us is not None else 20000,
        custom_rules=req.custom_rules,
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to start DPI engine process.")
    return {"status": "started", "config": req.dict()}


@app.post("/api/engine/stop")
async def stop_engine():
    await engine_manager.stop_engine()
    return {"status": "stopped"}


@app.post("/api/engine/restart")
async def restart_engine():
    success = await engine_manager.restart_engine()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restart DPI engine.")
    return {"status": "restarted"}


@app.get("/api/stats")
async def get_stats():
    return {
        "stats": engine_manager.stats,
        "active_rules_count": len(engine_manager.rules),
        "security_events_count": len(engine_manager.security_events),
        "threads_count": len(engine_manager.thread_stats),
    }


@app.get("/api/traffic/history")
async def get_traffic_history():
    return list(engine_manager.traffic_history)


@app.get("/api/flows")
async def get_flows(
    app_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    flows_list = list(engine_manager.flows.values())

    if app_filter:
        flows_list = [f for f in flows_list if f.get("app", "").lower() == app_filter.lower()]

    if status_filter:
        flows_list = [f for f in flows_list if f.get("status", "").lower() == status_filter.lower()]

    if search:
        s = search.lower()
        flows_list = [
            f for f in flows_list
            if s in f.get("src_ip", "").lower()
            or s in f.get("dst_ip", "").lower()
            or s in f.get("sni", "").lower()
            or s in f.get("app", "").lower()
            or s in str(f.get("src_port", ""))
            or s in str(f.get("dst_port", ""))
        ]

    # Sort recent first
    return {
        "total": len(flows_list),
        "flows": flows_list[:limit]
    }


@app.get("/api/flows/{flow_key:path}")
async def get_flow_detail(flow_key: str):
    if flow_key in engine_manager.flows:
        return engine_manager.flows[flow_key]
    raise HTTPException(status_code=404, detail="Flow not found")


@app.get("/api/applications")
async def get_application_breakdown():
    return {
        "breakdown": engine_manager.application_breakdown,
        "total_classified": sum(engine_manager.application_breakdown.values())
    }


@app.get("/api/domains")
async def get_domain_breakdown():
    return {
        "domains": engine_manager.domain_breakdown,
        "total_domains": len(engine_manager.domain_breakdown)
    }


@app.get("/api/threads")
async def get_thread_stats():
    fp_counts = [t["packets_processed"] for t in engine_manager.thread_stats.values() if t.get("thread_type") == "FAST_PATH"]
    imbalance_pct = 0.0
    if len(fp_counts) > 1 and max(fp_counts) > 0:
        imbalance_pct = round(((max(fp_counts) - min(fp_counts)) / max(fp_counts)) * 100.0, 1)

    return {
        "threads": list(engine_manager.thread_stats.values()),
        "load_imbalance_pct": imbalance_pct,
        "is_imbalanced": imbalance_pct > 35.0,
    }


@app.get("/api/security/events")
async def get_security_events(limit: int = Query(default=50, le=200)):
    return list(engine_manager.security_events)[:limit]


@app.get("/api/packets/samples")
async def get_packet_samples(limit: int = Query(default=50, le=100)):
    return list(engine_manager.packet_samples)[:limit]


@app.get("/api/rules")
async def get_rules():
    return engine_manager.rules


@app.post("/api/rules")
async def create_rule(req: RuleRequest):
    if not req.value.strip():
        raise HTTPException(status_code=400, detail="Rule value cannot be empty.")
    if req.type.upper() not in ["IP", "DOMAIN", "APP", "PORT"]:
        raise HTTPException(status_code=400, detail="Invalid rule type. Must be IP, DOMAIN, APP, or PORT.")
    
    rule = await engine_manager.add_rule(req.type, req.value)
    return rule


@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: int):
    deleted = await engine_manager.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "deleted", "rule_id": rule_id}


@app.post("/api/replay/start")
async def start_replay(req: ReplayRequest):
    speed = req.speed or 1.0
    success = await engine_manager.start_replay(speed_multiplier=speed)
    if not success:
        raise HTTPException(status_code=400, detail="No recorded events available to replay. Run a PCAP first.")
    return {"status": "replay_started", "speed": speed}


@app.post("/api/replay/stop")
async def stop_replay():
    await engine_manager.stop_replay()
    return {"status": "replay_stopped"}


@app.get("/api/pcap/list")
async def list_pcaps():
    pcaps = []
    for f in os.listdir(WORKSPACE_ROOT):
        if f.lower().endswith(".pcap"):
            fpath = os.path.join(WORKSPACE_ROOT, f)
            pcaps.append({
                "filename": f,
                "size_bytes": os.path.getsize(fpath),
                "is_current": os.path.abspath(fpath) == os.path.abspath(engine_manager.current_pcap)
            })
    return pcaps


@app.post("/api/pcap/upload")
async def upload_pcap(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pcap"):
        raise HTTPException(status_code=400, detail="File must be a .pcap file.")
    
    target_path = os.path.join(WORKSPACE_ROOT, file.filename)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {
        "filename": file.filename,
        "size_bytes": os.path.getsize(target_path),
        "status": "uploaded"
    }


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    queue = engine_manager.register_subscriber()

    # Send initial complete snapshot to client immediately upon connection
    initial_snapshot = {
        "type": "SNAPSHOT",
        "stats": engine_manager.stats,
        "flows": list(engine_manager.flows.values())[-50:],
        "threads": list(engine_manager.thread_stats.values()),
        "security_events": list(engine_manager.security_events)[:30],
        "applications": engine_manager.application_breakdown,
        "domains": engine_manager.domain_breakdown,
        "rules": engine_manager.rules,
        "is_running": engine_manager.is_running,
        "is_replaying": engine_manager.is_replaying,
        "current_pcap": os.path.basename(engine_manager.current_pcap),
    }
    try:
        await websocket.send_json(initial_snapshot)
    except Exception:
        engine_manager.unregister_subscriber(queue)
        return

    async def _send_loop():
        try:
            while True:
                msg = await queue.get()
                await websocket.send_json(msg)
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception:
            pass

    async def _recv_loop():
        try:
            while True:
                data = await websocket.receive_text()
                # Handle client ping or control messages if needed
                if data == "ping":
                    await websocket.send_text("pong")
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception:
            pass

    send_task = asyncio.create_task(_send_loop())
    recv_task = asyncio.create_task(_recv_loop())

    try:
        done, pending = await asyncio.wait(
            [send_task, recv_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    finally:
        engine_manager.unregister_subscriber(queue)
        try:
            await websocket.close()
        except Exception:
            pass


if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/{full_path:path}")
async def serve_frontend_spa(full_path: str):
    if full_path.startswith(("api", "ws", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404, detail="Not Found")

    file_path = os.path.join(FRONTEND_DIST, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)

    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not Found")
