# bot/main.py

import telebot
from telebot import types
from fastapi import FastAPI, Request, Response, status, Body, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware  # Add CORS middleware
from dotenv import load_dotenv
import os
import uvicorn
from grouphandlers import register_group_handlers  # Import the handler registration function
from expensehandlers import register_expense_handlers # Import the handler registration function
from receipthandlers import register_receipt_handlers  # Import the handler registration function
from receipthandlersnlp import register_receipt_handlers_nlp  # Import the handler registration function
from utils import process_reminders
from pydantic import BaseModel
from typing import List
from utils import remove_underscore_markdown

load_dotenv()

API_TOKEN = os.getenv('BOT_TOKEN')
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST")
WEBHOOK_PATH = f"/{API_TOKEN}/"

WEBHOOK_URL = f"https://{WEBHOOK_HOST}{WEBHOOK_PATH}"

# Initialize the bot with the token from environment variables
bot = telebot.TeleBot(API_TOKEN)
app = FastAPI()

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=False,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Define a list of BotCommand objects
commands = [
    types.BotCommand("split", "Opens CoconutSplit!"),
    # types.BotCommand("start", "Start the bot"),
    types.BotCommand("help", "Get help"),
    types.BotCommand("create_group", "Create a new group"),
    types.BotCommand("delete_group", "Delete the existing group"),
    types.BotCommand("join_group", "Join the existing group"),
    # # types.BotCommand("leave_group", "Leave the group you are in"),
    # types.BotCommand("view_users", "View all users in the group"),
    # types.BotCommand("add_expense", "Add an expense paid by you"),
    # types.BotCommand("add_expense_on_behalf", "Add an expense paid by someone else"),
    # types.BotCommand("delete_latest_expense", "Delete the latest expense"),
    # types.BotCommand("show_expenses", "Show all expenses"),
    # types.BotCommand("show_debts", "Show all debts"),
    # # types.BotCommand("upload_receipt", "Upload receipt for parsing"),
    # types.BotCommand("upload_receipt", "Upload receipt for parsing using nlp"),
    # types.BotCommand("settle_debt", "Settle a debt"),
    # types.BotCommand("delete_latest_settlement", "Delete the latest settlement"),
    # types.BotCommand("show_settlements", "Show all settlements in the group"),
    types.BotCommand("toggle_reminders", "Toggle daily reminders for debt payments"),


# Add more commands as needed
]


# Register the handlers from handlers.py
register_group_handlers(bot)
register_expense_handlers(bot)
# register_receipt_handlers(bot)
# register_receipt_handlers_nlp(bot)


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
                    f"{debt_string}\n\n"
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

# Define models for request data
class Split(BaseModel):
    username: str
    amount: str

class Settlement(BaseModel):
    from_user: str
    to_user: str
    amount: str

class ExpenseNotification(BaseModel):
    chat_id: int
    action: str
    description: str
    amount: str
    payer: str
    splits: List[Split]

class SettlementNotification(BaseModel):
    chat_id: int
    action: str
    settlements: List[Settlement]

# Authentication middleware
async def verify_api_key(request: Request):
    api_key = request.headers.get('x-api-key')
    expected_key = os.getenv('NOTIFICATION_API_KEY')
    
    if not api_key or api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True

@app.options("/api/notify")
async def options_notify():
    # Handle OPTIONS request explicitly
    # This is the preflight request that browsers send before the actual POST
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
        }
    )

@app.post("/api/notify")
async def handle_notification(
    request: Request,
    authenticated: bool = Depends(verify_api_key)
):
    try:
        # Parse the request body
        data = await request.json()
        
        chat_id = data.get('chat_id')
        action = data.get('action')
        
        if not chat_id:
            raise HTTPException(status_code=400, detail="Missing chat_id field")
        
        if action == 'add_expense':
            # Handle expense notification
            description = data.get('description')
            amount = data.get('amount')
            payer = data.get('payer')
            splits = data.get('splits', [])
            
            # Format the splits for display
            splits_text = ""
            for split in splits:
                username = split.get('username')
                split_amount = split.get('amount')
                splits_text += f"\n- @{username}: ${split_amount}"
            
            # Send a message to the group with the expense details
            notification_text = (
                f"💰 *New Expense Added*\n"
                f"*Description:* {description}\n"
                f"*Amount:* ${amount}\n"
                f"*Paid by:* @{payer}\n"
                f"*Split with:*{splits_text}"
            )
            
            try:
                bot.send_message(chat_id, remove_underscore_markdown(notification_text), parse_mode='Markdown')
            except Exception as send_err:
                return {"status": "error", "message": f"Failed to send message: {str(send_err)}"}
            
        elif action == 'settle_up':
            # Handle settlement notification
            settlements = data.get('settlements', [])
            
            if not settlements:
                return {"status": "warning", "message": "No settlements were made"}
            
            # Format the settlement details for display
            settlements_text = ""
            for settlement in settlements:
                from_user = settlement.get('from')
                to_user = settlement.get('to')
                amount = settlement.get('amount')
                settlements_text += f"\n- @{from_user} → @{to_user}: ${amount}"
            
            # Send a message to the group with the settlement details
            notification_text = (
                f"✅ *Settlements Completed*\n"
                f"The following debts have been settled:{settlements_text}"
            )
            
            bot.send_message(chat_id, remove_underscore_markdown(notification_text), parse_mode='Markdown')
            
        elif action == 'delete_expense':
            # Handle expense deletion notification
            description = data.get('description')
            amount = data.get('amount')
            payer = data.get('payer')
            
            # Send a message to the group about the deleted expense
            notification_text = (
                f"🗑️ *Expense Deleted*\n"
                f"*Description:* {description}\n"
                f"*Amount:* ${amount}\n"
                f"*Paid by:* @{payer}"
            )
            
            bot.send_message(chat_id, remove_underscore_markdown(notification_text), parse_mode='Markdown')

        elif action == "delete_settlement":
            # Handle settlement deletion notification
            from_user = data.get('from_user')
            to_user = data.get('to_user')
            amount = data.get('amount')
            
            # Send a message to the group about the deleted settlement
            notification_text = (
                f"🗑️ *Settlement Deleted*\n"
                f"*From:* @{from_user}\n"
                f"*To:* @{to_user}\n"
                f"*Amount:* ${amount}"
            )
            
            bot.send_message(chat_id, remove_underscore_markdown(notification_text), parse_mode='Markdown')
            
        else:
            raise HTTPException(status_code=400, detail="Unknown action type")
        
        return {"status": "success"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing notification: {str(e)}")

if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8443)))