"""
Main Textual application for azufw.
"""

from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical, Container
from textual.widgets import Header, Footer, DataTable, Static, Input, Select, Button, Label
from textual.screen import ModalScreen
from textual.binding import Binding

from azufw.ufw import UFWController, Rule


VALID_ACTIONS = ["ALLOW", "DENY", "LIMIT", "REJECT"]


class RuleFormScreen(ModalScreen[dict | None]):
    """Modal form for adding or editing a rule."""

    CSS = """
    RuleFormScreen {
        align: center middle;
        background: rgba(0, 0, 0, 0.7);
    }

    #form-container {
        width: 50;
        height: auto;
        padding: 2 3;
        background: #1a1a2e;
        border: solid #2d2d5e;
    }

    #form-title {
        text-style: bold;
        padding: 0 0 1 0;
    }

    Label {
        margin: 1 0 0 0;
        color: #aaaaaa;
    }

    Input, Select {
        margin: 0 0 0 0;
    }

    #form-buttons {
        margin: 2 0 0 0;
        align: center middle;
    }

    Button {
        margin: 0 1;
    }

    #form-error {
        color: #ff6b6b;
        text-align: center;
        margin: 1 0 0 0;
    }
    """

    def __init__(self, rule: Rule | None = None) -> None:
        super().__init__()
        self.rule = rule

    def compose(self) -> ComposeResult:
        title = "Edit Rule" if self.rule else "Add Rule"
        yield Container(
            Static(f"[bold]{title}[/]", id="form-title"),
            Label("Action"),
            Select(
                [(a, a) for a in VALID_ACTIONS],
                id="action-select",
                value=self.rule.action if self.rule else "ALLOW",
            ),
            Label("Port"),
            Input(
                placeholder="e.g. 22, 80, 3000",
                id="port-input",
                value=self.rule.port if self.rule else "",
            ),
            Label("Protocol"),
            Select(
                [("tcp", "tcp"), ("udp", "udp")],
                id="protocol-select",
                value=self.rule.protocol if self.rule else "tcp",
            ),
            Label("From IP"),
            Input(
                placeholder="e.g. Anywhere, 192.168.1.0/24",
                id="from-input",
                value=self.rule.from_ip if self.rule else "Anywhere",
            ),
            Label("Comment"),
            Input(
                placeholder="Optional description",
                id="comment-input",
                value=self.rule.comment if self.rule else "",
            ),
            Static(id="form-error"),
            Horizontal(
                Button("Save", id="save-btn", variant="primary"),
                Button("Cancel", id="cancel-btn"),
                id="form-buttons",
            ),
            id="form-container",
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel-btn":
            self.dismiss(None)
            return

        if event.button.id == "save-btn":
            self._save()

    def _save(self) -> None:
        action = self.query_one("#action-select", Select).value
        port = self.query_one("#port-input", Input).value.strip()
        protocol = self.query_one("#protocol-select", Select).value
        from_ip = self.query_one("#from-input", Input).value.strip()
        comment = self.query_one("#comment-input", Input).value.strip()

        if not port:
            self.query_one("#form-error", Static).update("⚠️ Port is required")
            return
        if not port.isdigit() or not (1 <= int(port) <= 65535):
            self.query_one("#form-error", Static).update("⚠️ Port must be a number (1-65535)")
            return
        if not from_ip:
            from_ip = "Anywhere"

        self.dismiss({
            "action": action,
            "port": port,
            "protocol": protocol,
            "from_ip": from_ip,
            "comment": comment,
        })


class ConfirmDeleteScreen(ModalScreen[bool]):
    """Modal confirmation for deleting a rule."""

    CSS = """
    ConfirmDeleteScreen {
        align: center middle;
        background: rgba(0, 0, 0, 0.7);
    }

    #confirm-container {
        width: 40;
        height: auto;
        padding: 2 3;
        background: #1a1a2e;
        border: solid #2d2d5e;
    }

    #confirm-title {
        text-style: bold;
        padding: 0 0 1 0;
    }

    #confirm-text {
        color: #cccccc;
    }

    #confirm-buttons {
        margin: 2 0 0 0;
        align: center middle;
    }

    Button {
        margin: 0 1;
    }
    """

    def __init__(self, rule: Rule) -> None:
        super().__init__()
        self.rule = rule

    def compose(self) -> ComposeResult:
        yield Container(
            Static("[bold]⚠️ Delete Rule[/]", id="confirm-title"),
            Static(
                f"Are you sure you want to delete rule #{self.rule.number}?\n\n"
                f"  [dim]Action:[/] [{self.rule.action.lower()}]{self.rule.action}[/]\n"
                f"  [dim]Port:[/]   {self.rule.port}/{self.rule.protocol}\n"
                f"  [dim]From:[/]   {self.rule.from_ip}",
                id="confirm-text",
            ),
            Horizontal(
                Button("Yes, Delete", id="confirm-yes", variant="error"),
                Button("Cancel", id="confirm-no"),
                id="confirm-buttons",
            ),
            id="confirm-container",
        )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.dismiss(event.button.id == "confirm-yes")


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

    .action-reject {
        color: #ff66aa;
        text-style: bold;
    }
    """

    BINDINGS = [
        Binding("a", "add_rule", "Add"),
        Binding("e", "edit_rule", "Edit"),
        Binding("d", "delete_rule", "Delete"),
        Binding("r", "refresh", "Refresh"),
        Binding("q", "quit", "Quit"),
    ]

    def __init__(self):
        super().__init__()
        self.ufw = UFWController()
        self.rules: list[Rule] = []

    def compose(self) -> ComposeResult:
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
                    "  [dim]a[/]     Add rule\n"
                    "  [dim]e[/]     Edit selected rule\n"
                    "  [dim]d[/]     Delete selected rule\n"
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
        table = self.query_one("#rules-table", DataTable)
        table.cursor_type = "row"
        table.zebra_stripes = True
        self.refresh_data()

    def on_data_table_row_highlighted(self, event: DataTable.RowHighlighted) -> None:
        if event.cursor_row is not None and event.cursor_row < len(self.rules):
            self._show_rule_details(self.rules[event.cursor_row])

    def _get_selected_rule(self) -> Rule | None:
        table = self.query_one("#rules-table", DataTable)
        if table.cursor_row is not None and table.cursor_row < len(self.rules):
            return self.rules[table.cursor_row]
        return None

    def action_add_rule(self) -> None:
        def on_result(result: dict | None) -> None:
            if result is None:
                return
            self.ufw.add_rule(**result)
            self.refresh_data()
        self.push_screen(RuleFormScreen(), on_result)

    def action_edit_rule(self) -> None:
        rule = self._get_selected_rule()
        if rule is None:
            return

        def on_result(result: dict | None) -> None:
            if result is None:
                return
            self.ufw.edit_rule(rule.number, **result)
            self.refresh_data()
        self.push_screen(RuleFormScreen(rule=rule), on_result)

    def action_delete_rule(self) -> None:
        rule = self._get_selected_rule()
        if rule is None:
            return

        def on_result(confirmed: bool) -> None:
            if confirmed:
                self.ufw.delete_rule(rule.number)
                self.refresh_data()

        self.push_screen(ConfirmDeleteScreen(rule=rule), on_result)

    def action_refresh(self) -> None:
        self.refresh_data()

    def action_quit(self) -> None:
        self.exit()

    def refresh_data(self) -> None:
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
        details = self.query_one("#rule-details", Static)
        details.update("📝 No rule selected")

    def _show_rule_details(self, rule: Rule) -> None:
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
        action_lower = action.lower()
        if action_lower not in ("allow", "deny", "limit", "reject"):
            return action
        return f"[action-{action_lower}]{action}[/]"

    def _update_status(self) -> None:
        status = self.ufw.get_status()
        status_widget = self.query_one("#firewall-status", Static)
        status_widget.update("🟢 Firewall: Active" if status == "active" else "🔴 Firewall: Inactive")

    def _update_summary(self, rule_count: int) -> None:
        summary = self.query_one("#summary-bar", Static)
        summary.update(f"📊 Total: {rule_count} rules")

    def _show_error(self, message: str) -> None:
        table = self.query_one("#rules-table", DataTable)
        table.display = False

        error_widget = Static(f"⚠️ Error: {message}", id="warning-message")
        self.query_one("#left-panel").mount(error_widget)

        self.query_one("#firewall-status", Static).update("")
        self._update_summary(0)


def main():
    """Entry point for the application."""
    app = AzufwApp()
    app.run()
