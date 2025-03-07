# bot/main.py

import telebot
from telebot import types
import os
from bot.grouphandlers import register_group_handlers  # Import the handler registration function
from bot.expensehandlers import register_expense_handlers  # Import the handler registration function
from bot.receipthandlers import register_receipt_handlers  # Import the handler registration function
from bot.receipthandlersnlp import register_receipt_handlers_nlp  # Import the handler registration function


# Initialize the bot with the token from environment variables
bot = telebot.TeleBot(os.getenv('BOT_TOKEN'))



# Define a list of BotCommand objects
commands = [
    types.BotCommand("random_word", "Generate random word"),
    types.BotCommand("start", "Start the bot"),
    types.BotCommand("help", "Get help"),
    types.BotCommand("create_group", "Create a new group"),
    types.BotCommand("delete_group", "Delete the existing group"),
    types.BotCommand("leave_group", "Leave the group you are in"),
    types.BotCommand("view_users", "View all users in the group"),
    types.BotCommand("add_expense", "Add an expense"),
    types.BotCommand("show_expenses", "Add an expense"),
    types.BotCommand("show_debts", "View all debts"),
    # types.BotCommand("upload_receipt", "Upload receipt for parsing"),
    types.BotCommand("upload_receipt", "Upload receipt for parsing using nlp"),
    types.BotCommand("settle_debt", "Settle a debt"),
    types.BotCommand("show_settlements", "Show all settlements in the group"),




# Add more commands as needed
]

# Set these commands for the bot
bot.set_my_commands(commands)

# Register the handlers from handlers.py
register_group_handlers(bot)
register_expense_handlers(bot)
# register_receipt_handlers(bot)
register_receipt_handlers_nlp(bot)


# Start polling to keep the bot running
if __name__ == '__main__':
    bot.polling(none_stop=True)