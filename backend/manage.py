#!/usr/bin/env python3
"""
Helm CLI — server management commands.

Architecture Decision: Session 2, Section 11 — CLI-only user creation.
No HTTP endpoint for creating additional users beyond the initial setup.

Usage:
    python manage.py create_user              # Interactive prompts
    python manage.py create_user --username admin --password secret
    python manage.py list_users
"""
import argparse
import asyncio
import getpass
import sys

from app.database import AsyncSessionLocal
from app.models.user import User
from app.utils.security import hash_password
from sqlalchemy import select
from uuid import uuid4


async def create_user(username: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        # Check if user exists
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            print(f"Error: User '{username}' already exists.")
            sys.exit(1)

        user = User(
            id=str(uuid4()),
            username=username,
            password_hash=hash_password(password),
            role="admin",
        )
        db.add(user)
        await db.commit()
        print(f"User '{username}' created successfully (id: {user.id})")


async def list_users() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        if not users:
            print("No users found.")
            return
        print(f"{'ID':<40} {'Username':<20} {'Role':<10}")
        print("-" * 70)
        for user in users:
            print(f"{user.id:<40} {user.username:<20} {user.role:<10}")


def main():
    parser = argparse.ArgumentParser(description="Helm server management CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # create_user
    create_parser = subparsers.add_parser("create_user", help="Create a new user")
    create_parser.add_argument("--username", "-u", help="Username")
    create_parser.add_argument("--password", "-p", help="Password (prompted if not provided)")

    # list_users
    subparsers.add_parser("list_users", help="List all users")

    args = parser.parse_args()

    if args.command == "create_user":
        username = args.username or input("Username: ").strip()
        if not username:
            print("Error: Username cannot be empty.")
            sys.exit(1)
        password = args.password or getpass.getpass("Password: ")
        if not password:
            print("Error: Password cannot be empty.")
            sys.exit(1)
        asyncio.run(create_user(username, password))

    elif args.command == "list_users":
        asyncio.run(list_users())

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
