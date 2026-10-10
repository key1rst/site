"""Create a local staff account. Run: python -m backend.create_admin <email> <role>"""

import getpass
import sys

from backend.app.main import create_staff


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python -m backend.create_admin <email> <admin|sales|procurement>")
    password = getpass.getpass("Password (14+ characters): ")
    create_staff(sys.argv[1], password, sys.argv[2])
    print("Staff account created")
