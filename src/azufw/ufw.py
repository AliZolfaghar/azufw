"""
UFW wrapper - handles all interactions with the firewall.
"""

import os
import re
import subprocess
from dataclasses import dataclass
from typing import Optional


DEV_MODE = os.environ.get("AZUFW_DEV") == "1"


@dataclass
class Rule:
    """Represents a single UFW rule."""
    number: int
    action: str
    port: str
    protocol: str
    from_ip: str
    comment: str = ""


class UFWController:
    """Controls UFW operations."""

    def __init__(self):
        if not DEV_MODE:
            self._check_sudo()

    def _check_sudo(self):
        """Check if running with root privileges."""
        try:
            if os.geteuid() != 0:
                raise PermissionError("Root privileges required. Please run with sudo.")
        except AttributeError:
            raise PermissionError("Root privileges required. Please run with sudo.")

    def _run_command(self, command: list[str]) -> str:
        """Run a shell command and return output."""
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=10
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Command failed: {' '.join(command)}\n{e.stderr.strip()}")
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Command timed out: {' '.join(command)}")

    def get_status(self) -> str:
        """Get firewall status (active/inactive)."""
        if DEV_MODE:
            return "active"
        output = self._run_command(["ufw", "status"])
        if "Status: active" in output:
            return "active"
        return "inactive"

    def get_rules(self) -> list[Rule]:
        """Get all numbered rules from UFW."""
        if DEV_MODE:
            return self._get_mock_rules()
        output = self._run_command(["ufw", "status", "numbered"])
        return self._parse_rules(output)

    def _get_mock_rules(self) -> list[Rule]:
        """Return sample rules for development/testing."""
        return [
            Rule(number=1, action="ALLOW", port="22", protocol="tcp", from_ip="192.168.1.0/24", comment="SSH access"),
            Rule(number=2, action="ALLOW", port="80", protocol="tcp", from_ip="Anywhere", comment="HTTP"),
            Rule(number=3, action="ALLOW", port="443", protocol="tcp", from_ip="Anywhere", comment="HTTPS"),
            Rule(number=4, action="DENY", port="23", protocol="tcp", from_ip="Anywhere", comment="Block Telnet"),
            Rule(number=5, action="ALLOW", port="3000", protocol="tcp", from_ip="10.0.0.0/8", comment="Dev server"),
            Rule(number=6, action="LIMIT", port="22", protocol="tcp", from_ip="0.0.0.0/0", comment="Rate limit SSH"),
        ]

    def _parse_rules(self, output: str) -> list[Rule]:
        """Parse 'ufw status numbered' output into Rule objects."""
        rules = []
        lines = output.split("\n")

        for line in lines:
            # Match numbered rules like: [ 1] 22/tcp       ALLOW IN    Anywhere
            match = re.match(
                r"\[\s*(\d+)\]\s+"
                r"(\S+)\s+"              # port/proto
                r"(ALLOW(?:\s+IN)?|DENY(?:\s+IN)?|DENY(?:\s+OUT)?|ALLOW(?:\s+OUT)?|LIMIT(?:\s+IN)?)\s+"
                r"(\S.*?)\s*$",          # from
                line
            )
            if match:
                number = int(match.group(1))
                port_proto = match.group(2)
                action = match.group(3).replace(" IN", "").replace(" OUT", "")
                from_ip = match.group(4)

                # Split port and protocol
                if "/" in port_proto:
                    parts = port_proto.rsplit("/", 1)
                    port = parts[0]
                    protocol = parts[1]
                else:
                    port = port_proto
                    protocol = "any"

                rules.append(Rule(
                    number=number,
                    action=action,
                    port=port,
                    protocol=protocol,
                    from_ip=from_ip,
                ))

        return rules