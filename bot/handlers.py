# bot/handlers.py
from client import supa

def register_handlers(bot):
    """Register all command handlers for the bot."""
    
    @bot.message_handler(commands=['start'])
    def send_welcome(message):
        user_id = message.from.user.id
        bot.reply_to(message, "Hello! Your bot is working! Also Aayush smells! Type /join to join")
        bot.register_next_step_handler(message, get_group_name)
        group_data = {
            'group_name': 'New Group',  # Replace with dynamic group name if needed
            'created_by': user_id  # Replace with dynamic user ID if needed
        }

    @bot.message_handler(commands=['join'])
    def join_group():
        

    def get_group_name(message):
        
