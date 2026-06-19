"""
Entry point for azufw.
"""

import sys
from azufw.app import AzufwApp


def main():
    """Run the azufw application."""
    try:
        app = AzufwApp()
        app.run()
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()