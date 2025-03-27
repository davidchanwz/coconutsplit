# bot/grouphandlers.py
from client import supa
from telebot import types
import requests
from classes import Group, User, Expense, Settlement
import uuid
import logging

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
        # "/start - Start the bot\n"
        "/split - Main command to run after setting up the group\n"
        "/help - View the list of all available commands\n\n"

        "👥 *Group Management Commands:*\n"
        "/create_group - Create a new group\n"
        "/delete_group - Delete the existing group\n"
        "/join_group - Join the existing group\n"
        "/toggle_reminders - Receive daily reminders for debt payments\n"
        # "/view_users - View all users in the group\n\n"

        # "💸 *Expense Management Commands:*\n"
        # "/add_expense - Add an expense paid by you\n"
        # "/show_expenses - View all expenses in the group\n"
        # "/upload_receipt - Upload a receipt to automatically extract and tag expenses\n\n"

        # "🤝 *Debt Management Commands:*\n"
        # "/show_debts - View all debts and see who owes whom\n"
        # "/settle_debt - Settle a debt you owe\n"
        # "/show_settlements - View all debts that's been settled in the group\n\n"

        "If you have any questions or get stuck, use /help to view this message again!\n"
        "Happy splitting! 😊"
        )
        bot.reply_to(message, help_message)

    @bot.message_handler(commands=['create_group'])
    def ask_group_name(message):
        try:
            """Step 1: Ask the user for the group name."""
            chat_id = message.chat.id
            
            # Check if a group already exists for this chat
            existing_group = Group.fetch_from_db_by_chat(chat_id)
            
            if existing_group:
                bot.reply_to(message, f"A group already exists in this chat: '{existing_group.group_name}'. Please delete the current group before creating a new one.")
            else:
                # Check if the user provided a group name directly with the command
                # Get the text after "/create_group" command
                command_text = message.text.split()
                
                # If there's text after the command, use it as group name
                if len(command_text) > 1:
                    # Join all text after the command to form the group name
                    group_name = ' '.join(command_text[1:])
                    print(command_text)
                    # Create a message-like object with the group name for compatibility with process_group_name
                    message.text = group_name
                    process_group_name(message)
                else:
                    # If no group name was provided, ask for it
                    msg = bot.reply_to(message, "Please reply this with the name of the group:")
                    bot.register_next_step_handler(msg, process_group_name)

        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    def process_group_name(message):
        try:
            if not is_valid_string(message):
                bot.reply_to(message, f"Invalid input. Please send /create_group@{bot.get_me().username} command again and enter a valid group name.")
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

            # Send message and store its ID
            sent_message = bot.send_message(message.chat.id, f"Group '{group_name}' has been created! Click below to join the group.", reply_markup=join_button)
            
            # Store the message ID in the group data and save to database
            group.message_id = sent_message.message_id
            group.save_to_db()  # Save the updated group with message ID

        except Exception as e:
            bot.send_message(message.chat.id, f"{e}")

    @bot.message_handler(commands=['view_users'])
    def view_users(message):
        try:
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
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")
    
    @bot.message_handler(commands=['join_group'])
    def join_group(message):
        try:
            chat_id = message.chat.id
            
            # Fetch the group associated with the chat
            group = Group.fetch_from_db_by_chat(chat_id)

            if group:
                # Create an inline button for joining the group
                join_button = types.InlineKeyboardMarkup()
                join_button.add(types.InlineKeyboardButton(text="Join Group", callback_data=f"join_{group.group_id}"))
                
                # Get current members to display
                members = group.fetch_all_members()
                member_list = "\n".join([f"- {member.username}" for member in members]) if members else "No members yet"
                
                # Send message with join button
                sent_message = bot.send_message(message.chat.id, 
                                f"Group: '{group.group_name}'\n\nMembers:\n{member_list}\n\nClick below to join this group:", 
                                reply_markup=join_button)
                
                # Store the message ID in the group data and save to database
                group.message_id = sent_message.message_id
                group.save_to_db()  # Save the updated group with message ID
            else:
                bot.send_message(message.chat.id, "No group associated with this chat. Use /create_group to create one first.")
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    @bot.callback_query_handler(func=lambda call: call.data.startswith('join_'))
    def handle_join_group(call):
        try:
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
                    
                    # Update the original message with the new member
                    members = group.fetch_all_members()
                    member_list = "\n".join([f"- {member.username}" for member in members])
                    updated_text = f"Group '{group.group_name}' has been created!\n\nMembers:\n{member_list}"
                    
                    # Create new inline keyboard
                    join_button = types.InlineKeyboardMarkup()
                    join_button.add(types.InlineKeyboardButton(text="Join Group", callback_data=f"join_{group.group_id}"))
                    
                    try:
                        # Edit the original message
                        bot.edit_message_text(
                            chat_id=chat_id,
                            message_id=group.message_id,
                            text=updated_text,
                            reply_markup=join_button
                        )
                    except Exception as e:
                        # If message editing fails, send a new message
                        bot.send_message(chat_id, updated_text, reply_markup=join_button)
                        logging.error(f"Failed to edit message: {e}")
                else:
                    bot.answer_callback_query(call.id, f"You are already in {group.group_name}!")

            else:
                bot.answer_callback_query(call.id, "Group not found.")

        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    @bot.message_handler(commands=['delete_group'])
    def delete_group(message):
        msg = bot.reply_to(message, 'Deleting this group will cause you to lose all recorded expenses!\n\nPlease reply this with "coconut" to confirm.')
        bot.register_next_step_handler(msg, process_delete_group)
        

    def process_delete_group(message):
        try:
            """Delete the group associated with the current chat."""

            if not message.text or not message.text.lower() == "coconut":
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
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")

    @bot.message_handler(commands=['toggle_reminders'])
    def toggle_reminders(message):
        try:
            chat_id = message.chat.id
            group = Group.fetch_from_db_by_chat(chat_id)
            

            if group:
                group.toggle_reminders()
                if group.reminders:
                    bot.send_message(chat_id, "Reminders have been enabled for this group.")
                else:
                    bot.send_message(chat_id, "Reminders have been disabled for this group.")
            else:
                bot.send_message(message.chat.id, "No group associated with this chat.")
        
        except Exception as e:
            bot.send_message(chat_id, f"{e}")
