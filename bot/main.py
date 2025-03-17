# bot/main.py

import telebot
from telebot import types
from fastapi import FastAPI, Request, Response, status
from dotenv import load_dotenv
import os
import uvicorn
from grouphandlers import register_group_handlers  # Import the handler registration function
from expensehandlers import register_expense_handlers, process_reminders  # Import the handler registration function
from receipthandlers import register_receipt_handlers  # Import the handler registration function
from receipthandlersnlp import register_receipt_handlers_nlp  # Import the handler registration function

load_dotenv()

API_TOKEN = os.getenv('BOT_TOKEN')
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST")
WEBHOOK_PATH = f"/{API_TOKEN}/"

WEBHOOK_URL = f"https://{WEBHOOK_HOST}{WEBHOOK_PATH}"

# Initialize the bot with the token from environment variables
bot = telebot.TeleBot(API_TOKEN)
app = FastAPI()


# Define a list of BotCommand objects
commands = [
    types.BotCommand("start", "Start the bot"),
    types.BotCommand("help", "Get help"),
    types.BotCommand("create_group", "Create a new group"),
    types.BotCommand("delete_group", "Delete the existing group"),
    types.BotCommand("join_group", "Join the existing group"),
    # types.BotCommand("leave_group", "Leave the group you are in"),
    types.BotCommand("view_users", "View all users in the group"),
    types.BotCommand("add_expense", "Add an expense paid by you"),
    types.BotCommand("add_expense_on_behalf", "Add an expense paid by someone else"),
    types.BotCommand("delete_latest_expense", "Delete the latest expense"),
    types.BotCommand("show_expenses", "Show all expenses"),
    types.BotCommand("show_debts", "Show all debts"),
    # types.BotCommand("upload_receipt", "Upload receipt for parsing"),
    types.BotCommand("upload_receipt", "Upload receipt for parsing using nlp"),
    types.BotCommand("settle_debt", "Settle a debt"),
    types.BotCommand("delete_latest_settlement", "Delete the latest settlement"),
    types.BotCommand("show_settlements", "Show all settlements in the group"),
    types.BotCommand("toggle_reminders", "Toggle daily reminders for debt payments"),


# Add more commands as needed
]


# Register the handlers from handlers.py
register_group_handlers(bot)
register_expense_handlers(bot)
# register_receipt_handlers(bot)
register_receipt_handlers_nlp(bot)


# --- FastAPI route to receive webhook updates --- #

@app.post(WEBHOOK_PATH)
async def telegram_webhook(req: Request):
    json_data = await req.json()
    update = telebot.types.Update.de_json(json_data)
    bot.process_new_updates([update])
    return {"status": "ok"}

# --- Set webhook on startup --- #

@app.on_event("startup")
async def startup():
    bot.remove_webhook()
    bot.set_webhook(url=WEBHOOK_URL)
    bot.set_my_commands(commands)

@app.post("/send-daily-reminder")
async def send_daily_reminder(req: Request):
    try:
        # Get API key from request header
        api_key = req.headers.get('x-api-key')
        
        # Validate API key (should match environment variable)
        expected_key = os.getenv('REMINDER_API_KEY')
        if not api_key or api_key != expected_key:
            return Response(status_code=status.HTTP_401_UNAUTHORIZED)

        # Get debt messages for each group using process_reminders
        chat_id_to_debt_string = process_reminders()
        
        # Send reminders
        sent_count = 0
        for chat_id, debt_string in chat_id_to_debt_string.items():
            try:
                reminder_message = (
                    f"🌴 Daily Debt Reminder 🌴\n\n"
                    f"Here are the current outstanding debts:\n\n"
                    f"{debt_string}\n\n"
                    f"Use /settle_debt to settle up!"
                )
                bot.send_message(chat_id, reminder_message)
                sent_count += 1
            except Exception as e:
                print(f"Failed to send reminder to chat {chat_id}: {e}")
                continue

        return {
            "status": "success",
            "reminders_sent": sent_count,
            "total_groups": len(chat_id_to_debt_string)
        }
    except Exception as e:
        return Response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=str(e)
        )

# --- Optional: remove webhook on shutdown --- #
@app.on_event("shutdown")
async def shutdown():
    bot.remove_webhook()

if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8443)))