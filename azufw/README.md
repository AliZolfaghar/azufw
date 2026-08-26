# AZUFW — UFW Firewall Manager

A terminal-based UI (TUI) for managing **UFW** firewall rules on Linux — view, add, edit, delete and restore rules without memorizing `ufw` command syntax.

Built with [Node.js](https://nodejs.org) and [neo-blessed](https://github.com/chjj/blessed).

---

## ✨ Features

- 🛡️ **Full Rule Management** — View, add, edit and delete UFW rules from a friendly TUI
- 🎨 **Color-Coded Rules** — ALLOW = green, DENY/REJECT = red, critical SSH rules = yellow
- 🔒 **SSH Protection** — The rule protecting your SSH port is marked *CRITICAL* and blocked from deletion, so you can't lock yourself out
- ⚡ **Preset Rules** — One-press templates for common services (SSH, HTTP/HTTPS, MySQL, PostgreSQL, Docker, …)
- 📜 **Delete History & Restore** — Deleted rules are stored locally and can be restored at any time
- 🚫 **Duplicate Detection** — Adding an identical rule shows a warning instead of creating a copy
- ❗ **Error Popups** — Failed UFW commands are reported clearly; your form input is preserved so you can fix and retry
- 🖥️ **Rich Detail Panel** — Selected rule details grouped into Connection / Addressing / Description sections
- 🪟 **Windows Mock Mode** — Runs with simulated data on Windows/macOS for UI development

---

## 📋 Requirements

| Requirement | Notes |
|---|---|
| Linux | Ubuntu / Debian recommended (any distro with `ufw`) |
| Node.js | ≥ 14 |
| UFW | `sudo apt install ufw` |
| Root access | UFW requires sudo to read/modify rules |

> On Windows or macOS the app starts in **mock mode**: the full UI works against simulated rules, no system changes are made.

---

## 📦 Installation

### From npm (recommended)

```bash
sudo npm install -g azufw
```

### From source

```bash
git clone https://github.com/AliZolfaghar/azufw.git
cd azufw
npm install
sudo npm start
```

---

## 🚀 Usage

```bash
sudo azufw
```

> ⚠️ Root privileges are required on Linux — without them UFW cannot report or apply rules.

On first launch you'll see a welcome screen. Press **Enter** on *Accept and Start* to continue.

---

## 🧭 Using the App

### Main Screen Layout

```
┌──────────────────────────────────────────────────┐
│                AZUFW — header                    │
├───────────────────────┬──────────────────────────┤
│  Rules (left panel)   │  Rule Details (right)    │
│  #  Action Port ...   │  RULE #5  [ALLOW]        │
│  1  ALLOW    22 ...   │  ▸ CONNECTION            │
│  2  DENY     25 ...   │  ▸ ADDRESSING            │
│                       │  ─ AZUFW logo ─          │
├───────────────────────┴──────────────────────────┤
│ Status: ● Active │ keybinding hints              │
└──────────────────────────────────────────────────┘
```

- **Left panel** lists all rules: number, action, port, protocol, source, target, IP version and comment.
- **Right panel** shows full details of the selected rule, plus the app logo.
- **Footer** shows UFW status and available keys.

### Viewing a Rule

Move with `↑` / `↓`. The right panel instantly shows the selected rule's action badge, direction, port/protocol, source/destination addresses, IP version, comment and a CRITICAL warning if it protects SSH.

### Adding a Rule (manual)

1. Press **A**.
2. Fill the form:
   - `Action` / `Protocol` are dropdowns — change with `Space` or `←/→`.
   - Text fields support cursor movement (`←/→`, `Home`, `End`) for easy editing.
3. Press **Ctrl+S** to save, **Esc** to cancel.

If a rule with the same action/port/protocol/source/target already exists, a warning popup appears instead of creating a duplicate.

### Adding a Preset Rule

1. Press **P** to open the preset list.
2. Navigate with `↑/↓` and press **Enter**.
3. The Add form opens pre-filled with the preset values — adjust anything you like, then **Ctrl+S** to save.

Available presets:

| Service | Action | Port | Protocol |
|---|---|---|---|
| SSH | ALLOW | 22 | TCP |
| HTTP | ALLOW | 80 | TCP |
| HTTPS | ALLOW | 443 | TCP |
| MySQL | ALLOW | 3306 | TCP |
| PostgreSQL | ALLOW | 5432 | TCP |
| SQL Server | ALLOW | 1433 | TCP |
| MongoDB | ALLOW | 27017 | TCP |
| Redis | ALLOW | 6379 | TCP |
| FTP | ALLOW | 21 | TCP |
| SMTP | ALLOW | 25 | TCP |
| DNS | ALLOW | 53 | UDP |
| Docker | ALLOW | 2376 | TCP |
| Nginx | ALLOW | 8080 | TCP |
| Apache | ALLOW | 8080 | TCP |
| Tomcat | ALLOW | 8443 | TCP |
| RDP | ALLOW | 3389 | TCP |
| Custom | — | empty | — |

### Viewing Live Traffic

Select a rule and press **I** to open a live traffic popup for that rule:

- **Totals** — packets and bytes matched by the rule since boot (read from iptables counters)
- **Live rate** — packets/s and bandwidth/s, refreshed every second
- Close with **Esc** or **Q**

> Requires root (already running under `sudo`) and iptables; counters are read from the `ufw-user-input` chain.

### Editing a Rule

Select a rule and press **Enter**. The form opens with current values; modify and press **Ctrl+S**. After saving, selection stays on the edited rule.

### Deleting a Rule

Select a rule and press **Delete**. A confirmation popup shows the exact rule — press **Y** to confirm, **N**/**Esc** to cancel.

> 🔒 Rules detected as critical (your SSH port) cannot be deleted — this prevents remote lock-out.

### History & Restore

Press **H** to switch the right panel to *Deleted Rules History*.

- `↑/↓` — browse deleted rules
- `Enter` — restore the highlighted rule back into UFW
- `Esc` — return to normal view

### Error Handling

If a UFW command fails (add/edit/delete), an error popup explains why. Close it with **Enter** or **Esc** — the form reopens with everything you typed, ready to correct and retry.

---

## ⌨️ Keybindings Reference

In-app help is always available via **?**.

### Main Screen

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate rules / history entries |
| `Enter` | Edit selected rule • Restore history entry |
| `A` | Add new rule |
| `P` | Open preset rules popup |
| `I` | Live traffic info for selected rule |
| `Delete` | Delete selected rule (with confirmation) |
| `R` | Refresh rule list |
| `H` | Toggle deleted-rules history |
| `Esc` | Back (history → normal view) |
| `?` | Help popup |
| `Q` / `Ctrl+C` | Quit |

### Add / Edit Form

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` / `↑↓` | Next / previous field |
| `←` / `→` | Move text cursor — or cycle choices on dropdowns |
| `Space` | Cycle dropdown choices — types space in text fields |
| `Home` / `End` | Jump to start / end of line |
| `Backspace` | Delete character before cursor |
| `Del` | Delete character after cursor |
| `Ctrl+S` | Save rule |
| `Esc` | Cancel |

### Popups

| Popup | Keys |
|---|---|
| Welcome | `Enter` accept |
| Preset list | `↑↓` navigate • `Enter` select • `Esc` close |
| Delete confirm | `Y` confirm • `N` / `Esc` cancel |
| Error | `Enter` / `Esc` close (form restores) |
| Help | any key closes |

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `Permission denied` / rules missing | Run with `sudo azufw` |
| `ufw: command not found` | Install UFW: `sudo apt install ufw` |
| Screen renders garbled | Resize terminal; ensure UTF-8 locale (`export LANG=C.UTF-8`) |
| Locked out after changes? | Critical SSH rules can't be deleted from the app; use console access if needed |

---

## 📁 Project Structure

```
azufw/
├── bin/azufw.js            # executable entry point
├── src/
│   ├── index.js            # bootstrap + global key bindings
│   ├── cli/
│   │   ├── checker.js      # sudo check & ufw bootstrap
│   │   └── ufw-executor.js # runs ufw commands
│   ├── controllers/
│   │   ├── rule-controller.js     # business logic
│   │   └── history-controller.js  # deleted-rule persistence (~/.azufw-history.json)
│   ├── models/
│   │   ├── Rule.js         # rule model & parsing
│   │   └── History.js      # history model
│   ├── ui/                 # neo-blessed components
│   │   ├── screen.js header.js footer.js
│   │   ├── left-panel.js right-panel.js
│   │   ├── form-popup.js preset-popup.js
│   │   ├── welcome.js help.js
│   └── utils/
│       ├── platform.js     # OS detection & mock mode
│       └── ssh-detector.js # detects local SSH port
└── package.json
```

---

## 👤 Author

**Ali Zolfaghar**
- Email: azolfaghar@gmail.com
- GitHub: <https://github.com/AliZolfaghar/azufw>

## 📄 License

[MIT](LICENSE) © Ali Zolfaghar
