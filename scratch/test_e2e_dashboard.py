import asyncio
import json
import urllib.request
import websockets

API_BASE = "http://127.0.0.1:8000/api"
WS_URL = "ws://127.0.0.1:8000/ws/telemetry"


def get_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


def post_json(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


async def test_full_pipeline():
    print("=== 1. Testing Health Endpoint ===")
    post_json(f"{API_BASE}/replay/stop", {})
    health = get_json(f"{API_BASE}/health")
    print("Health:", health)
    assert health["status"] == "healthy"

    print("\n=== 2. Testing Security Rule Injection ===")
    rule_res = post_json(f"{API_BASE}/rules", {"type": "DOMAIN", "value": "youtube.com"})
    print("Injected Rule:", rule_res)
    assert rule_res["value"] == "youtube.com"

    rules = get_json(f"{API_BASE}/rules")
    print("Active Rules count:", len(rules))

    print("\n=== 3. Testing WebSocket Stream & Engine Start ===")
    async with websockets.connect(WS_URL) as ws:
        # Receive initial snapshot
        snapshot = json.loads(await ws.recv())
        print(f"Received WS Snapshot: type={snapshot.get('type')}, flows={len(snapshot.get('flows', []))}")

        # Start C++ engine with 5ms pacing
        start_res = post_json(f"{API_BASE}/engine/start", {
            "pcap_file": "test_dpi.pcap",
            "pacing_us": 5000,
            "lb_threads": 2,
            "fp_threads": 4
        })
        print("Engine Started:", start_res)

        received_events = []
        # Listen for events until engine finishes
        while True:
            try:
                msg_str = await asyncio.wait_for(ws.recv(), timeout=5.0)
                msg = json.loads(msg_str)
                received_events.append(msg.get("type") or msg.get("event"))
                if msg.get("type") == "ENGINE_STATUS" and msg.get("status") in ["FINISHED", "STOPPED"]:
                    break
            except asyncio.TimeoutError:
                break

        print(f"Received {len(received_events)} WebSocket messages during run.")

    await asyncio.sleep(0.5)

    print("\n=== 4. Verifying Post-Run Metrics & Classifications ===")
    stats = get_json(f"{API_BASE}/stats")
    print("Engine Stats:", stats["stats"])
    assert stats["stats"]["total_packets"] == 77
    assert stats["stats"]["dropped_packets"] >= 1  # youtube.com matched and dropped
    assert stats["stats"]["sni_detected"] >= 15

    flows = get_json(f"{API_BASE}/flows?limit=10")
    print(f"Flows Total: {flows['total']}")
    assert flows["total"] > 0

    domains = get_json(f"{API_BASE}/domains")
    print(f"Extracted Domains Total: {domains['total_domains']}")
    print(f"Sample Domains: {list(domains['domains'].keys())[:5]}")
    assert domains["total_domains"] > 0

    threads = get_json(f"{API_BASE}/threads")
    print(f"Threads Count: {len(threads['threads'])}, Imbalance Pct: {threads['load_imbalance_pct']}%")

    sec_events = get_json(f"{API_BASE}/security/events")
    print(f"Security Interceptions: {len(sec_events)}")
    if sec_events:
        print("Sample Interception:", sec_events[0])

    print("\n ALL END-TO-END VERIFICATION CHECKS PASSED!")


if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
