# bot/expensehandlers.py
from classes import Group, User, Expense, Settlement, GroupPurgatory
from collections import defaultdict
from utils import simplify_debts, calculate_user_balances, process_add_expense, get_display_debts_string, get_display_debts_string_with_at, is_group_chat
from typing import Dict
import uuid  

import re
import json
from classes import User, Group, Expense
from telebot.types import (
    ReplyKeyboardMarkup, 
    KeyboardButton, 
    WebAppInfo,
    InlineKeyboardMarkup,
    InlineKeyboardButton
)
import dotenv
import os

dotenv.load_dotenv()
MINIAPP_UNIQUE_IDENTIFIER = os.getenv("MINIAPP_UNIQUE_IDENTIFIER")

# Temporary storage for message IDs
# split_message_storage: Dict[int, int] = {}  # chat_id -> message_id

def register_expense_handlers(bot):
    """Register all command handlers for the bot."""

    @bot.message_handler(commands=['split'])
    def launch_coconut_split_app(message):
        try:
            # Check if this is a private chat
            if not is_group_chat(message):
                bot.reply_to(message, "This command can only be used in group chats.")
                return
                
            chat_id = message.chat.id
            user_id = message.from_user.id
            # Fetch the user and group from the database
            user = User.fetch_from_db_by_user_id(user_id)
            group = Group.fetch_from_db_by_chat(chat_id)

            # Create Mini App URL with chat_id if no group exists, otherwise use group_id
            uuid_param = group.group_id if group else str(uuid.uuid4())
            start_param = f"{uuid_param}_{chat_id}"  # Combine UUID and chat_id
            mini_app_url = f"https://t.me/{bot.get_me().username}/CoconutSplit?startapp={start_param}"
            
            keyboard = InlineKeyboardMarkup()
            web_app_button = InlineKeyboardButton(
                text="Open CoconutSplit",
                url=mini_app_url
            )
            keyboard.add(web_app_button)
            
            sent_message = bot.send_message(
                chat_id,
                "Click the button below to open Coconut Split:",
                reply_markup=keyboard
            )
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

            
    # Handler for web_app_data from Mini Apps
    @bot.message_handler(content_types=['web_app_data'])
    def handle_web_app_data(message):
        try:
            
            chat_id = message.chat.id
            user_id = message.from_user.id
            
            # Get web_app_data from the message
            web_app_data = message.web_app_data.data
            
            # Parse the JSON data
            data = json.loads(web_app_data)
            
            # Get the action type
            action = data.get('action')
            
            if action == 'add_expense':
                # Handle add_expense data
                handle_add_expense_data(message, data)
            elif action == 'settle_up':
                # Handle settle_up data
                handle_settle_up_data(message, data)
            else:
                bot.send_message(chat_id, "Unknown action received from the mini app.")
                
        except Exception as e:
            bot.send_message(chat_id, f"Error processing web app data: {e}")
            
    def handle_add_expense_data(message, data):
        """Process web_app_data for add_expense action"""
        try:
            chat_id = message.chat.id
            description = data.get('description')
            amount = data.get('amount')
            payer = data.get('payer')
            splits = data.get('splits', [])
            
            # Format the splits for display
            splits_text = ""
            for split in splits:
                username = split.get('username')
                split_amount = split.get('amount')
                splits_text += f"\n- @{username}: ${split_amount}"
            
            # Send a message to the group with the expense details
            notification_text = (
                f"💰 *New Expense Added*\n"
                f"*Description:* {description}\n"
                f"*Amount:* ${amount}\n"
                f"*Paid by:* @{payer}\n"
                f"*Split with:*{splits_text}"
            )
            
            bot.send_message(chat_id, notification_text, parse_mode='Markdown')
            
        except Exception as e:
            bot.send_message(chat_id, f"Error processing expense data: {e}")
            
    def handle_settle_up_data(message, data):
        """Process web_app_data for settle_up action"""
        try:
            chat_id = message.chat.id
            settlements = data.get('settlements', [])
            
            if not settlements:
                bot.send_message(chat_id, "No settlements were made.")
                return
            
            # Format the settlement details for display
            settlements_text = ""
            for settlement in settlements:
                from_user = settlement.get('from')
                to_user = settlement.get('to')
                amount = settlement.get('amount')
                settlements_text += f"\n- @{from_user} → @{to_user}: ${amount}"
            
            # Send a message to the group with the settlement details
            notification_text = (
                f"✅ *Settlements Completed*\n"
                f"The following debts have been settled:{settlements_text}"
            )
            
            bot.send_message(chat_id, notification_text, parse_mode='Markdown')
            
        except Exception as e:
            bot.send_message(chat_id, f"Error processing settlement data: {e}")
    
    # def process_username_selection(message, group):
    #     try:
    #         chat_id = message.chat.id
    #         input_text = message.text.strip()
            
    #         # Parse the username from the input
    #         username_match = re.match(r'@(\w+)', input_text)
    #         if not username_match:
    #             bot.send_message(chat_id, "Invalid format. Please use @username")
    #             return
            
    #         username = username_match.group(1)
            
    #         # Get the user by username
    #         paid_by_user = User.fetch_from_db_by_username(username)
            
    #         if not paid_by_user:
    #             bot.send_message(chat_id, f"User @{username} not found.")
    #             return
            
    #         # Get group members and check if the user is in the group
    #         group_members_dict = Group.fetch_group_members_dict(group)
    #         if not group_members_dict.get(paid_by_user.uuid):
    #             bot.send_message(chat_id, f"User @{username} is not in the group! They must join the group first.")
    #             return
            
    #         # Create Mini App URL with only group_id parameter
    #         mini_app_url = f"https://t.me/{bot.get_me().username}/add_expense?startapp={group.group_id}"
            
    #         # Create inline keyboard with Mini App button
    #         keyboard = InlineKeyboardMarkup()
    #         web_app_button = InlineKeyboardButton(
    #             text=f"Add Expense for @{username}",
    #             url=mini_app_url
    #         )
    #         keyboard.add(web_app_button)
            
    #         # Send message with Mini App button
    #         bot.send_message(
    #             chat_id,
    #             f"Click the button below to add an expense on behalf of @{username}:",
    #             reply_markup=keyboard
    #         )
            
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")
            
     # Step 1: Start the /add_expense process
    # @bot.message_handler(commands=['add_expense'])
    # def add_expense_start(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         user_id = message.from_user.id
    #         # Fetch the user and group from the database
    #         user = User.fetch_from_db_by_user_id(user_id)
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return
            
    #         group_members_dict = Group.fetch_group_members_dict(group)

    #         if not user or not group_members_dict.get(user.uuid):
    #             bot.reply_to(message, "You are not in the group! Please enter /join_group first.")
    #             return
            
    #         # Create Mini App URL with only group_id parameter
    #         mini_app_url = f"https://t.me/{bot.get_me().username}/add_expense?startapp={group.group_id}"
            
    #         # Create inline keyboard with Mini App button
    #         keyboard = InlineKeyboardMarkup()
    #         web_app_button = InlineKeyboardButton(
    #             text="Add Expense",
    #             url=mini_app_url
    #         )
    #         keyboard.add(web_app_button)
            
    #         # Send message with Mini App button
    #         bot.send_message(
    #             chat_id,
    #             "Click the button below to add an expense:",
    #             reply_markup=keyboard
    #         )
            
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # @bot.message_handler(commands=['delete_latest_expense'])
    # def delete_latest_expense(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return
            
    #         group.delete_latest_expense()
    #         bot.send_message(chat_id, "Latest expense deleted successfully!")
            
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # Step 3: Process the user's reply
    # def process_expense_reply(message, group, user):
    #     try:
    #         chat_id = message.chat.id
    #         input_text = message.text  # Get the input text from the user's reply
    #         # Call the process_add_expense function to handle the input
    #         process_add_expense(group, user, input_text)
    #         bot.send_message(chat_id, "Expense added successfully.")
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # @bot.message_handler(commands=['add_expense_on_behalf'])
    # def add_expense_on_behalf(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return
            
    #         # Ask user to specify a username
    #         msg = bot.reply_to(message, "Please reply with the username of the person who paid the expense (format: @username)")
    #         bot.register_next_step_handler(msg, process_username_selection, group)
            
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # def process_expense_behalf_reply(message, group):
    #     try:
    #         chat_id = message.chat.id
    #         input_text = message.text  # Get the input text from the user's reply

    #         if not input_text:
    #             raise Exception("Please send a proper text!")

    #         lines = input_text.strip().split('\n')

    #         if len(lines) < 3:
    #             raise Exception("Please follow the format given!")

    #         first_line = lines[0]
    #         paid_by_username_match = re.match(r'@(\w+)', first_line.strip())

    #         if not paid_by_username_match:
    #             raise Exception("Please follow the given format!")
            
    #         username = paid_by_username_match.group(1)

    #         paid_by_user = User.fetch_from_db_by_username(username)
    #         if not paid_by_user:
    #             raise Exception(f"User @{username} not found.")
                
    #         group_members_dict = Group.fetch_group_members_dict(group)
    #         if not group_members_dict.get(paid_by_user.uuid):
    #             raise Exception(f"User @{username} is not in the group! They must join the group first.")
            
    #         process_add_expense(group, paid_by_user, '\n'.join(lines[1:]))
    #         bot.send_message(chat_id, f"Expense added successfully on behalf of @{username}.")

    #     except Exception as e:
    #         bot.send_message(chat_id, f"Error: {e}")

    # @bot.message_handler(commands=['show_expenses'])
    # def show_expenses(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id

    #         # Fetch the group by chat ID
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return

    #         # Fetch expenses for the group (sorted by created_at automatically)

    #         group_members_dict = Group.fetch_group_members_dict(group)

    #         expenses = Expense.fetch_expenses_by_group(group, group_members_dict)

    #         expense_splits_dict = Expense.fetch_expense_splits_dict(expenses)

    #         if not expenses:
    #             bot.send_message(chat_id, "There are no expenses recorded in this group.")
    #             return

    #         # Group expenses by date
    #         expenses_by_date = defaultdict(list)
    #         for expense in expenses:
    #             date_str = expense.created_at.strftime('%d %B %Y')  # Group by 'YYYY-MM-DD'
    #             expenses_by_date[date_str].append(expense)

    #         # Sort the dates (earliest first)
    #         sorted_dates = sorted(expenses_by_date.keys())

    #         # Format the expenses for each date
    #         formatted_output = []
    #         for date in sorted_dates:
    #             formatted_output.append(f"📅 *{date}*")  # Display the date as a section header
    #             for expense in expenses_by_date[date]:
    #                 # Add main expense details
    #                 paid_by_username = expense.paid_by.username.replace('_', '\\_')
    #                 expense_details = f"{expense.description}: ${expense.amount:.2f} (Paid by {paid_by_username})"
    #                 # Fetch splits for this expense
    #                 splits = expense_splits_dict.get(expense.expense_id)
                    
    #                 if splits:
    #                     split_details = ""
    #                     for split in splits:
    #                         user = group_members_dict.get(split['user_id'])
    #                         username = "Unknown User" if not user else user.username.replace('_', '\\_')
                            
    #                         split_details += f"\n  • {username} owes ${split['amount']:.2f}"
    #                     expense_details += split_details

    #                 formatted_output.append(expense_details)
            
    #         # Send the formatted list of expenses
    #         bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')
        
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # @bot.message_handler(commands=['show_debts'])
    # def show_debts(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         # Fetch the group by chat ID
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return

    #         # Fetch all debts for the group
    #         debts = group.fetch_debts_by_group()

    #         if not debts:
    #             bot.send_message(chat_id, "There are no recorded debts in this group.")
    #             return

    #         # Step 1: Aggregate debts (netted amounts owed between users)
    #         user_balances = calculate_user_balances(debts)

    #         # Step 2: Simplify debts (minimize transactions)
    #         simplified_debts = simplify_debts(user_balances)

    #         # Step 3: Display the results
    #         if simplified_debts:
    #             display_debts_string = get_display_debts_string(simplified_debts, group)
    #             bot.send_message(chat_id, display_debts_string)
    #         else:
    #             bot.send_message(chat_id, "All debts have been settled!")
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # @bot.message_handler(commands=['settle_debt'])
    # def settle_debt_start(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         user_id = message.from_user.id
    #         user = User.fetch_from_db_by_user_id(user_id)

    #         # Fetch the group by chat ID
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return
            
    #         # Fetch all debts for the group
    #         debts = group.fetch_debts_by_group()

    #         if not debts:
    #             bot.send_message(chat_id, "There are no recorded debts in this group.")
    #             return

    #         # Ask for the usernames to settle debts with
    #         msg = bot.send_message(chat_id, "Please reply this with the usernames you wish to settle debts with in the format:\n\n@username1 @username2 ...")
            
    #         # Set up a handler to wait for the user's reply
    #         bot.register_next_step_handler(msg, process_settle_debt_reply, group, user, debts)
        
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # def process_settle_debt_reply(message, group, user, debts):
    #     try:
    #         chat_id = message.chat.id
    #         input_text = message.text  # Get the input text from the user's reply

    #         if not input_text:
    #             raise Exception("Please send a proper text!")

    #         # Parse the message to extract the usernames
    #         matches = re.findall(r'@(\w+)', input_text.strip())
    #         if len(matches) < 1:
    #             bot.send_message(chat_id, "Invalid format. Use @username1 @username2 ...")
    #             return

    #         usernames_dict = User.fetch_usernames_dict(matches)
    #         # Fetch the users to whom the debts are being settled
    #         creditors = []
    #         for username in matches:
    #             creditor = usernames_dict.get(username)
    #             if creditor is None:
    #                 bot.send_message(chat_id, f"User {username} not found.")
    #                 return
    #             creditors.append(creditor)

    #         # Step 1: Aggregate debts (netted amounts owed between users)
    #         user_balances = calculate_user_balances(debts)

    #         # Step 2: Simplify debts (minimize transactions)
    #         simplified_debts = simplify_debts(user_balances)

    #         # Step 3: Settle the debts
    #         settlements_to_add = []
    #         for creditor in creditors:
    #             settle_debt_transaction(simplified_debts, group, chat_id, user, creditor, settlements_to_add)
            
    #         if settlements_to_add:
    #             Settlement.add_settlement_bulk(settlements_to_add)

    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # def settle_debt_transaction(simplified_debts, group, chat_id, debtor, creditor, settlements_to_add):
    #     """Settle the debt transaction between users."""
    #     payer_id = debtor.uuid
    #     payee_id = creditor.uuid
        
    #     for debtor_id, creditor_id, debt_amount in simplified_debts:
    #         if debtor_id == payer_id and creditor_id == payee_id:
    #             if debt_amount > 0:
    #                 # Update the debt amount to 0
    #                 group.update_debt(payer_id, creditor_id, debt_amount)
    #                 group.update_debt(creditor_id, payer_id, -debt_amount)
    #                 # Create a new settlement record
    #                 settlement = Settlement(from_user=debtor, to_user=creditor, amount=debt_amount, group=group)
    #                 settlements_to_add.append(settlement)
    #                 bot.send_message(chat_id, f"Debt of ${debt_amount:.2f} from {debtor.username} to {creditor.username} settled.")
    #                 return

    #     bot.send_message(chat_id, f"No debt found from {debtor.username} to {creditor.username}!")

    # @bot.message_handler(commands=['show_settlements'])
    # def show_settlements(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         # Fetch the group by chat ID
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return

    #         # Fetch all settlements for the group
    #         settlements = Settlement.fetch_settlements_by_group(group)

    #         if not settlements:
    #             bot.send_message(chat_id, "There are no settlements recorded in this group.")
    #             return

    #         # Format the settlements
    #         settlements_by_date = defaultdict(list)
    #         for settlement in settlements:
    #             date_str = settlement.created_at.strftime('%d %B %Y')
    #             settlements_by_date[date_str].append(settlement)

    #         # Sort the dates (earliest first)
    #         sorted_dates = sorted(settlements_by_date.keys())

    #         # Format the settlements for each date
    #         formatted_output = []
    #         for date in sorted_dates:
    #             formatted_output  # Display the date as a section header
    #             string=""
    #             string += f"📅 *{date}*"
    #             for settlement in settlements_by_date[date]:
    #                 from_user_username = settlement.from_user.username.replace('_', '\\_')
    #                 to_user_username = settlement.to_user.username.replace('_', '\\_')
    #                 string += f"\n  • {from_user_username} paid ${settlement.amount:.2f} to {to_user_username}"
    #             formatted_output.append(string)

    #         # Send the formatted list of settlements
    #         bot.send_message(chat_id, "\n".join(formatted_output), parse_mode='Markdown')
        
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

    # @bot.message_handler(commands=['delete_latest_settlement'])
    # def delete_latest_settlements(message):
    #     try:
    #         # Check if this is a private chat
    #         if not is_group_chat(message):
    #             bot.reply_to(message, "This command can only be used in group chats.")
    #             return
                
    #         chat_id = message.chat.id
    #         group = Group.fetch_from_db_by_chat(chat_id)

    #         if group is None:
    #             bot.send_message(chat_id, "No group associated with this chat. Please use /create_group to create a new group.")
    #             return
            
    #         group.delete_latest_settlement()
    #         bot.send_message(chat_id, "Latest settlement deleted successfully!")
            
    #     except Exception as e:
    #         bot.send_message(chat_id, f"{e}")

