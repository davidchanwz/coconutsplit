import telebot
import os

bot = telebot.TeleBot(os.getenv('BOT_TOKEN'))

@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, "Hello! Your bot is working! Also Aayush smells!")

if __name__ == '__main__':
    bot.polling(none_stop=True)