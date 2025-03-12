# bot/expensehandlers.py
from telebot import types
import requests
from classes import Group, User, Expense, Settlement
import uuid
from collections import defaultdict
from datetime import datetime
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

import re
from classes import User, Group, Expense


def register_expense_handlers(bot):
    """Register all command handlers for the bot."""


    # Step 1: Start the /add_expense process
    @bot.message_handler(commands=['add_expense'])
    def add_expense_start(message):
        try:
            chat_id = message.chat.id
            user_id = message.from_user.id
            # Fetch the user and group from the database
            user = User.fetch_from_db_by_user_id(user_id)
            group = Group.fetch_from_db_by_chat(chat_id)

            if group is None:
                bot.send_message(chat_id, "No group associated with this chat.")
                return
            
            group_members_dict = Group.fetch_group_members_dict(group)

            if not user or not group_members_dict.get(user.uuid):
                bot.reply_to(message, "You are not in the group! Please enter /join_group first.")
                return
            
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

        # Step 2: Ask for the expense details (name, amount, tagged users)
        msg = bot.reply_to(message, "Please reply this in the format:\n\n[expense name]\n[expense amt]\n" +
        "@[username1] [split amt 1(optional)]\n...\n\nE.g. If you paid $25 total, and Jensen owes you $8 and David owes you $7, enter:\nDinner\n25\n@jensen 8\n@david 7")
        
        # Set up a handler to wait for the user's reply
        bot.register_next_step_handler(msg, process_expense_reply, group, user)

    @bot.message_handler(commands=['delete_latest_expense'])
    def delete_latest_expense(message):
        try:
            chat_id = message.chat.id
            group = Group.fetch_from_db_by_chat(chat_id)

            if group is None:
                bot.send_message(chat_id, "No group associated with this chat.")
                return
            
            group.delete_latest_expense()
            bot.send_message(chat_id, "Latest expense deleted successfully!")
            
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    # Step 3: Process the user's reply
    def process_expense_reply(message, group, user):
        try:
            chat_id = message.chat.id
            input_text = message.text  # Get the input text from the user's reply
            # Call the process_add_expense function to handle the input
            process_add_expense(group, user, input_text)
            bot.send_message(chat_id, "Expense added successfully.")
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    @bot.message_handler(commands=['add_expense_on_behalf'])
    def add_expense_on_behalf(message):
        try:
            chat_id = message.chat.id
            group = Group.fetch_from_db_by_chat(chat_id)

            if group is None:
                bot.send_message(chat_id, "No group associated with this chat.")
                return
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")
        
        msg = bot.reply_to(message, "Please reply this in the format:\n\n@[username of expense payer]" +
        "\n[expense name]\n[expense amt]\n@[username1] [split amt 1(optional)]\n...\n\nE.g. If Aayush paid $12 total, and Ben owes him $3 and David owes him $5, enter:\n@aayush\nLunch\n12\n@ben 3\n@david 5")
        bot.register_next_step_handler(msg, process_expense_behalf_reply, group)

    def process_expense_behalf_reply(message, group):
        try:
            chat_id = message.chat.id
            input_text = message.text  # Get the input text from the user's reply

            if not input_text:
                raise Exception("Please send a proper text!")

            lines = input_text.strip().split('\n')

            if len(lines) < 3:
                raise Exception("Please follow the format given!")

            lines = input_text.strip().split('\n')

            first_line = lines[0]
            paid_by_username_match = re.match(r'@(\w+)', first_line.strip())

            if not paid_by_username_match:
                raise Exception("Please follow the given format!")
            
            username = paid_by_username_match.group(1)

            group_members_dict = Group.fetch_group_members_dict(group)
            paid_by_user = User.fetch_from_db_by_username(username)

            if not paid_by_user or not group_members_dict.get(paid_by_user.uuid):
                bot.reply_to(message, "Expense payer tagged is not in the group!")
                return
            
            process_add_expense(group, paid_by_user, '\n'.join(lines[1:]))
            bot.send_message(chat_id, "Expense added successfully on behalf.")

        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    def process_add_expense(group: Group, user: User, input_text: str, group_members_username_dict = None):
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
        if not input_text:
            raise Exception("Please send a proper text!")

        lines = input_text.strip().split('\n')

        if len(lines) < 2:
            raise Exception("Please follow the format given!")

        # Parse the expense name and total amount
        expense_name = lines[0]
        try:
            expense_amount = float(lines[1])
        except ValueError:
            raise ValueError(f"Please key in a valid number for expense amount!")

        if expense_amount <= 0:
            raise ValueError(f"Expense amount must be more than 0!")

        # Ensure the expense amount is within the allowed range
        if expense_amount >= 10**8:
            raise ValueError(f"Expense amount must be less than {10**8}.")

        # Step 2: Parse tagged users and their amounts
        tagged_with_amount = {}
        tagged_without_amount = []
        total_tagged_amount = 0

        if not group_members_username_dict:
            group_members_username_dict = Group.fetch_group_members_usernames_dict(group)

        tagged_users_so_far = []

        for line in lines[2:]:
            match_with_amount = re.match(r'@(\w+)\s+(\d+(\.\d+)?)', line.strip())
            match_without_amount = re.match(r'@(\w+)', line.strip())
            tagged_user = None

            if not match_with_amount and not match_without_amount:
                continue # ignore invalid lines

            if match_with_amount:
                # User with a specific amount
                username = match_with_amount.group(1)
                amount = float(match_with_amount.group(2))
                # Ensure the amount is within the allowed range
                if amount >= 10**8:
                    raise ValueError(f"Tagged amount must be less than {10**8}.")
                tagged_user = group_members_username_dict.get(username)
                if tagged_user:
                    tagged_with_amount[tagged_user] = amount
                    total_tagged_amount += amount
                else:
                    raise ValueError(f"{username} is not a member of this group.")

            elif match_without_amount:
                # User without a specific amount (to split remaining amount)
                username = match_without_amount.group(1)
                tagged_user = group_members_username_dict.get(username)
                if tagged_user:
                    tagged_without_amount.append(tagged_user)
                else:
                    raise ValueError(f"{username} is not a member of this group.")
                
            if tagged_user in tagged_users_so_far:
                raise ValueError(f"Please do not tag the same person more than once!")
            else:
                tagged_users_so_far.append(tagged_user)

        if total_tagged_amount > expense_amount:
            raise ValueError(f"Total tagged amount ${total_tagged_amount:.2f} exceeds the expense amount ${expense_amount:.2f}.")


        # Step 3: Calculate the remaining amount to be split among users with no specific amount
        remaining_amount = expense_amount - total_tagged_amount

        if tagged_without_amount:
            split_amount_per_user = remaining_amount / (len(tagged_without_amount) + 1)
        else:
            split_amount_per_user = 0

        # Ensure the split amount per user is within the allowed range
        if split_amount_per_user >= 10**8:
            raise ValueError(f"Split amount per user must be less than {10**8}.")

        # Step 4: Create the expense entry in the database
        expense = Expense(group=group, paid_by=user, amount=expense_amount, description=expense_name)
        expense.save_to_db()

        debt_updates = []
        splits_to_add = []

        # Step 5: Update expense splits for users tagged with specific amounts
        for tagged_user, amount in tagged_with_amount.items():
            debt_details = {
                "group_id": expense.group.group_id,
                "user_id": tagged_user.uuid,
                "opp_user_id": expense.paid_by.uuid,
                "increment_value": amount
            }

            reverse_debt_details = {
                "group_id": expense.group.group_id,
                "user_id": expense.paid_by.uuid,
                "opp_user_id": tagged_user.uuid,
                "increment_value": -amount
            }

            debt_updates.append(debt_details)
            debt_updates.append(reverse_debt_details)

            split_details = {
                "user_id" : tagged_user.uuid,
                "expense_id": expense.expense_id,
                "amount": amount
            }

            splits_to_add.append(split_details)
            

        # Step 6: Update expense splits for users tagged without specific amounts (split the remaining amount)
        for tagged_user in tagged_without_amount:
            debt_details = {
                "group_id": expense.group.group_id,
                "user_id": tagged_user.uuid,
                "opp_user_id": expense.paid_by.uuid,
                "increment_value": split_amount_per_user
            }

            reverse_debt_details = {
                "group_id": expense.group.group_id,
                "user_id": expense.paid_by.uuid,
                "opp_user_id": tagged_user.uuid,
                "increment_value": -split_amount_per_user
            }

            debt_updates.append(debt_details)
            debt_updates.append(reverse_debt_details)

            split_details = {
                "user_id" : tagged_user.uuid,
                "expense_id": expense.expense_id,
                "amount": split_amount_per_user
            }

            splits_to_add.append(split_details)
            
        if debt_updates:
            Expense.add_debts_bulk(debt_updates)

        if splits_to_add:
            Expense.add_splits_bulk(splits_to_add)

        print("Expense processing complete.")


    @bot.message_handler(commands=['show_expenses'])
    def show_expenses(message):
        try:
            chat_id = message.chat.id

            # Fetch the group by chat ID
            group = Group.fetch_from_db_by_chat(chat_id)

            if group is None:
                bot.send_message(chat_id, "No group associated with this chat.")
                return

            # Fetch expenses for the group (sorted by created_at automatically)

            group_members_dict = Group.fetch_group_members_dict(group)

            expenses = Expense.fetch_expenses_by_group(group, group_members_dict)

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
                    paid_by_username = expense.paid_by.username.replace('_', '\\_')
                    expense_details = f"  • {expense.description}: ${expense.amount:.2f} (Paid by {paid_by_username})"
                    # Fetch splits for this expense
                    splits = expense_splits_dict.get(expense.expense_id)
                    
                    if splits:
                        split_details = ""
                        for split in splits:
                            user = group_members_dict.get(split['user_id'])
                            username = "Unknown User" if not user else user.username.replace('_', '\\_')
                            
                            split_details += f"\n      - {username} owes ${split['amount']}"
                        expense_details += split_details

                    formatted_output.append(expense_details)
            
            # Send the formatted list of expenses
            bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    @bot.message_handler(commands=['show_debts'])
    def show_debts(message):
        try:
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
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

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
            debt_messages.append(f"{debtor.username} owes {creditor.username} ${amount:.2f}")

        bot.send_message(chat_id, "\n".join(debt_messages))

    @bot.message_handler(commands=['settle_debt'])
    def settle_debt_start(message):
        try:
            chat_id = message.chat.id
            user_id = message.from_user.id
            user = User.fetch_from_db_by_user_id(user_id)

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

            # Ask for the usernames to settle debts with
            msg = bot.send_message(chat_id, "Please reply this with the usernames you wish to settle debts with in the format:\n\n@username1 @username2 ...")
            
            # Set up a handler to wait for the user's reply
            bot.register_next_step_handler(msg, process_settle_debt_reply, group, user, debts)
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    def process_settle_debt_reply(message, group, user, debts):
        try:
            chat_id = message.chat.id
            input_text = message.text  # Get the input text from the user's reply

            if not input_text:
                raise Exception("Please send a proper text!")

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
                    bot.send_message(chat_id, f"User {username} not found.")
                    return
                creditors.append(creditor)

            # Step 1: Aggregate debts (netted amounts owed between users)
            user_balances = calculate_user_balances(debts)

            # Step 2: Simplify debts (minimize transactions)
            simplified_debts = simplify_debts(user_balances)

            # Step 3: Settle the debts
            settlements_to_add = []
            for creditor in creditors:
                settle_debt_transaction(simplified_debts, group, chat_id, user, creditor, settlements_to_add)
            
            if settlements_to_add:
                Settlement.add_settlement_bulk(settlements_to_add)

        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    def settle_debt_transaction(simplified_debts, group, chat_id, debtor, creditor, settlements_to_add):
        """Settle the debt transaction between users."""
        payer_id = debtor.uuid
        payee_id = creditor.uuid
        
        for debtor_id, creditor_id, debt_amount in simplified_debts:
            if debtor_id == payer_id and creditor_id == payee_id:
                if debt_amount > 0:
                    # Update the debt amount to 0
                    group.update_debt(payer_id, creditor_id, debt_amount)
                    group.update_debt(creditor_id, payer_id, -debt_amount)
                    # Create a new settlement record
                    settlement = Settlement(from_user=debtor, to_user=creditor, amount=debt_amount, group=group)
                    settlements_to_add.append(settlement)
                    bot.send_message(chat_id, f"Debt of ${debt_amount:.2f} from {debtor.username} to {creditor.username} settled.")
                    return

        bot.send_message(chat_id, f"No debt found from {debtor.username} to {creditor.username}!")

    @bot.message_handler(commands=['show_settlements'])
    def show_settlements(message):
        try:
            chat_id = message.chat.id
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
                from_user_username = settlement.from_user.username.replace('_', '\\_')
                to_user_username = settlement.to_user.username.replace('_', '\\_')
                formatted_output.append(f"{from_user_username} paid {to_user_username} ${settlement.amount:.2f} on {settlement.created_at.strftime('%Y-%m-%d')}")

            # Send the formatted list of settlements
            bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")