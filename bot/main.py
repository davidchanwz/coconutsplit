# bot/main.py

import telebot
from telebot import types
import os
from bot.handlers import register_handlers  # Import the handler registration function

# Initialize the bot with the token from environment variables
bot = telebot.TeleBot(os.getenv('BOT_TOKEN'))

# Define a list of BotCommand objects
commands = [
    types.BotCommand("start", "Start the bot"),
    types.BotCommand("help", "Get help"),
    types.BotCommand("create_group", "Create a new group"),
    types.BotCommand("delete_group", "Delete the existing group"),
    types.BotCommand("leave_group", "Leave the group you are in"),
    types.BotCommand("view_users", "View all users in the group")

# Add more commands as needed
]

# Set these commands for the bot
bot.set_my_commands(commands)

# Register the handlers from handlers.py
register_handlers(bot)

# Start polling to keep the bot running
if __name__ == '__main__':
    bot.polling(none_stop=True)