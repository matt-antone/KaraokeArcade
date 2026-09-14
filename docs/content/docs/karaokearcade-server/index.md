---
title: KaraokeArcade Server
description: Documentation for KaraokeArcade Server
---

The server hosts the web app and your media files, and can run on pretty much anything including a Raspberry Pi, NAS or Windows/Mac/Linux desktop. Since the [player]({{< ref "docs/karaokearcade-app#player" >}}) is fully browser-based, it doesn't need to run on the same system as the server, but it can.

## Installation

KaraokeArcade Server is available as both a Docker image and an `npm` package. Both options are multi-platform and multi-architecture (64-bit required).

- [Docker]({{< ref "docs/karaokearcade-server#docker" >}})
- [NPM]({{< ref "docs/karaokearcade-server#npm" >}})

### Docker

Docker is the preferred way to run KaraokeArcade Server if you're using a dedicated server or NAS. The [KaraokeArcade docker image](https://hub.docker.com/r/radrootllc/karaoke-eternal) is modeled after [LinuxServer's](https://docs.linuxserver.io/general/running-our-containers) images and supports both `amd64` and `arm64`.

The easiest way to use the Docker image is via a [Compose](https://docs.docker.com/compose/) file, which is a simple YAML format for configuring your container.

Below is an example `docker compose` file:

{{< highlight yaml >}}
services:
  karaokearcade:
    container_name: karaokearcade
    image: radrootllc/karaoke-eternal
    volumes:
      # Folder where the KaraokeArcade Server database will be created
      - <path_to_database>:/config
      # Folder(s) containing your media 
      # (inside the app, you'll add /mnt/karaoke to Media Folders)
      - <path_to_media>:/mnt/karaoke
    ports:
      # Web server port
      - <host_port>:8080
    # environment:
    #   - PUID=1000 # optional: user ID to run as
    #   - PGID=1000 # optional: group ID to run as
    #   - TZ=America/New_York # optional: timezone
    restart: unless-stopped
{{< /highlight >}}

At a minimum, replace `<path_to_database>`, `<path_to_media>` and `<host_port>` with the desired values. See the [CLI & ENV]({{< ref "docs/karaokearcade-server#cli--env" >}}) section for additional environment settings.

Once the container is running, see [Getting Started]({{< ref "docs/getting-started" >}}) if you're new to KaraokeArcade.

### NPM

KaraokeArcade Server is also available as an `npm` package:

1. Install [Node.js](https://nodejs.org){{% icon-external %}} v24 or later if it's not already installed.

2. In your terminal or command prompt, run the following:

{{< highlight shell >}}
npm i -g karaokearcade
{{< /highlight >}}

<aside class="info">
  {{% icon-info %}}
  <p>In the above command, <code>i</code> is short for "install", and <code>-g</code> means "global" so that the command in the next step will work everywhere.</p>
</aside>

3. Start the server by running:

{{< highlight shell >}}
karaokearcade-server
{{< /highlight >}}

<aside class="info">
  {{% icon-info %}}
  <p>The server chooses a random port at startup unless <a href="#cli--env">otherwise specified</a>. For example, to use port 8888, run <code>karaokearcade-server --port 8888</code></p>
</aside>

4. Look for "Web server running at..." and browse to that **server URL**.

See [Getting Started]({{< ref "docs/getting-started" >}}) if you're new to KaraokeArcade.

## Media Files

The following file types are supported:

- [MP3+G](https://en.wikipedia.org/wiki/MP3%2BG){{% icon-external %}} (including zipped; also supports .m4a instead of .mp3)
- MP4 video (codec support can vary depending on the browser running the [player]({{< ref "docs/karaokearcade-app#player" >}}))

KaraokeArcade Server expects your media files to be named in **"Artist - Title"** format by default (you can [configure this](#metadata-parser)). Media with filenames that couldn't be parsed won't appear in the library, so check the [scanner log](#file-locations) or console output for these.

## Metadata Parser

You can customize the metadata parser by creating a file named `_kes.v2.json` in a media folder. It will apply to all media files in the folder, including subfolders. If any subfolders contain their own `_kes.v2.json` file, that will take precedence instead. These files can be in JSON or JSON5 format - JSON5 is used in the examples below since it's friendlier for humans.

### Basic Configuration

At the most basic, your `_kes.v2.json` file can alter some or all of the parser's default configuration, which is:

{{< highlight js >}}
{
  // used to normalize artist/title; set false to disable
  articles: ['A', 'An', 'The'],

  // assumes filenames are in "Artist - Title" format
  artistOnLeft: true,

  // assumes a hyphen separates the artist and title 
  delimiter: '-',
}
{{< /highlight >}}

For example, if you had a folder with filenames in the format "Title - Artist" instead, you could create this `_kes.v2.json` file in it:

{{< highlight js >}}
{
  artistOnLeft: false, // override default
}
{{< /highlight >}}

### Advanced Templating

If changing the parser's default configuration doesn't yield the desired results, you can also define your own "template" to override the result for one or more of these fields:

- `artist` (string) artist's name as it will be shown in the library
- `artistNorm` (string) normalized version of the artist's name; used for matching and sorting (`artist` if not set)
- `title` (string) song's title as it will be shown in the library
- `titleNorm` (string) normalized version of the song's title; used for matching and sorting (`title` if not set)

For each media file encountered, KaraokeArcade makes a "context" available to your field template(s). This context includes the fields above (that is, the results from the built-in parser) in addition to:

- `name` (string) media filename (without extension)
- `meta` (object) media file's [metadata fields](https://github.com/Borewit/music-metadata/blob/master/doc/common_metadata.md){{% icon-external %}}
- `dir` (string) full path of the containing folder
- `dirSep` (string) path separator used by the current OS (`/` or `\`)

Field templates are defined using [JSON-e syntax](https://json-e.js.org){{% icon-external %}}. In addition to JSON-e's [built-in methods](https://json-e.js.org/built-ins.html){{% icon-external %}}, a `replace` method is also provided for simple text replacement. Here are a few examples of how one might use field templates in their `_kes.v2.json` file:

{{< highlight js >}}
// explicitly set the artist field
{
  artist: "My Artist's Name",
}
{{< /highlight >}}

{{< highlight js >}}
// remove "junk" from anywhere in the parsed artist field
{
  artist: {
    $eval: 'replace(artist, "junk", "")'
  },
}
{{< /highlight >}}

{{< highlight js >}}
// remove "junk" case-insensitively from the start of the parsed artist field (regex syntax)
// note: double backslash escapes to a single backslash
{
  artist: {
    $eval: 'replace(artist, "^junk\\s", "i", "")'
  },
}
{{< /highlight >}}

{{< highlight js >}}
// set artist and title using the media file's metadata tags
{
  artist: '${meta.artist}',
  title: '${meta.title}',
}
{{< /highlight >}}

<aside class="info">
  {{% icon-info %}}
  <p><strong>Tip: </strong>Setting the media scanner log or console level to "debug" (see below) can be helpful in troubleshooting your field templates.
</p>
</aside>

## CLI & ENV

KaraokeArcade Server supports the following CLI options and environment variables. The numeric values used for log/console levels are: **0**=off, **1**=error, **2**=warn, **3**=info, **4**=verbose, **5**=debug

| Option | ENV | Description | Default |
| --- | --- | --- | --- |
| <span style="white-space: nowrap;">`--data <string>`</span>| <span style="white-space: nowrap;">`KES_PATH_DATA`</span> | Absolute path of folder for database files | |
| <span style="white-space: nowrap;">`-p, --port <number>`</span>| <span style="white-space: nowrap;">`KES_PORT`</span> | Web server port | auto |
| <span style="white-space: nowrap;">`--rotateKey`</span>| <span style="white-space: nowrap;">`KES_ROTATE_KEY`</span> | Rotate the session key at startup | |
| <span style="white-space: nowrap;">`--scan`</span>| <span style="white-space: nowrap;">`KES_SCAN`</span> | Run the media scanner at startup. Accepts a comma-separated list of pathIds, or "all" | |
| <span style="white-space: nowrap;">`--scannerConsoleLevel <number>`</span>| `KES_SCANNER_CONSOLE_LEVEL` | Media scanner console output level (default=4) | 4 |
| <span style="white-space: nowrap;">`--scannerLogLevel <number>`</span>| <span style="white-space: nowrap;">`KES_SCANNER_LOG_LEVEL`</span> | Media scanner log file level | 3 |
| <span style="white-space: nowrap;">`--serverConsoleLevel <number>`</span>| <span style="white-space: nowrap;">`KES_SERVER_CONSOLE_LEVEL`</span> | Web server console output level | 4 |
| <span style="white-space: nowrap;">`--serverLogLevel <number>`</span>| <span style="white-space: nowrap;">`KES_SERVER_LOG_LEVEL`</span> | Web server log file level | 3 |
| <span style="white-space: nowrap;">`--serverUrl <string>`</span>| <span style="white-space: nowrap;">`KES_SERVER_URL`</span> | Absolute `http(s)` URL guests reach the server at, used for join QR codes. See [Stable addresses](#stable-addresses) | current LAN IP |
| <span style="white-space: nowrap;">`--urlPath <string>`</span>| <span style="white-space: nowrap;">`KES_URL_PATH`</span> | Web server base URL path (must begin with a forward slash) | / |
| <span style="white-space: nowrap;">`-v, --version`</span>| | Show version and exit | |

### Stable addresses

By default the join QR encodes the server's current LAN IP. That works for a one-off party, but an IP is an address rather than an identity: it changes when you take the server to a different venue, and it can change at the same venue when the DHCP lease renews.

This matters if guests add the app to their home screen. An install freezes whatever URL it was added from, and a standalone window has no address bar to correct it, so a changed IP leaves a dead icon. Worse, private ranges are heavily reused, so the old address may reach some unrelated device on the new network.

Set `--serverUrl` to a name that follows the server between networks and the QR, the install and the icon all agree:

```
karaokearcade-server --serverUrl http://karaokearcade.local:8080
```

A Bonjour `.local` name is the simplest option, and iOS and macOS resolve it with no setup on the guest's phone. macOS hosts already answer `<computer-name>.local`; on Linux this needs Avahi, and on Windows the Bonjour service. A tunnel or reverse proxy hostname works too, and an `https` one additionally unlocks the browser features that require a secure context.

The value is used verbatim, so include the port and any base path. It is ignored (with a warning, falling back to the LAN IP) unless it parses as an `http` or `https` URL — note that `karaokearcade.local:8080` is *not* one, since it has no scheme.

Until a name is set, the app doesn't suggest adding itself to the home screen at all: guests reaching it at a raw IP are left on the QR-and-browser flow, which keeps working no matter how the address moves.

## File Locations

If using the Docker image, the database will be located in the folder you mapped to the container's `/config` folder. The container doesn't write log files by default; use the [Docker logs](https://docs.docker.com/reference/cli/docker/container/logs/) command instead to see the container's output.

If using the `npm` installation method, the default locations for the database (`database.sqlite3`), web server log (`server.log`) and media scanner log (`scanner.log`) are as follows:

These folders keep the pre-rebrand `Karaoke Eternal Server` name so existing installs keep their database.

### Windows

- Database: `%USERPROFILE%\AppData\Roaming\Karaoke Eternal Server`
- Logs: `%USERPROFILE%\AppData\Roaming\Karaoke Eternal Server\logs`

### macOS

 - Database: `~/Library/Application Support/Karaoke Eternal Server`
 - Logs: `~/Library/Logs/Karaoke Eternal Server`

### Linux

- Database: `~/.config/Karaoke Eternal Server`
- Logs: `~/.config/Karaoke Eternal Server/logs`
