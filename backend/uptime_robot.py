import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger("UptimeRobot")

UPTIMEROBOT_API_BASE = "https://api.uptimerobot.com/v2"


class UptimeRobotClient:
    """Client for interacting with UptimeRobot API v2."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("UPTIMEROBOT_API_KEY", "")

    def _post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform a POST request to UptimeRobot API v2."""
        if not self.api_key:
            return {"stat": "fail", "error": {"message": "UPTIMEROBOT_API_KEY is not configured."}}

        url = f"{UPTIMEROBOT_API_BASE}/{endpoint.lstrip('/')}"
        data["api_key"] = self.api_key
        data["format"] = "json"

        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=encoded_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "DPI-Engine-UptimeRobot-Integration/2.0",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                body = response.read().decode("utf-8")
                return json.loads(body)
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode("utf-8")
                return json.loads(err_body)
            except Exception:
                return {"stat": "fail", "error": {"message": f"HTTP Error {e.code}: {e.reason}"}}
        except Exception as ex:
            return {"stat": "fail", "error": {"message": str(ex)}}

    def get_account_details(self) -> Dict[str, Any]:
        """Retrieve user account information and monitor limits."""
        return self._post("getAccountDetails", {})

    def get_monitors(
        self,
        monitors: Optional[List[int]] = None,
        custom_uptime_ratios: str = "1-7-30",
        response_times: int = 1,
    ) -> Dict[str, Any]:
        """Fetch all monitors or specific monitors with uptime ratios and response times."""
        payload: Dict[str, Any] = {
            "custom_uptime_ratios": custom_uptime_ratios,
            "response_times": response_times,
            "response_times_limit": 20,
            "logs": 1,
            "logs_limit": 10,
        }
        if monitors:
            payload["monitors"] = "-".join(str(m) for m in monitors)

        return self._post("getMonitors", payload)

    def new_monitor(
        self,
        friendly_name: str,
        url: str,
        monitor_type: int = 1,  # 1 = HTTP(s), 2 = Keyword, 3 = Ping, 4 = Port
        interval_seconds: int = 300,  # 300 seconds (5 min) default on free tier
        http_method: int = 1,  # 1 = HEAD, 2 = GET, 3 = POST
        alert_contacts: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new HTTP/HTTPS or Ping monitor on UptimeRobot."""
        payload: Dict[str, Any] = {
            "friendly_name": friendly_name,
            "url": url,
            "type": monitor_type,
            "interval": interval_seconds,
            "http_method": http_method,
        }
        if alert_contacts:
            payload["alert_contacts"] = alert_contacts

        return self._post("newMonitor", payload)

    def edit_monitor(self, monitor_id: int, **kwargs) -> Dict[str, Any]:
        """Edit an existing monitor (pause, resume, change interval, etc.)."""
        payload: Dict[str, Any] = {"id": monitor_id}
        payload.update(kwargs)
        return self._post("editMonitor", payload)

    def pause_monitor(self, monitor_id: int) -> Dict[str, Any]:
        """Pause a monitor."""
        return self.edit_monitor(monitor_id, status=0)

    def resume_monitor(self, monitor_id: int) -> Dict[str, Any]:
        """Resume a paused monitor."""
        return self.edit_monitor(monitor_id, status=1)

    def delete_monitor(self, monitor_id: int) -> Dict[str, Any]:
        """Delete an existing monitor."""
        return self._post("deleteMonitor", {"id": monitor_id})

    def get_alert_contacts(self) -> Dict[str, Any]:
        """Get list of alert contacts (emails, webhooks, SMS) defined in account."""
        return self._post("getAlertContacts", {})


# Helper functions
def get_uptime_robot_client(api_key: Optional[str] = None) -> UptimeRobotClient:
    return UptimeRobotClient(api_key=api_key)
