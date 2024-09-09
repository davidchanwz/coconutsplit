import telebot
from dotenv import load_dotenv
import os

load_dotenv()
token = os.getenv('BOT_TOKEN')
bot = telebot.TeleBot(token)

@bot.message_handler(commands=['start'])
def start(message):
    bot.reply_to(message, "Hello! I'm your bot.")

bot.polling()