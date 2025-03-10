# bot/expensehandlers.py
from client import supa
from telebot import types
import requests
from bot.classes import Group, User, Expense, Settlement
import uuid
from collections import defaultdict
from datetime import datetime
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
        Processes the /add_expense command input and updates the debts table accordingly.

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
                if not group.check_user_in_group(tagged_user):
                    raise ValueError(f"User @{username} is not a member of this group.")

            elif match_without_amount:
                # User without a specific amount (to split remaining amount)
                username = match_without_amount.group(1)
                tagged_user = User.fetch_from_db_by_username(username)
                if tagged_user:
                    tagged_without_amount.append(tagged_user)
                else:
                    raise ValueError(f"User @{username} not found in the database.")
                if not group.check_user_in_group(tagged_user):
                    raise ValueError(f"User @{username} is not a member of this group.")
        

        if total_tagged_amount > expense_amount:
            raise ValueError(f"Total tagged amount ({total_tagged_amount}) exceeds the expense amount ({expense_amount}).")


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
            expense.add_debt(user=tagged_user, amount_owed=amount)  # The tagged user owes the payer
            expense.add_debt_reverse(user=tagged_user, amount_owed=-amount)  # The payer is owed the same amount from the tagged user
            expense.add_split(user=tagged_user, amount=amount) # Add expense split to table

        # Step 6: Update expense splits for users tagged without specific amounts (split the remaining amount)
        for tagged_user in tagged_without_amount:
            expense.add_debt(user=tagged_user, amount_owed=split_amount_per_user)  # Tagged users without amount owe their split
            expense.add_debt_reverse(user=tagged_user, amount_owed=-split_amount_per_user)  # The payer is owed the split amount
            expense.add_split(user=tagged_user, amount=split_amount_per_user) # Add expense split to table


        print("Expense processing complete.")

    @bot.message_handler(commands=['show_expenses'])
    def show_expenses(message):
        chat_id = message.chat.id
        user_id = message.from_user.id

        # Fetch the group by chat ID
        group = Group.fetch_from_db_by_chat(chat_id)

        if group is None:
            bot.send_message(chat_id, "No group associated with this chat.")
            return

        # Fetch expenses for the group (sorted by created_at automatically)
        expenses = Expense.fetch_expenses_by_group(group)

        group_members_dict = Group.fetch_group_members_dict(group)

        expense_splits_dict = Expense.fetch_expense_splits_dict(expenses)

        if not expenses:
            bot.send_message(chat_id, "There are no expenses recorded in this group.")
            return

        # Group expenses by date
        expenses_by_date = defaultdict(list)
        for expense in expenses:
            date_str = expense.created_at.strftime('%Y-%m-%d')  # Group by 'YYYY-MM-DD'
            expenses_by_date[date_str].append(expense)

        # Sort the dates (earliest first)
        sorted_dates = sorted(expenses_by_date.keys())

        # Format the expenses for each date
        formatted_output = []
        for date in sorted_dates:
            formatted_output.append(f"📅 *{date}*")  # Display the date as a section header
            for expense in expenses_by_date[date]:
                # Add main expense details
                expense_details = f"  • {expense.description}: {expense.amount} (Paid by {expense.paid_by.username})"
                
                # Fetch splits for this expense
                splits = expense_splits_dict.get(expense.expense_id)
                
                if splits:
                    split_details = ""
                    for split in splits:
                        user = group_members_dict.get(split['user_id'])
                        username = "Unknown User" if not user else user.username
                        split_details += f"\n      - {username} owes {split['amount']}"
                    expense_details += split_details

                formatted_output.append(expense_details)
        
        # Send the formatted list of expenses
        bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')

    @bot.message_handler(commands=['show_debts'])
    def show_debts(message):
        chat_id = message.chat.id

        # Fetch the group by chat ID
        group = Group.fetch_from_db_by_chat(chat_id)

        if group is None:
            bot.send_message(chat_id, "No group associated with this chat.")
            return

        # Fetch all debts for the group
        debts = group.fetch_debts_by_group()

        if not debts:
            bot.send_message(chat_id, "There are no recorded debts in this group.")
            return

        # Step 1: Aggregate debts (netted amounts owed between users)
        user_balances = calculate_user_balances(debts)

        # Step 2: Simplify debts (minimize transactions)
        simplified_debts = simplify_debts(user_balances)

        # Step 3: Display the results
        if simplified_debts:
            display_debts(simplified_debts, chat_id, group)
        else:
            bot.send_message(chat_id, "All debts have been settled!")

    def calculate_user_balances(debts):
        """Calculate the net balances for each user based on expense splits."""
        balances = {}

        # Process each split, but only handle the "positive" direction (one-way) to avoid double counting
        for debt in debts:
            user_id = debt['user_id']
            opp_user_id = debt['opp_user_id']
            amount_owed = debt['amount_owed']

            # Only consider debts where amount_owed > 0 (ignore the reverse row where the amount is negative)
            if amount_owed > 0:
                # Update balances for the user who owes
                if user_id not in balances:
                    balances[user_id] = 0
                balances[user_id] -= amount_owed  # This user owes money

                # Update balances for the opposite user who is owed
                if opp_user_id not in balances:
                    balances[opp_user_id] = 0
                balances[opp_user_id] += amount_owed  # The opposite user is owed money

        return balances

    def simplify_debts(balances):
        """Simplify debts by finding who owes what to whom."""
        creditors = []
        debtors = []

        # Split users into creditors (positive balance) and debtors (negative balance)
        for user_id, balance in balances.items():
            if balance > 0:
                creditors.append((user_id, balance))  # Users who are owed money
            elif balance < 0:
                debtors.append((user_id, -balance))  # Users who owe money

        simplified_debts = []
        while creditors and debtors:
            creditor_id, credit_amount = creditors.pop()
            debtor_id, debt_amount = debtors.pop()

            # Calculate the minimum of what the debtor owes and what the creditor is owed
            amount = min(credit_amount, debt_amount)

            # Record this transaction
            simplified_debts.append((debtor_id, creditor_id, amount))

            # Adjust the remaining balances
            credit_amount -= amount
            debt_amount -= amount

            # If there's remaining debt, push the debtor back
            if debt_amount > 0:
                debtors.append((debtor_id, debt_amount))

            # If there's remaining credit, push the creditor back
            if credit_amount > 0:
                creditors.append((creditor_id, credit_amount))

        return simplified_debts

    def display_debts(debts, chat_id, group):
        """Format and display simplified debts in the group."""
        debt_messages = []

        group_members_dict = Group.fetch_group_members_dict(group)

        for debtor_id, creditor_id, amount in debts:
            debtor = group_members_dict[debtor_id]
            creditor = group_members_dict[creditor_id]
            debt_messages.append(f"{debtor.username} owes {creditor.username} {amount:.2f}")

        bot.send_message(chat_id, "\n".join(debt_messages))

    @bot.message_handler(commands=['settle_debt'])
    def settle_debt_start(message):
        chat_id = message.chat.id
        user_id = message.from_user.id
        user = User.fetch_from_db_by_user_id(user_id)

        # Fetch the group by chat ID
        group = Group.fetch_from_db_by_chat(chat_id)

        if group is None:
            bot.send_message(chat_id, "No group associated with this chat.")
            return

        # Ask for the usernames to settle debts with
        msg = bot.send_message(chat_id, "Please enter the usernames to settle debts with in the format:\n\n@username1 @username2 ...")
        
        # Set up a handler to wait for the user's reply
        bot.register_next_step_handler(msg, process_settle_debt_reply, group, user)

    def process_settle_debt_reply(message, group, user):
        chat_id = message.chat.id
        input_text = message.text  # Get the input text from the user's reply

        # Parse the message to extract the usernames
        matches = re.findall(r'@(\w+)', input_text.strip())
        if len(matches) < 1:
            bot.send_message(chat_id, "Invalid format. Use @username1 @username2 ...")
            return

        usernames_dict = User.fetch_usernames_dict(matches)
        # Fetch the users to whom the debts are being settled
        creditors = []
        for username in matches:
            creditor = usernames_dict.get(username)
            if creditor is None:
                bot.send_message(chat_id, f"User @{username} not found.")
                return
            creditors.append(creditor)

        # Fetch all expense splits for the group
        debts = group.fetch_debts_by_group()

        if not debts:
            bot.send_message(chat_id, "There are no recorded debts in this group.")
            return

        # Step 1: Aggregate debts (netted amounts owed between users)
        user_balances = calculate_user_balances(debts)

        # Step 2: Simplify debts (minimize transactions)
        simplified_debts = simplify_debts(user_balances)

        # Step 3: Settle the debts
        for creditor in creditors:
            settle_debt_transaction(simplified_debts, group, chat_id, user.uuid, creditor.uuid)

    def settle_debt_transaction(simplified_debts, group, chat_id, payer_id, payee_id):
        """Settle the debt transaction between users."""
        debtor = User.fetch_from_db_by_uuid(payer_id)
        creditor = User.fetch_from_db_by_uuid(payee_id)
        for debtor_id, creditor_id, debt_amount in simplified_debts:
            if debtor_id == payer_id and creditor_id == payee_id:
                if debt_amount > 0:
                    # Update the debt amount to 0
                    group.update_debt(payer_id, creditor_id, debt_amount)
                    group.update_debt(creditor_id, payer_id, -debt_amount)
                    # Create a new settlement record
                    settlement = Settlement(from_user=debtor, to_user=creditor, amount=debt_amount, group=group)
                    settlement.save_to_db()
                    bot.send_message(chat_id, f"Debt of {debt_amount} from @{debtor.username} to @{creditor.username} settled.")
                    return

        bot.send_message(chat_id, f"No debt found from @{debtor.username} to @{creditor.username}!")

    @bot.message_handler(commands=['show_settlements'])
    def show_settlements(message):
        chat_id = message.chat.id
        user_id = message.from_user.id

        # Fetch the group by chat ID
        group = Group.fetch_from_db_by_chat(chat_id)

        if group is None:
            bot.send_message(chat_id, "No group associated with this chat.")
            return

        # Fetch all settlements for the group
        settlements = Settlement.fetch_settlements_by_group(group)

        if not settlements:
            bot.send_message(chat_id, "There are no settlements recorded in this group.")
            return

        # Format the settlements
        formatted_output = []
        for settlement in settlements:
            from_user = settlement.from_user
            to_user = settlement.to_user
            formatted_output.append(f"{from_user.username} paid {to_user.username} {settlement.amount:.2f} on {settlement.created_at.strftime('%Y-%m-%d')}")

        # Send the formatted list of settlements
        bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')