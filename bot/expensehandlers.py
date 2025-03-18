# bot/expensehandlers.py
from classes import Group, User, Expense, Settlement
from collections import defaultdict
from utils import simplify_debts, calculate_user_balances, process_add_expense, get_display_debts_string, get_display_debts_string_with_at

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
        "@[username1] [split amt 1(optional)]\n...\n\n" +
        "E.g. if you paid $25 total, and Jensen owes you $8 and David owes you $7, enter the following:\n\nDinner\n25\n@jensen 8\n@david 7")
        
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
        "\n[expense name]\n[expense amt]\n@[username1] [split amt 1(optional)]\n...\n\n" +
        "E.g. if Aayush paid $12 total, and Ben owes him $3 and David owes him $5, enter the following:\n\n@aayush\nLunch\n12\n@ben 3\n@david 5")
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
                date_str = expense.created_at.strftime('%d %B %Y')  # Group by 'YYYY-MM-DD'
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
                    expense_details = f"{expense.description}: ${expense.amount:.2f} (Paid by {paid_by_username})"
                    # Fetch splits for this expense
                    splits = expense_splits_dict.get(expense.expense_id)
                    
                    if splits:
                        split_details = ""
                        for split in splits:
                            user = group_members_dict.get(split['user_id'])
                            username = "Unknown User" if not user else user.username.replace('_', '\\_')
                            
                            split_details += f"\n  • {username} owes ${split['amount']:.2f}"
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
                display_debts_string = get_display_debts_string(simplified_debts, group)
                bot.send_message(chat_id, display_debts_string)
            else:
                bot.send_message(chat_id, "All debts have been settled!")
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

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
            settlements_by_date = defaultdict(list)
            for settlement in settlements:
                date_str = settlement.created_at.strftime('%d %B %Y')
                settlements_by_date[date_str].append(settlement)

            # Sort the dates (earliest first)
            sorted_dates = sorted(settlements_by_date.keys())

            # Format the settlements for each date
            formatted_output = []
            for date in sorted_dates:
                formatted_output  # Display the date as a section header
                string=""
                string += f"📅 *{date}*"
                for settlement in settlements_by_date[date]:
                    from_user_username = settlement.from_user.username.replace('_', '\\_')
                    to_user_username = settlement.to_user.username.replace('_', '\\_')
                    string += f"\n  • {from_user_username} paid ${settlement.amount:.2f} to {to_user_username}"
                formatted_output.append(string)

            # Send the formatted list of settlements
            bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    @bot.message_handler(commands=['delete_latest_settlement'])
    def delete_latest_settlements(message):
        try:
            chat_id = message.chat.id
            group = Group.fetch_from_db_by_chat(chat_id)

            if group is None:
                bot.send_message(chat_id, "No group associated with this chat.")
                return
            
            group.delete_latest_settlement()
            bot.send_message(chat_id, "Latest settlement deleted successfully!")
            
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

def process_reminders():
    groups = Group.get_groups_with_reminders_on()

    chat_id_to_display_debts_string = {}

    if groups:
        for group in groups:
            debts = group.fetch_debts_by_group()
            if debts:
                user_balances = calculate_user_balances(debts)
                simplified_debts = simplify_debts(user_balances)
                chat_id = group.chat_id
                if simplified_debts:
                    display_debts_string = get_display_debts_string_with_at(simplified_debts, group)
                    chat_id_to_display_debts_string[chat_id] = display_debts_string
    
    return chat_id_to_display_debts_string