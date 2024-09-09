from flask import Flask
import telebot
import os

app = Flask(__name__)
bot = telebot.TeleBot(os.getenv('BOT_TOKEN'))

@app.route('/')
def home():
    return "Bot is running!"

# Add bot handler for /start command
@bot.message_handler(commands=['start'])
def send_welcome(message):
    bot.reply_to(message, "Hello! Your bot is working!")

if __name__ == '__main__':
    bot.polling()
    app.run(host='0.0.0.0', port=5000)