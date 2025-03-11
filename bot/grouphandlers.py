# bot/grouphandlers.py
from client import supa
from telebot import types
import requests
from classes import Group, User, Expense, Settlement
import uuid

from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

group_data = {}  # To temporarily store active group data during creation

def register_group_handlers(bot):
    """Register all command handlers for the bot."""

    def send_random_word_command(message):
        # Create an inline keyboard with different category buttons
        markup = InlineKeyboardMarkup()
        markup.add(InlineKeyboardButton("Animal", callback_data='category_animal'))
        markup.add(InlineKeyboardButton("Place", callback_data='category_place'))
        markup.add(InlineKeyboardButton("Object", callback_data='category_object'))
        markup.add(InlineKeyboardButton("Verb", callback_data='category_verb'))
        markup.add(InlineKeyboardButton("Person", callback_data='category_person'))
        markup.add(InlineKeyboardButton("Hard", callback_data='category_hard'))

        # Send a message with the inline keyboard
        bot.send_message(message.chat.id, "Please choose a category for your random word:", reply_markup=markup)

    # Handler for the inline button callback queries
    @bot.callback_query_handler(func=lambda call: call.data.startswith('category_'))
    def handle_category_selection(call):
        # Extract the category from the callback data
        category = call.data.split('_')[1]  # Gets 'animal', 'place', etc.
        api_url = f"https://pictionary-word-generator-api.onrender.com/words/{category}/random"
        
        try:
            # Make a request to the Pictionary API with the selected category
            response = requests.get(api_url)

            # Check if the request was successful
            if response.status_code == 200:
                # Retrieve the random word from the response
                random_word = response.json().get("words", ["No word found"])[0]
                bot.send_message(call.message.chat.id, f"Your random word from the '{category}' category is: {random_word}")
            else:
                bot.send_message(call.message.chat.id, "Failed to fetch a random word. Please try again later.")
        except Exception as e:
            bot.send_message(call.message.chat.id, f"An error occurred: {e}")

        # Answer the callback query to remove the "loading" state
        bot.answer_callback_query(call.id, "Category selected!")

    
    def is_valid_string(message):
        """Check if the message contains valid string input and not media or other content."""
        if message.content_type != 'text':
            # If the message content is not text, return False
            return False
        elif not message.text.strip():
            # If the text is empty or only whitespace, return False
            return False
        else:
            # If it is valid text, return True
            return True
 
    @bot.message_handler(commands=['start'])
    def send_welcome(message):
        welcome_message = (
        "🌴 Welcome to CoconutSplit! 🌴\n\n"
        "CoconutSplit helps you easily split expenses with your friends and track debts within a group. Please enter /help for the list of available commands!"
        )
        bot.reply_to(message, welcome_message)

    @bot.message_handler(commands=['help'])
    def send_help(message):
        help_message = (
        "📚 *General Commands:*\n"
        "/start - Start the bot\n"
        "/help - View the list of all available commands\n\n"

        "👥 *Group Management Commands:*\n"
        "/create_group - Create a new group\n"
        "/delete_group - Delete the existing group\n"
        "/join_group - Join the existing group\n"
        "/view_users - View all users in the group\n\n"

        "💸 *Expense Management Commands:*\n"
        "/add_expense - Add an expense paid by you\n"
        "/show_expenses - View all expenses in the group\n"
        "/upload_receipt - Upload a receipt to automatically extract and tag expenses\n\n"

        "🤝 *Debt Management Commands:*\n"
        "/show_debts - View all debts and see who owes whom\n"
        "/settle_debt - Settle a debt you owe\n"
        "/show_settlements - View all debts that's been settled in the group\n\n"

        "If you have any questions or get stuck, use /help to view this message again!\n"
        "Happy splitting! 😊"
        )
        bot.reply_to(message, help_message)

    @bot.message_handler(commands=['create_group'])
    def ask_group_name(message):
        """Step 1: Ask the user for the group name."""
        chat_id = message.chat.id
        
        # Check if a group already exists for this chat
        existing_group = Group.fetch_from_db_by_chat(chat_id)
        
        if existing_group:
            bot.reply_to(message, f"A group already exists in this chat: '{existing_group.group_name}'. Please delete the current group before creating a new one.")
        else:
            # Proceed with group creation if no group exists
            msg = bot.reply_to(message, "Please reply this with the name of the group:")
            bot.register_next_step_handler(msg, process_group_name)

    def process_group_name(message):
        """Step 2: Process the group name and create a Group with UUID."""
        if not is_valid_string(message):
            bot.reply_to(message, "Invalid input. Please send /create_group command again and enter a valid group name.")
            return
        group_name = message.text
        group_id = str(uuid.uuid4())  # Generate a UUID for the group

        # Fetch user from the database using Telegram user_id (int), create new if necessary
        user = User.fetch_from_db_by_user_id(message.from_user.id)
        if not user:
            user = User(user_id=message.from_user.id, username=message.from_user.username)
            user.save_to_db()  # Save the user to the database if not already saved

        # Create the Group instance
        group = Group(group_id=group_id, group_name=group_name, created_by=user, chat_id=message.chat.id)
        group.save_to_db()  # Save the group to the database

        # Store group in temporary data
        group_data[message.chat.id] = group

        # Create an inline button for joining the group
        join_button = types.InlineKeyboardMarkup()
        join_button.add(types.InlineKeyboardButton(text="Join Group", callback_data=f"join_{group_id}"))

        bot.send_message(message.chat.id, f"Group '{group_name}' has been created! Click below to join the group.", reply_markup=join_button)

    @bot.message_handler(commands=['view_users'])
    def view_users(message):
        """List all users in the group associated with the current chat."""
        chat_id = message.chat.id
        
        # Fetch the group associated with the chat
        group = Group.fetch_from_db_by_chat(chat_id)

        if group:
            # Fetch all members of the group from the database
            members = group.fetch_all_members()

            if members:
                # Create a list of member usernames or display names
                member_list = "\n".join([f"- {member.username}" for member in members])
                bot.reply_to(message, f"Members in '{group.group_name}':\n{member_list}")
            else:
                bot.reply_to(message, f"No members found in '{group.group_name}'.")
        else:
            bot.reply_to(message, "No group exists in this chat.")
    
    @bot.message_handler(commands=['join_group'])
    def join_group(message):
        chat_id = message.chat.id
        user = User.fetch_from_db_by_user_id(message.from_user.id)

        if not user:
            user = User(user_id=message.from_user.id, username=message.from_user.username)
            user.save_to_db()  # Save the user to the database if not already present

        group = Group.fetch_from_db_by_chat(chat_id)

        # Add the user to the group in the database
        if group:
            if not group.check_user_in_group(user): 
                group.add_member(user)
                bot.send_message(message.chat.id, f"{user.username} has joined '{group.group_name}'!")
            else:
                bot.send_message(message.chat.id, f"{user.username} is already in '{group.group_name}'!")

        else:
            bot.send_message(message.chat.id, "No group associated with this chat.")


    @bot.callback_query_handler(func=lambda call: call.data.startswith('join_'))
    def handle_join_group(call):
        """Handle users clicking the 'Join Group' button."""
        chat_id = call.message.chat.id  # Get the chat_id from the message
        user = User.fetch_from_db_by_user_id(call.from_user.id)

        if not user:
            user = User(user_id=call.from_user.id, username=call.from_user.username)
            user.save_to_db()  # Save the user to the database if not already present

        group = Group.fetch_from_db_by_chat(chat_id)

        # Add the user to the group in the database
        if group:
            if not group.check_user_in_group(user): 
                group.add_member(user)
                bot.answer_callback_query(call.id, f"You have joined '{group.group_name}'!")
                bot.send_message(call.message.chat.id, f"{user.username} has joined '{group.group_name}'!")
            else:
                bot.answer_callback_query(call.id, f"You are already in {group.group_name}!")
                bot.send_message(call.message.chat.id, f"{user.username} is already in '{group.group_name}'!")

        else:
            bot.answer_callback_query(call.id, "Group not found.")

    # @bot.message_handler(commands=['leave_group'])
    # def handle_leave_group(message):
    #     """Allow a user to leave the group associated with the current chat."""
    #     chat_id = message.chat.id
    #     user = User.fetch_from_db_by_user_id(message.from_user.id)

    #     # Fetch the group associated with the chat
    #     group = Group.fetch_from_db_by_chat(chat_id)
    #     # Check if the user exists in the database
        
    #     if not user:
    #         bot.reply_to(message, f'You are not a member of {group.group_name}')
    #         return

    #     if group:
    #         # Check if the user is in the group
    #         if group.check_user_in_group(user):
    #             # Remove the user from the group
    #             group.remove_member(user)
    #             bot.reply_to(message, f"{user.username} has left {group.group_name}.")
    #         else:
    #             bot.reply_to(message, f'You are not a member of {group.group_name}')
    #     else:
    #         bot.reply_to(message, "No group exists in this chat to leave.")


    @bot.message_handler(commands=['delete_group'])
    def delete_group(message):
        msg = bot.reply_to(message, 'Deleting this group will cause you to lose all recorded expenses!\nPlease reply this with "coconut" to confirm.')
        bot.register_next_step_handler(msg, process_delete_group, message)
        

    def process_delete_group(message):
        """Delete the group associated with the current chat."""

        if not message.text.lower() == "coconut":
            bot.send_message(message.chat.id, "Group was not deleted.")
            return

        chat_id = message.chat.id

        # Fetch the group associated with the chat
        group = Group.fetch_from_db_by_chat(chat_id)

        if group:
            # Delete the group from the database
            group.delete_from_db()
            bot.reply_to(message, f"The group '{group.group_name}' has been deleted.")
        else:
            bot.reply_to(message, "No group exists in this chat to delete.")

        
