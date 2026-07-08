"""
Main Textual application for azufw.
"""

from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
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
        padding: 0 1;
        height: 1fr;
    }

    #left-panel {
        width: 50%;
        height: 100%;
        padding: 0 1 0 0;
    }

    #right-panel {
        width: 50%;
        height: 100%;
        padding: 0 0 0 1;
        border-left: solid #2d2d5e;
    }

    #firewall-status {
        text-align: right;
        padding: 1 0;
    }

    .section-title {
        color: #e0e0e0;
        text-style: bold;
        padding: 1 0;
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

    #help-text {
        color: #aaaaaa;
        padding: 0 0 1 0;
    }

    #rule-details {
        color: #cccccc;
        padding: 1 0;
        height: 1fr;
    }

    #rule-details .detail-label {
        color: #888888;
    }

    #rule-details .detail-value {
        color: #e0e0e0;
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
        self.rules: list[Rule] = []

    def compose(self) -> ComposeResult:
        """Create child widgets."""
        yield Header(show_clock=True)
        yield Horizontal(
            Vertical(
                Static(id="firewall-status"),
                Static("📋 Firewall Rules", classes="section-title"),
                DataTable(id="rules-table"),
                Static(id="summary-bar"),
                id="left-panel",
            ),
            Vertical(
                Static("🔥 Help & Details", classes="section-title"),
                Static(
                    " [bold]Keyboard Shortcuts[/]\n"
                    "  [dim]↑/↓[/]  Navigate rules\n"
                    "  [dim]r[/]     Refresh\n"
                    "  [dim]q[/]     Quit\n",
                    id="help-text",
                ),
                Static("📝 No rule selected", id="rule-details"),
                id="right-panel",
            ),
            id="main-container",
        )
        yield Footer()

    def on_mount(self) -> None:
        """Called when app is mounted."""
        table = self.query_one("#rules-table", DataTable)
        table.cursor_type = "row"
        table.zebra_stripes = True

        self.refresh_data()

    def on_data_table_row_highlighted(self, event: DataTable.RowHighlighted) -> None:
        """Update rule details when cursor moves to a different row."""
        if event.cursor_row is not None and event.cursor_row < len(self.rules):
            self._show_rule_details(self.rules[event.cursor_row])

    def action_refresh(self) -> None:
        """Refresh the rules list."""
        self.refresh_data()

    def action_quit(self) -> None:
        """Quit the application."""
        self.exit()

    def refresh_data(self) -> None:
        """Refresh all data from UFW."""
        self.rules = []
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

        self.rules = self.ufw.get_rules()

        if not self.rules:
            table.display = False
            empty = Static("📭 No rules found", id="empty-message")
            self.query_one("#left-panel").mount(empty)
            self._clear_rule_details()
        else:
            table.display = True
            table.add_columns("  #  ", "Action", "Port", "From", "Comment")

            for rule in self.rules:
                action_cell = self._format_action(rule.action)
                table.add_row(
                    str(rule.number),
                    action_cell,
                    f"{rule.port}/{rule.protocol}",
                    rule.from_ip,
                    rule.comment if rule.comment else "-",
                )

            table.move_cursor(row=0)
            self._show_rule_details(self.rules[0])

        self._update_summary(len(self.rules))

    def _clear_rule_details(self) -> None:
        """Clear rule details display."""
        details = self.query_one("#rule-details", Static)
        details.update("📝 No rule selected")

    def _show_rule_details(self, rule: Rule) -> None:
        """Display details of the selected rule."""
        details = self.query_one("#rule-details", Static)
        details.update(
            " [bold underline]📝 Selected Rule[/]\n\n"
            f"  [dim]Rule #[/]      {rule.number}\n"
            f"  [dim]Action[/]      [{rule.action.lower()}]{rule.action}[/]\n"
            f"  [dim]Port[/]        {rule.port}/{rule.protocol}\n"
            f"  [dim]From[/]        {rule.from_ip}\n"
            f"  [dim]Comment[/]     {rule.comment if rule.comment else '-'}"
        )

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
        table = self.query_one("#rules-table", DataTable)
        table.display = False

        error_widget = Static(
            f"⚠️ Error: {message}",
            id="warning-message"
        )
        self.query_one("#left-panel").mount(error_widget)

        self.query_one("#firewall-status", Static).update("")
        self._update_summary(0)


def main():
    """Entry point for the application."""
    app = AzufwApp()
    app.run()
