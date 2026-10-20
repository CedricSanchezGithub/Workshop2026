"""Lance le moteur sur une ou plusieurs adresses (REMEDIATION_BIND="127.0.0.1,172.17.0.1").

    uv run python -m remediation
"""

import asyncio

import uvicorn

from remediation import config


async def main() -> None:
    servers = [uvicorn.Server(uvicorn.Config("remediation.app:app", host=h, port=config.PORT, log_level="warning",
                                             access_log=False)) for h in config.BIND_HOSTS]
    # Une seule instance de l'application est importée : les serveurs partagent le même moteur.
    await asyncio.gather(*(s.serve() for s in servers))


if __name__ == "__main__":
    asyncio.run(main())
