# Changelog

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
