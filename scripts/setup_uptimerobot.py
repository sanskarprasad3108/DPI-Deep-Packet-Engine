#!/usr/bin/env python3
"""
UptimeRobot Automated Setup & Health Check CLI for DPI-X Engine.
Usage:
    python scripts/setup_uptimerobot.py --api-key <YOUR_API_KEY> --url https://your-dpi-app.onrender.com/api/health
    python scripts/setup_uptimerobot.py --status --api-key <YOUR_API_KEY>
"""

import argparse
import json
import sys
import os

# Add parent directory to sys.path to allow imports from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.uptime_robot import UptimeRobotClient


def main():
    parser = argparse.ArgumentParser(description="DPI Engine UptimeRobot Automation Tool")
    parser.add_argument("--api-key", help="UptimeRobot Main or Read-Only API Key (or env UPTIMEROBOT_API_KEY)")
    parser.add_argument("--url", help="Health Check endpoint URL (e.g., https://your-app.onrender.com/api/health)")
    parser.add_argument("--name", default="DPI Packet Engine Health", help="Monitor Friendly Name")
    parser.add_argument("--interval", type=int, default=300, help="Check interval in seconds (default: 300 / 5 min)")
    parser.add_argument("--status", action="store_true", help="Fetch and print status of existing monitors")
    parser.add_argument("--delete", type=int, help="Delete a monitor by its Monitor ID")

    args = parser.parse_args()
    api_key = args.api_key or os.getenv("UPTIMEROBOT_API_KEY")

    if not api_key:
        print("[!] Error: API Key must be provided via --api-key or UPTIMEROBOT_API_KEY environment variable.")
        print("    Get your free API key at https://uptimerobot.com/dashboard#mySettings")
        sys.exit(1)

    client = UptimeRobotClient(api_key=api_key)

    if args.status:
        print("[*] Querying UptimeRobot monitors...")
        res = client.get_monitors()
        if res.get("stat") == "ok":
            monitors = res.get("monitors", [])
            print(f"[+] Found {len(monitors)} monitor(s):")
            for m in monitors:
                status_text = {
                    0: "PAUSED",
                    1: "NOT CHECKED YET",
                    2: "UP (Operational)",
                    8: "SEEMS DOWN",
                    9: "DOWN",
                }.get(m.get("status"), "UNKNOWN")
                print(f"  - ID: {m.get('id')} | Name: {m.get('friendly_name')} | Status: {status_text} | URL: {m.get('url')}")
                if "custom_uptime_ratio" in m:
                    print(f"    Uptime Ratios (24h-7d-30d): {m.get('custom_uptime_ratio')}%")
        else:
            print(f"[!] Error: {res.get('error', {}).get('message', 'Unknown error')}")
        return

    if args.delete:
        print(f"[*] Deleting monitor ID {args.delete}...")
        res = client.delete_monitor(args.delete)
        if res.get("stat") == "ok":
            print(f"[+] Monitor {args.delete} successfully deleted.")
        else:
            print(f"[!] Delete failed: {res.get('error', {}).get('message')}")
        return

    if args.url:
        print(f"[*] Creating new monitor for: {args.url}")
        res = client.new_monitor(
            friendly_name=args.name,
            url=args.url,
            monitor_type=1,  # HTTP(s)
            interval_seconds=args.interval,
            http_method=1,   # HEAD / GET
        )
        if res.get("stat") == "ok":
            print("[+] UptimeRobot Monitor Successfully Created!")
            print(f"    Monitor ID: {res.get('monitor', {}).get('id')}")
            print(f"    Friendly Name: {args.name}")
            print(f"    Target URL: {args.url}")
            print(f"    Interval: {args.interval}s")
        else:
            print(f"[!] Failed to create monitor: {res.get('error', {}).get('message')}")
        return

    print("Please specify --url <HEALTH_CHECK_URL> to create a monitor, or --status to view existing monitors.")


if __name__ == "__main__":
    main()
