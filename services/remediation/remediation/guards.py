"""Garde-fous : IP que le moteur ne bloquera jamais, quoi que dise une alerte.

Bloquer l'hôte lui-même (passerelles Docker, hotspot 192.168.137.1, loopback) couperait la sonde
de vérification, le dashboard et tous les accès locaux : la remédiation aggraverait l'incident.
"""

import ipaddress
import json
import subprocess

ALWAYS_PROTECTED = [ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "127.0.0.0/8", "169.254.0.0/16", "224.0.0.0/4", "255.255.255.255/32",
)]


def host_addresses() -> set[ipaddress.IPv4Address]:
    """Adresses IPv4 des interfaces de l'hôte (dont les passerelles des réseaux Docker et le hotspot)."""
    try:
        out = subprocess.run(["ip", "-j", "-4", "addr"], capture_output=True, text=True, timeout=5, check=True).stdout
        return {ipaddress.ip_address(a["local"]) for iface in json.loads(out) for a in iface.get("addr_info", [])}
    except (OSError, subprocess.SubprocessError, ValueError, KeyError):
        return set()


def blockable(ips: list[str], protected: set[ipaddress.IPv4Address] | None = None) -> tuple[list[str], list[str]]:
    """Sépare les IP blocables des IP refusées (invalides, IPv6, protégées). Ordre conservé, sans doublon."""
    protected = host_addresses() if protected is None else protected
    ok, refused = [], []
    for raw in dict.fromkeys(ips):
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            refused.append(raw)
            continue
        if ip.version != 4 or ip in protected or any(ip in n for n in ALWAYS_PROTECTED):
            refused.append(raw)
        else:
            ok.append(str(ip))
    return ok, refused
