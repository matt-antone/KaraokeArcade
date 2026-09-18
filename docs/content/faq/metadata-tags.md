---
title: My files have correct artist & title metadata tags; can they be used instead of filenames?
category: Troubleshooting
weight: 6
---

Yes, just place the following <a href='{{< ref "docs/karaokearcade-server/#metadata-parser" >}}'>_kes.v2.json</a> file in the applicable media folder:

{{< highlight js >}}
{
  artist: '${meta.artist}',
  title: '${meta.title}',
}
{{< /highlight >}}

A file missing its artist or title tag is skipped, with a warning logged to the scanner log.
