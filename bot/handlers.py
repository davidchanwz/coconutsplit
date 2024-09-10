# bot/handlers.py
from client import supa

def register_handlers(bot):
    """Register all command handlers for the bot."""
    
    @bot.message_handler(commands=['start'])
    def send_welcome(message):
        bot.reply_to(message, "Hello! Your bot is working! Also Aayush smells!")
        data = {'username': 'aayushstinks'}
        supa.table('users').insert(data).execute()

    
    