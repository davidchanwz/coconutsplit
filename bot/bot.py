import telebot
import os
from bot.handlers import register_handlers  # Import the handler registration function

# Initialize the bot with the token from environment variables
bot = telebot.TeleBot(os.getenv('BOT_TOKEN'))

# Register the handlers from handlers.py
register_handlers(bot)

# Start polling to keep the bot running
if __name__ == '__main__':
    bot.polling(none_stop=True)