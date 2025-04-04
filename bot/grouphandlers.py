# bot/grouphandlers.py
from telebot import types
from classes import Group, User
import uuid
from utils import is_group_chat
import os
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton
from dotenv import load_dotenv

load_dotenv()

def register_group_handlers(bot):
    """Register all command handlers for the bot."""

    @bot.message_handler(commands=['split'])
    def launch_coconut_split_app(message):
        try:
            raise Exception("This is a test error")
            # Check if this is a private chat
            if not is_group_chat(message):
                bot.reply_to(message, "This command can only be used in group chats.")
                return
                
            chat_id = message.chat.id
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
            chat_id = message.chat.id if message else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "launch_coconut_split_app", group, chat_id, message)
 
    @bot.message_handler(commands=['start'])
    def send_welcome(message):
        try:
            raise Exception("This is a test error")
            welcome_message = (
            "🌴 Welcome to CoconutSplit! 🌴\n\n"
            "CoconutSplit helps you easily split expenses with your friends and track debts within a group. Please enter /help for the list of available commands!"
            )
            bot.reply_to(message, welcome_message)
        except Exception as e:
            chat_id = message.chat.id if message else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "start", group, chat_id, message)

    @bot.message_handler(commands=['help'])
    def send_help(message):
        try:
            raise Exception("This is a test error")
            help_message = (
            "📚 *General Commands:*\n"
            "/split - Main command to run after setting up the group\n"
            "/help - View the list of all available commands\n"
            "/toggle_reminders - Receive daily reminders for debt payments\n\n"


            "👥 *Group Management Commands:*\n"
            "/create_group - Create a new group\n"
            "/delete_group - Delete the existing group\n"
            "/join_group - Join the existing group\n\n"

            "If you have any questions or get stuck, use /help to view this message again!\n"
            "Happy splitting! 😊"
            )
            bot.reply_to(message, help_message)
        except Exception as e:
            chat_id = message.chat.id if message else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "send_help", group, chat_id, message)

    @bot.message_handler(commands=['join_group'])
    def join_group(message):
        try:
            # Check if this is a private chat
            if not is_group_chat(message):
                bot.reply_to(message, "This command can only be used in group chats.")
                return
                
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
            chat_id = message.chat.id if message else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "join_group", group, chat_id, message)

    @bot.callback_query_handler(func=lambda call: call.data.startswith('join_'))
    def handle_join_group(call):
        """Handle users clicking the 'Join Group' button."""
        try:
            raise Exception("This is a test error")
            chat_id = call.message.chat.id  # Get the chat_id from the message
            user = User.fetch_from_db_by_user_id(call.from_user.id)

            if not user:
                user = User(user_id=call.from_user.id, username=call.from_user.username)
                user.save_to_db()  # Save the user to the database if not already present

            group = Group.fetch_from_db_by_chat(chat_id)
            
            if not user.username == call.from_user.username:
                user.update_username(call.from_user.username)

            # Add the user to the group in the database
            if group:
                if not group.check_user_in_group(user): 
                    group.add_member(user)
                    bot.answer_callback_query(call.id, f"You have joined '{group.group_name}'!")
                    
                    # Update the original message with the new member
                    members = group.fetch_all_members()
                    member_list = "\n".join([f"- {member.username}" for member in members])
                    updated_text = f"Group '{group.group_name}'\n\nMembers:\n{member_list}"
                    
                    # Create new inline keyboard
                    join_button = types.InlineKeyboardMarkup()
                    join_button.add(types.InlineKeyboardButton(text="Join Group", callback_data=f"join_{group.group_id}"))
                    
                    # Edit the original message
                    bot.edit_message_text(
                        chat_id=chat_id,
                        message_id=group.message_id,
                        text=updated_text,
                        reply_markup=join_button
                    )
                else:
                    bot.answer_callback_query(call.id, f"You are already in {group.group_name}!")

            else:
                bot.answer_callback_query(call.id, "Group not found.")

        except Exception as e:
            chat_id = call.message.chat.id if call else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "handle_join_group", group, chat_id, call.message)

    @bot.message_handler(commands=['delete_group'])
    def delete_group(message):
        try:
            """Send a confirmation button for deleting the group."""
            
            # Check if this is a private chat
            if not is_group_chat(message):
                bot.reply_to(message, "This command can only be used in group chats.")
                return

            chat_id = message.chat.id

            # Fetch the group associated with the chat
            group = Group.fetch_from_db_by_chat(chat_id)

            if group:
                # Create inline buttons for confirming or canceling group deletion
                markup = InlineKeyboardMarkup()
                markup.add(
                    InlineKeyboardButton("Delete Group", callback_data=f"delete_group:{group.group_id}"),
                    InlineKeyboardButton("Cancel", callback_data="cancel_delete_group")
                )

                bot.send_message(
                    chat_id,
                    f"Deleting this group will cause you to lose all recorded expenses!\n\nAre you sure you want to delete the group '{group.group_name}'?",
                    reply_markup=markup,
                )
            else:
                bot.reply_to(message, "No group exists in this chat to delete.")
            
        except Exception as e:
            chat_id = message.chat.id if message else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "delete_group", group, chat_id, message)

    @bot.callback_query_handler(func=lambda call: call.data.startswith("delete_group:") or call.data == "cancel_delete_group")
    def handle_delete_group_callback(call):
        """Handle the callback query for deleting or canceling the group deletion."""
        try:
            raise Exception("This is a test error")
            chat_id = call.message.chat.id

            if call.data == "cancel_delete_group":
                # Handle the cancel action
                bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=call.message.message_id,
                    text="Group deletion was cancelled.",
                )
                return

            # Handle the delete action
            group = Group.fetch_from_db_by_chat(chat_id)

            if group:
                try:
                    # Delete the group from the database
                    group.delete_from_db()
                    bot.edit_message_text(
                        chat_id=chat_id,
                        message_id=call.message.message_id,
                        text=f"The group '{group.group_name}' has been successfully deleted.",
                    )
                except Exception as e:
                    bot.edit_message_text(
                        chat_id=chat_id,
                        message_id=call.message.message_id,
                        text=f"Failed to delete the group: {str(e)}",
                    )
            else:
                bot.answer_callback_query(call.id, "Group not found or already deleted.")
        except Exception as e:
            chat_id = call.message.chat.id if call else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "handle_delete_group_callback", group, chat_id, call.message)

    @bot.message_handler(commands=['toggle_reminders'])
    def toggle_reminders(message):
        try:
            raise Exception("This is a test error")
            # Check if this is a private chat
            if not is_group_chat(message):
                bot.reply_to(message, "This command can only be used in group chats.")
                return
                
            chat_id = message.chat.id
            group = Group.fetch_from_db_by_chat(chat_id)
            

            if group:
                group.toggle_reminders()
                if group.reminders:
                    bot.send_message(chat_id, "Reminders have been enabled for this group. (12pm SGT Daily)")
                else:
                    bot.send_message(chat_id, "Reminders have been disabled for this group.")
            else:
                bot.send_message(message.chat.id, "No group associated with this chat.")
        
        except Exception as e:
            chat_id = message.chat.id if message else None
            group = Group.fetch_from_db_by_chat(chat_id)
            send_error_to_hq(str(e), "toggle_reminders", group, chat_id, message)
            
    def send_error_to_hq(error_message: str, function_name: str, group: Group = None, chat_id: int = None, message=None):
        """Send detailed error messages to the HQ chat."""
        try:
            print("IN SEND ERROR TO HQ")
            hq_chat_id = os.getenv("HQ_CHAT_ID")
            if not hq_chat_id:
                print("HQ_CHAT_ID not set in environment variables.")
                return

            print("HQ_CHAT_ID found in environment variables.")
            details = f"🚨 Error Report\n\nFunction: {function_name}\n"
            if group:
                details += f"Group Name: {group.group_name}\nGroup ID: {group.group_id}\n"
            if chat_id:
                details += f"Chat ID: {chat_id}\n"
            details += f"Error: {error_message}"
            print(details)
            
            bot.send_message(hq_chat_id, details)
        except Exception as e:
            print(f"Failed to send error to HQ: {e}")
