"""Exécution de la liste FERMÉE de playbooks Ansible de remédiation.

Le moteur n'a pas d'accès brut au socket Docker : il ne peut lancer que ces actions, avec des
paramètres validés, sans shell (argv). Voir ansible/playbooks/remediation/.
"""

import asyncio
import json
import os
import time
from dataclasses import dataclass

from remediation import config

PLAYBOOKS = {
    "waf_block": "playbooks/remediation/waf-block-ip.yml",
    "waf_unblock_all": "playbooks/remediation/waf-unblock-all.yml",
    "restart_service": "playbooks/remediation/restart-service.yml",
    "restore_service": "playbooks/remediation/restore-service.yml",
}
ALLOWED_SERVICES = {"payment-api"}


@dataclass
class PlaybookResult:
    action: str
    ok: bool
    duration_s: float
    output: str


def build_argv(action: str, params: dict) -> list[str]:
    if action not in PLAYBOOKS:
        raise ValueError(f"action hors liste fermée : {action}")
    if action == "waf_block":
        ips = params.get("ips")
        if not isinstance(ips, list) or not ips or not all(isinstance(i, str) for i in ips):
            raise ValueError("waf_block attend une liste d'IP")
        extra = {"ips": ips}
    elif action in ("restart_service", "restore_service"):
        if params.get("service") not in ALLOWED_SERVICES:
            raise ValueError(f"service non autorisé : {params.get('service')}")
        extra = {"service": params["service"]}
    else:
        extra = {}
    argv = [config.ANSIBLE_PLAYBOOK, PLAYBOOKS[action]]
    if extra:
        argv += ["-e", json.dumps(extra)]
    return argv


async def run(action: str, params: dict | None = None) -> PlaybookResult:
    argv = build_argv(action, params or {})
    start = time.monotonic()
    proc = await asyncio.create_subprocess_exec(
        *argv, cwd=config.ANSIBLE_DIR, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env={**os.environ, "ANSIBLE_STDOUT_CALLBACK": "minimal", "ANSIBLE_NOCOLOR": "1"},
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), config.PLAYBOOK_TIMEOUT_S)
        ok = proc.returncode == 0
    except asyncio.TimeoutError:
        proc.kill()
        out, ok = b"timeout", False
    text = out.decode(errors="replace")
    return PlaybookResult(action, ok, round(time.monotonic() - start, 2), text[-1500:])
