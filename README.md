# LarpCord

A zero-dependency Discord Rich Presence faker that simulates realistic coding activity in Visual Studio Code (or whatever custom name you want).

Instead of cycling files mechanically every few seconds like a bot, LarpCord mimics actual human programmer habits:
- **Focus File Dwell**: Spends 3–6 minutes on a primary source file, briefly jumps to a listener, config, or helper file for 45–90s, and returns to the focus file.
- **Cursor Jitter**: Every 20–45s, the line and column numbers shift naturally (e.g. typing down lines, jumping functions, or scrolling up to check imports).
- **Custom GIFs & Images**: Uses a direct media proxy workaround so you can use animated GIFs without getting the Discord 502 question mark box.
- **Zero Dependencies**: Pure Node.js using native Windows named pipes (`\\.\pipe\discord-ipc-0`). Uses ~15MB RAM and 0% CPU.
- **Windows Background & Startup**: Runs completely hidden with no open terminal windows.

---

## Quick Start

### 1. Requirements
- Node.js 18+ installed
- Discord desktop app running

### 2. Run
```bash
# Clone the repository
git clone https://github.com/mustafasoura1-ship-it/LarpCord.git
cd LarpCord

# Start silently in the background
node cli.js start

# Check what Discord is showing
node cli.js status
```

On Windows, you can also just double-click **`start.bat`** or **`manager.bat`**.

---

## Controls & CLI

| Command | Description |
| :--- | :--- |
| `node cli.js start` | Starts the client silently in the background |
| `node cli.js status` | Shows connection status, current file, line:col, and live preview |
| `node cli.js stop` | Cleanly stops the client and clears your presence |
| `node cli.js restart` | Restarts the background client |
| `node cli.js profile <name>` | Switches project profile on the fly (no restart needed) |
| `node cli.js file <filename>` | Immediately jumps to editing a specific file |
| `node cli.js profiles` | Lists available presets |
| `node cli.js run` | Runs in foreground with live console logs |

---

## Managing GIFs & Custom Icons

### Why do some GIF links turn into a question mark?
Discord's desktop client doesn't fetch external images directly. It routes them through its media proxy (`images-ext-1.discordapp.net`). Most free image hosts (Catbox, Imgur, Tmpfiles) block Discord's crawler with a `502 Bad Gateway` or `415 Unsupported Media Type`, causing Discord to drop the image and show a white question mark cube.

### The GitHub Raw Fix (Guaranteed to work):
GitHub raw content never blocks Discord's crawler. To use any custom GIF or image:

1. Put your `.gif` or `.png` in a public GitHub repository (e.g. `your-repo/assets/my-gif.gif`).
2. Get the raw URL:
   ```text
   https://raw.githubusercontent.com/<user>/<repo>/main/<path-to-image>.gif
   ```
3. Open `config.json` and paste it into `customLargeImage`:
   ```json
   {
     "customLargeImage": "https://raw.githubusercontent.com/<user>/<repo>/main/<path-to-image>.gif",
     "customLargeText": "this otter is busy"
   }
   ```
4. Run `node cli.js restart`. Discord's proxy will immediately cache the file with `HTTP 200 image/gif`.

---

## Configuration (`config.json`)

```json
{
  "clientId": "383226320970055681",
  "appName": "Goon Code",
  "activeProfile": "blissv2",
  "targetDirectory": "D:\\BLiss SCULK\\bliss\\blissv2",
  "timestampMode": "file",
  "showCursorPosition": true,
  "showLineCount": true,
  "showGitBranch": true,
  "customLargeImage": "https://raw.githubusercontent.com/mustafasoura1-ship-it/bliss-assets/main/cat_busy.gif",
  "customLargeText": "this otter is busy",
  "customState": "this otter is busy",
  "customSmallImage": null,
  "customSmallText": null,
  "swapIntervalSeconds": {
    "min": 90,
    "max": 240
  },
  "cursorJitterIntervalSeconds": {
    "min": 20,
    "max": 45
  }
}
```

### Key Settings:
* **`appName`**: Changes the top activity title (e.g. `Goon Code`, `Visual Studio Code`, `Eclipse IDE`).
* **`targetDirectory`**: The local codebase folder to crawl. LarpCord will only swap between real files found here.
* **`customState`**: Overrides the second line of text (e.g. `this otter is busy` or `Working on feature-branch`).
* **`customLargeText`**: Tooltip shown when hovering the main icon.
* **`timestampMode`**:
  * `"file"`: Resets elapsed timer whenever a new file is opened (shows dwell time on current file).
  * `"session"`: Counts continuous time from when the client started.
* **`swapIntervalSeconds`**: Min and max dwell times before swapping to another file.
* **`cursorJitterIntervalSeconds`**: Min and max time between cursor position shifts.

---

## Windows Startup (Infinite Background)

To make LarpCord launch silently on boot:
* Run **`install-startup.bat`** (writes a silent `.vbs` to your Windows `shell:startup` folder).
* To disable: run **`uninstall-startup.bat`**.

If Discord isn't open when Windows starts, LarpCord waits quietly in the background and connects as soon as Discord opens.

---

## License

MIT
