# AZUFW — UFW Firewall Manager

A terminal-based UI (TUI) for managing UFW firewall rules on Linux, built with Node.js and neo-blessed.

## Features

- 🛡️ **Firewall Rule Management** — View, add, edit, and delete UFW rules
- 🎨 **Color-coded UI** — Allow=Green, Deny=Red, Critical=Yellow
- 🔒 **SSH Protection** — Critical rules (SSH port) are locked from deletion
- 📜 **History** — Deleted rules are saved and can be restored
- 🪟 **Windows Mock Mode** — Runs with simulated data on Windows

## Installation

```bash
sudo npm install -g azufw
```

## Usage

```bash
sudo azufw
```

> ⚠️ Root privileges are required on Linux.

## Keybindings

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate rules |
| `Enter` | Edit selected rule |
| `A` | Add new rule |
| `P` | Add preset rule (common services) |
| `Delete` | Delete selected rule |
| `R` | Refresh rule list |
| `H` | View history |
| `Esc` | Cancel/Go back |
| `?` | Show help |
| `Q` / `Ctrl+C` | Quit |

### Form Keybindings (Add/Edit)

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` / `↑/↓` | Next/Previous field |
| `←/→` / `Space` | Cycle choices (dropdown) |
| `←/→` | Move cursor (text input) |
| `Home/End` | Jump to start/end of text |
| `Backspace/Delete` | Delete character |
| `Ctrl+S` | Save rule |
| `Esc` | Cancel |

## Requirements

- Linux (Ubuntu/Debian recommended)
- Node.js >= 14
- UFW (`sudo apt install ufw`)
- Root access

## License

MIT
