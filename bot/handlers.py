# bot/handlers.py
from client import supa

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

        
