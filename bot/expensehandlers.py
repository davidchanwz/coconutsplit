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


    # Step 1: Start the /add_expense process
    @bot.message_handler(commands=['add_expense'])
    def add_expense_start(message):
        chat_id = message.chat.id
        user_id = message.from_user.id

        # Fetch the user and group from the database
        user = User.fetch_from_db_by_user_id(user_id)
        group = Group.fetch_from_db_by_chat(chat_id)

        if group is None:
            bot.send_message(chat_id, "No group associated with this chat.")
            return

        if user is None:
            bot.send_message(chat_id, "You are not registered. Please register first.")
            return

        # Step 2: Ask for the expense details (name, amount, tagged users)
        msg = bot.send_message(chat_id, "Please enter the expense details in the format:\n\n{expense name}\n{expense amount}\n@{user telegram handle} {amount}\n\nExample:\n\nDinner\n100\n@john 70")
        
        # Set up a handler to wait for the user's reply
        bot.register_next_step_handler(msg, process_expense_reply, group, user)

    # Step 3: Process the user's reply
    def process_expense_reply(message, group, user):
        chat_id = message.chat.id
        input_text = message.text  # Get the input text from the user's reply
        
        try:
            # Call the process_add_expense function to handle the input
            process_add_expense(group, user, input_text)
            bot.send_message(chat_id, "Expense added successfully.")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to add expense: {e}")

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
        tagged_with_amount = {}
        tagged_without_amount = []
        total_tagged_amount = 0

        for line in lines[2:]:
            match_with_amount = re.match(r'@(\w+)\s+(\d+(\.\d+)?)', line.strip())
            match_without_amount = re.match(r'@(\w+)', line.strip())

            if match_with_amount:
                # User with a specific amount
                username = match_with_amount.group(1)
                amount = float(match_with_amount.group(2))
                tagged_user = User.fetch_from_db_by_username(username)  # Fetch user by Telegram handle
                if tagged_user:
                    tagged_with_amount[tagged_user] = amount
                    total_tagged_amount += amount
                else:
                    raise ValueError(f"User @{username} not found in the database.")

            elif match_without_amount:
                # User without a specific amount (to split remaining amount)
                username = match_without_amount.group(1)
                tagged_user = User.fetch_from_db_by_username(username)
                if tagged_user:
                    tagged_without_amount.append(tagged_user)
                else:
                    raise ValueError(f"User @{username} not found in the database.")

        # Step 3: Calculate the remaining amount to be split among users with no specific amount
        remaining_amount = expense_amount - total_tagged_amount

        if tagged_without_amount:
            split_amount_per_user = remaining_amount / (len(tagged_without_amount) + 1)
        else:
            split_amount_per_user = 0

        # Step 4: Create the expense entry in the database
        expense = Expense(group=group, paid_by=user, amount=expense_amount, description=expense_name)
        expense.save_to_db()

        # Step 5: Update expense splits for users tagged with specific amounts
        for tagged_user, amount in tagged_with_amount.items():
            expense.add_split(user=tagged_user, amount_owed=amount)  # The tagged user owes the payer
            expense.add_split_reverse(user=tagged_user, amount_owed=-amount)  # The payer is owed the same amount from the tagged user

        # Step 6: Update expense splits for users tagged without specific amounts (split the remaining amount)
        for tagged_user in tagged_without_amount:
            expense.add_split(user=tagged_user, amount_owed=split_amount_per_user)  # Tagged users without amount owe their split
            expense.add_split_reverse(user=tagged_user, amount_owed=-split_amount_per_user)  # The payer is owed the split amount

        print("Expense processing complete.")
            
