# bot/expensehandlers.py
from client import supa
from telebot import types
import requests
from bot.classes import Group, User, Expense, Settlement
import uuid

from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

import re
from bot.classes import User, Group, Expense


def register_expense_handlers(bot):
    """Register all command handlers for the bot."""
    def process_add_expense(group: Group, user: User, input_text: str):
        """
        Processes the /add_expense command input and updates the expense_splits table accordingly.

        Args:
            group (Group): The group where the expense is being added.
            user (User): The user who created the expense (payer).
            input_text (str): The input text in the format provided by the user.

        Returns:
            None
        """
        # Step 1: Parse the input
        lines = input_text.strip().split('\n')

        # Parse the expense name and total amount
        expense_name = lines[0]
        expense_amount = float(lines[1])

        # Step 2: Parse tagged users and their amounts
        tagged_amounts = {}
        total_tagged_amount = 0

        for line in lines[2:]:
            match = re.match(r'@(\w+)\s+(\d+(\.\d+)?)', line.strip())
            if match:
                username = match.group(1)
                amount = float(match.group(2))
                tagged_user = User.fetch_from_db_by_user_id(username)  # Fetch user by Telegram handle
                if tagged_user:
                    tagged_amounts[tagged_user] = amount
                    total_tagged_amount += amount
                else:
                    raise ValueError(f"User @{username} not found in the database.")

        # Step 3: Calculate the remaining amount to be split evenly among untagged users
        remaining_amount = expense_amount - total_tagged_amount

        # Fetch all group members
        group_members = group.fetch_all_members()

        # Untagged users are those who were not mentioned with specific amounts
        untagged_users = [member for member in group_members if member not in tagged_amounts]

        if untagged_users:
            split_amount_per_user = remaining_amount / len(untagged_users)
        else:
            split_amount_per_user = 0

        # Step 4: Create the expense entry in the database
        expense = Expense(group=group, paid_by=user, amount=expense_amount, description=expense_name)
        expense.save_to_db()

        # Step 5: Update expense splits for tagged users
        for tagged_user, amount in tagged_amounts.items():
            expense.add_split(user=tagged_user, amount_owed=amount)  # The tagged user owes the payer
            expense.add_split(user=user, amount_owed=-amount)  # The payer is owed the same amount from the tagged user

        # Step 6: Update expense splits for untagged users
        for untagged_user in untagged_users:
            expense.add_split(user=untagged_user, amount_owed=split_amount_per_user)  # Untagged users owe the payer
            expense.add_split(user=user, amount_owed=-split_amount_per_user)  # The payer is owed the amount from untagged users

        print("Expense processing complete.")
        
