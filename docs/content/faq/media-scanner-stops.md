---
title: The media scanner stops before scanning all my files?
category: Troubleshooting
weight: 5
---

A file the scanner can't parse (bad or missing metadata, no matching CDG, and so on) is skipped with a warning, not a stop - the scan continues. If the scan stops outright, the scanner process itself has crashed, often on a huge or corrupt file. Check the <a href="{{< ref "docs/karaokearcade-server/#file-locations" >}}">scanner log</a> (or console output) and look for the last file the scanner encountered - that's the usual suspect, and should be removed.
