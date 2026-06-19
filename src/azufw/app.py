"""
Main Textual application for azufw.
"""

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, DataTable, Static
from textual.binding import Binding

from azufw.ufw import UFWController, Rule


class AzufwApp(App):
    """Main azufw application."""

    CSS = """
    Screen {
        background: #1a1a2e;
    }

    #main-container {
        padding: 1 2;
    }

    #firewall-status {
        text-align: right;
        padding: 1 2;
    }

    #warning-message {
        color: #ff6b6b;
        text-align: center;
        padding: 2 0;
        text-style: bold;
    }

    #empty-message {
        color: #888888;
        text-align: center;
        padding: 4 0;
        text-style: italic;
    }

    #summary-bar {
        color: #888888;
        padding: 1 0;
    }

    DataTable {
        height: 1fr;
        border: solid #2d2d5e;
    }

    DataTable > .datatable--header {
        background: #16213e;
        color: #e0e0e0;
        text-style: bold;
    }

    DataTable > .datatable--cursor {
        background: #0f3460;
        color: #ffffff;
    }

    /* Action colors */
    .action-allow {
        color: #00ff88;
        text-style: bold;
    }

    .action-deny {
        color: #ff4444;
        text-style: bold;
    }

    .action-limit {
        color: #ffaa00;
        text-style: bold;
    }
    """

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("q", "quit", "Quit"),
    ]

    def __init__(self):
        super().__init__()
        self.ufw = UFWController()

    def compose(self) -> ComposeResult:
        """Create child widgets."""
        yield Header(show_clock=True)
        yield Container(
            Static(id="firewall-status"),
            Static("📋 Firewall Rules", classes="section-title"),
            DataTable(id="rules-table"),
            Static(id="summary-bar"),
            id="main-container",
        )
        yield Footer()

    def on_mount(self) -> None:
        """Called when app is mounted."""
        # Set up the rules table
        table = self.query_one("#rules-table", DataTable)
        table.cursor_type = "row"
        table.zebra_stripes = True

        # Load rules
        self.refresh_data()

    def action_refresh(self) -> None:
        """Refresh the rules list."""
        self.refresh_data()

    def action_quit(self) -> None:
        """Quit the application."""
        self.exit()

    def refresh_data(self) -> None:
        """Refresh all data from UFW."""
        try:
            self.ufw._check_sudo()
            self._load_rules()
            self._update_status()
        except PermissionError as e:
            self._show_error(str(e))
        except Exception as e:
            self._show_error(str(e))

    def _load_rules(self) -> None:
        """Load and display firewall rules."""
        table = self.query_one("#rules-table", DataTable)
        table.clear()
        table.columns.clear()

        rules = self.ufw.get_rules()

        if not rules:
            # Show empty message
            table.display = False
            empty = Static("📭 No rules found", id="empty-message")
            self.query_one("#main-container").mount(empty)
        else:
            # Add columns
            table.display = True
            table.add_columns("  #  ", "Action", "Port", "From", "Comment")

            # Add rows
            for rule in rules:
                action_cell = self._format_action(rule.action)
                table.add_row(
                    str(rule.number),
                    action_cell,
                    f"{rule.port}/{rule.protocol}",
                    rule.from_ip,
                    rule.comment if rule.comment else "-",
                )

        # Update summary
        self._update_summary(len(rules))

    def _format_action(self, action: str) -> str:
        """Format action with color markup."""
        return f"[action-{action.lower()}]{action}[/]"

    def _update_status(self) -> None:
        """Update firewall status display."""
        status = self.ufw.get_status()
        status_widget = self.query_one("#firewall-status", Static)

        if status == "active":
            status_widget.update("🟢 Firewall: Active")
        else:
            status_widget.update("🔴 Firewall: Inactive")

    def _update_summary(self, rule_count: int) -> None:
        """Update summary bar."""
        summary = self.query_one("#summary-bar", Static)
        summary.update(f"📊 Total: {rule_count} rules")

    def _show_error(self, message: str) -> None:
        """Show error message."""
        # Clear table
        table = self.query_one("#rules-table", DataTable)
        table.display = False

        # Show error
        error_widget = Static(
            f"⚠️ Error: {message}",
            id="warning-message"
        )
        self.query_one("#main-container").mount(error_widget)

        # Update status
        self.query_one("#firewall-status", Static).update("")

        # Update summary
        self._update_summary(0)


def main():
    """Entry point for the application."""
    app = AzufwApp()
    app.run()