# SPDX-License-Identifier: MIT
#
# luci-app-temp — Temperature widget for LuCI Status → Overview

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-temp
PKG_VERSION:=1.0.1
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Rustam Gayfiev

LUCI_TITLE:=Temperature widget for Status Overview
LUCI_DESCRIPTION:=Shows CPU/WiFi temperatures and fan RPM on the Status Overview page \
	with colored gradient bars, session peak markers, configurable refresh interval \
	and warning/critical thresholds (editable from the UI).
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
