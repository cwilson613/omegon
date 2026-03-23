---
id: theme-calibration
title: "Theme calibration — /calibrate command, gamma/sat/hue slider, tweakcn-style theme export"
status: exploring
parent: alpharius-theme
tags: [theme, ux, calibration, display, tweakcn, 0.15.0]
open_questions:
  - "What's the right calibration UX? A TUI overlay with arrow-key sliders and live preview? Or a simple /calibrate gamma 1.2 sat 0.8 command interface?"
  - "How does tweakcn integration work? Do we export alpharius.json as a tweakcn-compatible format? Do we generate CSS custom properties from our theme vars? What's the round-trip: tweakcn → alpharius.json → omegon?"
  - "Should calibration apply CIE L* perceptual corrections automatically? We already use the CIE L* ramp for the color system — calibration could adjust the L* anchor points based on the operator's display characteristics."
jj_change_id: xwnrqnuystrovmssnxktvlkuqoxwymxu
issue_type: feature
priority: 3
---

# Theme calibration — /calibrate command, gamma/sat/hue slider, tweakcn-style theme export

## Overview

Alpharius is a strong opinionated theme but doesn't account for display variation (dim laptop screens, ultra-wide monitors, terminal emulator differences). Add a /calibrate slash command that lets operators adjust gamma, saturation, and hue shift — persisted to settings. Look at shadcn's tweakcn (https://tweakcn.com) for the import/export model: lists of CSS color values that can be shared. Create an alpharius/omegon theme set on tweakcn as a distribution channel. The Styrene Python TUI already did this pattern. The calibration UI could be a TUI overlay with live preview — operator sees changes immediately as they adjust sliders.

## Open Questions

- What's the right calibration UX? A TUI overlay with arrow-key sliders and live preview? Or a simple /calibrate gamma 1.2 sat 0.8 command interface?
- How does tweakcn integration work? Do we export alpharius.json as a tweakcn-compatible format? Do we generate CSS custom properties from our theme vars? What's the round-trip: tweakcn → alpharius.json → omegon?
- Should calibration apply CIE L* perceptual corrections automatically? We already use the CIE L* ramp for the color system — calibration could adjust the L* anchor points based on the operator's display characteristics.
