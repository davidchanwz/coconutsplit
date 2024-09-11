# bot/handlers.py
from client import supa
from telebot import types
from bot.classes import Group, User, Expense, Settlement
import uuid

group_data = {}  # To temporarily store active group data during creation

def register_handlers(bot):
    """Register all command handlers for the bot."""
 
    @bot.message_handler(commands=['start'])
    def send_welcome(message):
        welcome_message = (
            "Welcome to CoconutSplit! 🌴\n"
            "Here are the available commands:\n"
            "/create_group - Create a new group\n"
            "/add_expense - Add a new expense\n"
            "/view_balance - View your balance\n"
            "/settle_debt - Settle debts\n"
            "/help - Show this help message"
        )
        bot.reply_to(message, welcome_message)

    @bot.message_handler(commands=['create_group'])
    def ask_group_name(message):
        """Step 1: Ask the user for the group name."""
        msg = bot.reply_to(message, "Please enter the name of the group:")
        bot.register_next_step_handler(msg, process_group_name)

    def process_group_name(message):
        """Step 2: Process the group name and create a Group with UUID."""
        group_name = message.text
        group_id = str(uuid.uuid4())  # Generate a UUID for the group

        # Create a User instance for the creator
        user = User.fetch_from_db(message.from_user.id)
        if not user:
            user = User(user_id=message.from_user.id, username=message.from_user.username)
            user.save_to_db()  # Save the user to the database if not already saved

        # Create the Group instance
        group = Group(group_id=group_id, group_name=group_name, created_by=user)
        group.save_to_db()  # Save the group to the database

        # Store group in temporary data
        group_data[message.chat.id] = group

        # Create an inline button for joining the group
        join_button = types.InlineKeyboardMarkup()
        join_button.add(types.InlineKeyboardButton(text="Join Group", callback_data=f"join_{group_id}"))

        bot.send_message(message.chat.id, f"Group '{group_name}' has been created! Click below to join the group.", reply_markup=join_button)

    @bot.callback_query_handler(func=lambda call: call.data.startswith('join_'))
    def handle_join_group(call):
        """Handle users clicking the 'Join Group' button."""
        group_id = call.data.split('_')[1]
        user = User.fetch_from_db(call.from_user.id)

        if not user:
            user = User(user_id=call.from_user.id, username=call.from_user.username)
            user.save_to_db()  # Save the user to the database if not already present

        group = Group.fetch_from_db(group_id)

        # Add the user to the group in the database
        if group:
            group.add_member(user)
            bot.answer_callback_query(call.id, f"You have joined the group '{group.group_name}'!")
            bot.send_message(call.message.chat.id, f"{user.username} has joined the group '{group.group_name}'!")
        else:
            bot.answer_callback_query(call.id, "Group not found.")

        
