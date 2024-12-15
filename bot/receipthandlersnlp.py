# bot/receipthandlersnlp.py

import requests
import pytesseract
from PIL import Image
import re
import uuid
import os
import logging
from telebot import types
from bot.classes import User, Group, Expense
from client import supa  
from collections import defaultdict

# Configure Tesseract OCR
pytesseract.pytesseract.tesseract_cmd = '/app/.apt/usr/bin/tesseract'

# State management dictionaries for NLP-based receipt processing
current_receipts_nlp = defaultdict(dict)
pending_receipt_uploads_nlp = {}

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s:%(message)s')

def register_receipt_handlers_nlp(bot):
    """
    Registers the NLP-based receipt handlers with the bot.
    """
    
    @bot.message_handler(commands=['upload_receipt_nlp'])
    def start_receipt_upload_nlp(message):
        """
        Starts the receipt upload process using the NLP-based parser.
        """
        chat_id = message.chat.id
        msg = bot.send_message(chat_id, "Please reply to this message with an image of the receipt.")
        # Store the message ID to verify the reply
        pending_receipt_uploads_nlp[chat_id] = msg.message_id

    @bot.message_handler(content_types=['photo'])
    def handle_receipt_photo_nlp(message):
        """
        Handles receipt photo uploads for NLP-based parsing.
        """
        chat_id = message.chat.id
        user_id = message.from_user.id

        # Check if the photo is a reply to the bot's request
        reply_to_message_id = message.reply_to_message.message_id if message.reply_to_message else None
        if chat_id not in pending_receipt_uploads_nlp or reply_to_message_id != pending_receipt_uploads_nlp[chat_id]:
            # Not a reply to /upload_receipt_nlp, ignore or handle other cases
            return  # Optionally, you can handle other photo uploads here

        # Ensure the user is part of a group
        group = Group.fetch_from_db_by_chat(chat_id)
        if not group:
            bot.send_message(chat_id, "You are not part of any group. Create or join a group first.")
            return

        # Download the photo
        file_id = message.photo[-1].file_id
        try:
            file_info = bot.get_file(file_id)
            downloaded_file = bot.download_file(file_info.file_path)
        except Exception as e:
            bot.send_message(chat_id, f"Failed to download the image: {str(e)}")
            logging.error(f"Failed to download image from chat {chat_id}: {str(e)}")
            return

        # Save the image with a unique filename
        receipt_filename = f"receipt_nlp_{uuid.uuid4()}.jpg"
        try:
            with open(receipt_filename, 'wb') as f:
                f.write(downloaded_file)
        except Exception as e:
            bot.send_message(chat_id, f"Failed to save the image: {str(e)}")
            logging.error(f"Failed to save image for chat {chat_id}: {str(e)}")
            return

        # Process OCR to extract text
        try:
            image = Image.open(receipt_filename)
            text = pytesseract.image_to_string(image)
            if not text.strip():
                raise Exception("No text detected in the image.")
            logging.info(f"OCR extracted text for chat {chat_id}: {text}")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to extract text from the image: {str(e)}")
            logging.error(f"OCR extraction failed for chat {chat_id}: {str(e)}")
            os.remove(receipt_filename)
            return

        # Send the extracted text to the NLP-based API
        try:
            api_url = "https://localhost:8000/parse-receipt"
            headers = {
                "Content-Type": "application/json",
                "x-api-key": "your-default-secure-api-key"  # Replace with your actual API key
            }
            payload = {
                "text": text
            }
            response = requests.post(api_url, json=payload, headers=headers)
            if response.status_code != 200:
                raise Exception(f"API returned status code {response.status_code}: {response.text}")
            response_data = response.json()
            items = response_data.get('items', [])
            if not items:
                raise Exception("No items found in the receipt.")
            logging.info(f"API parsed items for chat {chat_id}: {items}")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to process receipt via NLP API: {str(e)}")
            logging.error(f"NLP API processing failed for chat {chat_id}: {str(e)}")
            os.remove(receipt_filename)
            return

        # Cleanup the temporary image file
        try:
            os.remove(receipt_filename)
        except Exception as e:
            logging.warning(f"Failed to delete temporary file {receipt_filename}: {str(e)}")

        # Store the parsed items in the current_receipts_nlp state
        current_receipts_nlp[chat_id]['items'] = items
        current_receipts_nlp[chat_id]['group_id'] = group.group_id
        current_receipts_nlp[chat_id]['paid_by'] = user_id  # Telegram user_id

        # Format the items for user confirmation
        formatted_items = "\n".join([f"{i+1}. {item['item']} - ${item['amount']}" for i, item in enumerate(items)])
        markup = types.ReplyKeyboardMarkup(one_time_keyboard=True, resize_keyboard=True)
        markup.add('Proceed to Tag', 'Cancel')

        # Remove chat from pending uploads
        pending_receipt_uploads_nlp.pop(chat_id, None)

        # Send confirmation message to the user
        bot.send_message(chat_id, f"Here are the items I found:\n{formatted_items}\n\nWhat would you like to do next?", reply_markup=markup)

    @bot.message_handler(func=lambda message: message.text == 'Proceed to Tag')
    def proceed_to_tag_nlp(message):
        """
        Handles the 'Proceed to Tag' action.
        """
        chat_id = message.chat.id
        if chat_id not in current_receipts_nlp or 'items' not in current_receipts_nlp[chat_id]:
            bot.send_message(chat_id, "No receipt is being processed currently. Please upload a receipt image first.")
            return
        bot.send_message(chat_id, "Please tag users to each item using the format '@username item_number'. For example:\n@alice 1\n@bob 2")

    @bot.message_handler(func=lambda message: message.text == 'Cancel')
    def cancel_receipt_processing_nlp(message):
        """
        Handles the 'Cancel' action.
        """
        chat_id = message.chat.id
        if chat_id in current_receipts_nlp:
            del current_receipts_nlp[chat_id]
        bot.send_message(chat_id, "Receipt processing has been canceled.", reply_markup=types.ReplyKeyboardRemove())

    @bot.message_handler(func=lambda message: message.text.startswith('@'))
    def handle_user_tagging_nlp(message):
        """
        Handles user tagging for receipt items.
        """
        chat_id = message.chat.id
        user_id = message.from_user.id

        # Check if there is an ongoing receipt processing for this chat
        if chat_id not in current_receipts_nlp or 'items' not in current_receipts_nlp[chat_id]:
            bot.send_message(chat_id, "No receipt is being processed currently. Please upload a receipt image first.")
            return

        # Parse the tagging message
        input_text = message.text.strip()
        pattern = r'@(\w+)\s+(\d+)'
        matches = re.findall(pattern, input_text)

        if not matches:
            bot.send_message(chat_id, "Invalid tagging format. Please use '@username item_number'. Example:\n@alice 1\n@bob 2")
            return

        # Fetch group and current items
        group_id = current_receipts_nlp[chat_id]['group_id']
        group = Group.fetch_from_db_by_chat(chat_id)
        items = current_receipts_nlp[chat_id]['items']
        paid_by_telegram_id = current_receipts_nlp[chat_id]['paid_by']

        # Fetch the payer User object
        payer_user = User.fetch_from_db_by_user_id(paid_by_telegram_id)
        if not payer_user:
            bot.send_message(chat_id, "Payer user not found in the database.")
            return

        # Initialize a list to keep track of tagged users
        tagged_users = []

        for match in matches:
            username, item_number = match
            try:
                item_index = int(item_number) - 1
                if item_index < 0 or item_index >= len(items):
                    bot.send_message(chat_id, f"Item number {item_number} is out of range.")
                    continue
            except ValueError:
                bot.send_message(chat_id, f"Invalid item number: {item_number}")
                continue

            # Fetch the user by username
            tagged_user = User.fetch_from_db_by_username(username)
            if not tagged_user:
                bot.send_message(chat_id, f"User @{username} not found in the database.")
                continue

            # Check if the tagged user is part of the group
            if not group.check_user_in_group(tagged_user):
                bot.send_message(chat_id, f"User @{username} is not a member of this group.")
                continue

            # Append to tagged_users list
            tagged_users.append((tagged_user, items[item_index]))

        if not tagged_users:
            bot.send_message(chat_id, "No valid tags were found. Please try again.")
            return

        # Create a new Expense entry
        expense_description = "Receipt Import (NLP)"
        total_amount = sum([item['amount'] for item in items])
        expense = Expense(group=group, paid_by=payer_user, amount=total_amount, description=expense_description)
        try:
            expense.save_to_db()
        except Exception as e:
            bot.send_message(chat_id, f"Failed to save expense: {str(e)}")
            logging.error(f"Failed to save expense for chat {chat_id}: {str(e)}")
            return

        # Add splits and update debts
        for tagged_user, item in tagged_users:
            try:
                expense.add_split(user=tagged_user, amount=item['amount'])
                expense.add_debt(user=tagged_user, amount_owed=item['amount'])
                expense.add_debt_reverse(user=tagged_user, amount_owed=item['amount'])
                bot.send_message(chat_id, f"Tagged @{tagged_user.username} to '{item['item']}' (${item['amount']})")
            except Exception as e:
                bot.send_message(chat_id, f"Failed to tag @{tagged_user.username} to '{item['item']}': {str(e)}")
                logging.error(f"Failed to tag @{tagged_user.username} to '{item['item']}' for chat {chat_id}: {str(e)}")

        # Clear the current receipt processing state
        del current_receipts_nlp[chat_id]

        bot.send_message(chat_id, "Receipt processing complete and debts updated.", reply_markup=types.ReplyKeyboardRemove())