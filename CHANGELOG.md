# Changelog

All notable changes to **luci-app-temp** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-07-05

### Fixed
- **Misleading fan reading on boards with inverted PWM wiring** (e.g. BPI-R3:
  DTS `cooling-levels = <255 40 0>` — raw `pwm1 = 255` actually means the fan
  is *off*, not 100%). The backend now prefers, in order: real tachometer RPM
  (`fan*_input`) → **thermal cooling-device state** (`cooling_device*` of type
  `*fan*`, honest level that already accounts for the DTS level table) → raw
  PWM duty only as a last resort when no fan cooling device exists.
- Widget now renders the fan as `off` / `level N/M` / `level M/M (max)`
  instead of a raw PWM percentage; added `pwm-fan` to friendly labels.

## [1.0.0] — 2026-07-05

### Added
- Initial release, targeting OpenWrt 25.x (modern JS-based LuCI, apk).
- **Status → Overview widget** (`28_temp.js`): auto-discovered by
  `view/status/index.js`, renders a "Temperature" section.
- Temperature sources: all `/sys/class/thermal/thermal_zone*` zones plus all
  hwmon `temp*_input` sensors (hwmon devices mirroring a thermal zone are
  deduplicated). On BananaPi BPI-R3 this yields CPU + mt7915 WiFi 2.4/5 GHz.
- Fan reporting: RPM from hwmon `fan*_input`; if the fan has no tachometer
  (e.g. BPI-R3 `pwmfan`), PWM duty (`pwm*`, 0–255) is shown as a percentage.
- Colored gradient bars (green → orange → red by thresholds) with a
  session-peak marker per sensor.
- Own refresh poll, independent of the page-wide LuCI poll; interval
  configurable from the UI (default 5 s).
- Settings modal (⚙): refresh interval, warning/critical thresholds; values
  stored in UCI (`/etc/config/luci_temp`) via ubus, applied on the fly.
- rpcd backend `luci.temp` (`getData`) — shell + jshn, no daemon.
- ACL `luci-app-temp`: read `luci.temp`, read/write UCI `luci_temp`.
- luci.mk `Makefile` for optional OpenWrt SDK builds, MIT `LICENSE`, `README.md`.
