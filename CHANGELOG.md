# Changelog

## v1.2.0 - 2026-08-26

### Added
- **Docker isolation mode**: run Minecraft servers and Discord bots inside isolated containers to prevent malware from accessing the host system.
- Execution mode toggle in Settings (Local vs Docker) with automatic Docker detection.
- New settings endpoints:
  - `GET /api/settings/docker-status`
  - `POST /api/settings/execution-mode`
- Bot dependency installation now supports Docker containers.
- Minecraft servers in Docker auto-map the server port and pass EULA acceptance.
- Security warnings in Settings UI when running in local (non-isolated) mode.

### Docker images used
- Minecraft: `eclipse-temurin:17-jdk`
- Node.js bots: `node:20-slim`
- Python bots: `python:3.11-slim`
- Java bots: `eclipse-temurin:17-jdk`
- Go bots: `golang:1.22-bookworm`
- Ruby bots: `ruby:3.2-slim`
- C# bots: `mcr.microsoft.com/dotnet/sdk:8.0`

### Requirements for Docker mode
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- Toggle the mode in **Ajustes** → **Modo de Ejecucion**.

### Upgrade notes
```bash
git pull
npm install
npm run build
npm start
```

---

## v1.1.0 - 2026-08-26

### Added
- File extraction from panel for `.zip`, `.tar`, `.tar.gz`, `.tgz`, `.gz`, `.rar`, `.7z`, `.bz2`.
- `Extract` action in File Browser context menu (list and grid views).
- Discord bot Python runtime selection (`/api/bots/python-versions`) and per-bot Python command support.
- Bot dependency install endpoint (`/api/bots/:id/install`).
- Minecraft network diagnostics and quick optimization tab.
- New Minecraft endpoints:
  - `GET /api/minecraft/network-status?path=`
  - `POST /api/minecraft/network-optimize`

### Improved
- Discord bot auto-detection optimized (single directory read strategy, multi-disk scan support).
- Minecraft server startup now includes JVM network-oriented flags to reduce tunnel latency spikes.

### Fixed
- `tar` ESM import issue in file extraction route.
- Minecraft panel crash caused by callback initialization order.
- UI fallback behavior to avoid black screens when an API call fails.

### Upgrade notes
- Pull latest changes and reinstall dependencies:

```bash
git pull
npm install
npm run build
npm start
```

- For development:

```bash
git pull
npm install
npm run dev
```

### Important
- Minecraft TCP optimization uses `netsh` and requires running the panel with Administrator privileges on Windows.
