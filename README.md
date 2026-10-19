# Pickleball Open Play Queue

A no-build, static web app for running pickleball open play: court assignments, a winners/losers queue, scores, a refund calculator, and a live scoreboard for players.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Landing page linking to the editor and the scoreboard |
| `pickleball-editor.html` | Organizer page (courts, queue, games, playing time and refunds) |
| `pickleball-viewer.html` | Player-facing scoreboard |
| `config.js` | Live sync settings (your Firebase database URL goes here) |
| `sync.js` | Live sync code used by the editor and the scoreboard |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

> Keep the file names as they are. The editor's **Copy viewer link** button builds the link to `pickleball-viewer.html` in the same folder.

## Deploy with GitHub Pages

1. Create a new repository on GitHub (for example `pickleball-queue`).
2. Upload all files in this folder to the repository root (**Add file → Upload files**), then commit.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose branch `main` and folder `/ (root)`, then **Save**.
5. After a minute or two, your site is live at:

   `https://<your-username>.github.io/<repository-name>/`

## Usage

- Open the site and choose **Open the Editor** to run the session.
- Press **Copy viewer link** in the editor and share it. Everyone who opens the link sees updates automatically (see Live updates below).
- The editor shows **● Live** in its header when it is syncing, and the scoreboard shows **● live** in its status line.

## Notes

- The session itself is stored in the organizer's browser (`localStorage`). Clearing browser data resets it. Only the scoreboard snapshot is sent to the cloud.
- The pages load the *Anton* and *Barlow Condensed* fonts from Google Fonts and fall back to system fonts when offline. The look is based on the Court28 Men's Doubles poster (electric blue, cream, yellow and cyan on black).
- On wide screens (1300px and up) the scoreboard shows three columns (On court, Queuing, Ranking) so the large player names fit on one TV screen. On smaller screens it stacks and scrolls.

## Live updates

Live sync works out of the box with no account and no setup. The editor sends the scoreboard to the free public relay [ntfy.sh](https://ntfy.sh), and every scoreboard that opens your viewer link listens to it.

1. Open the editor and wait for **● Live** in the header.
2. Press **Copy viewer link** and send that link to the players. It ends with `#room=...`.
3. Keep the editor open on the organizer's device during play.

If the header shows **⚠ Sync error**, hover over it for the reason. Links copied before live sync was added are old snapshots and never update, so copy a new one.

ntfy.sh is a free public service with usage limits, and the scoreboard data passes through it. The room code in the link is random, but anyone who has the link can read the scoreboard. If you run large groups, or want everything under your own account, use Firebase below.

## Optional: Firebase

1. Go to <https://console.firebase.google.com> and **Add project** (analytics not needed).
2. Open **Build → Realtime Database → Create Database**, pick the closest location, and start in **locked mode**.
3. Open the **Rules** tab, paste the following, and **Publish**:

   ```json
   {
     "rules": {
       ".read": false,
       ".write": false,
       "pbq": {
         "$room": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```

4. Copy the database URL (it looks like `https://<name>-default-rtdb.<region>.firebasedatabase.app`).
5. Paste it into `config.js` as `firebaseUrl`, commit, and wait a minute for GitHub Pages to redeploy.
6. Reopen the editor and copy a fresh viewer link.

Anyone with the link could also write to that room, so share it only with players.
