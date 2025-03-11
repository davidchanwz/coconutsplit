# bot/receipthandlersnlp.py

import requests
import uuid
import os
import logging
from telebot import types
from classes import User, Group, Expense
from client import supa  # Assuming you have a supabase client
from collections import defaultdict
import re

# State management dictionaries for NLP-based receipt processing
current_receipts_nlp = defaultdict(dict)
pending_receipt_uploads_nlp = {}

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s:%(message)s')

# Load environment variables for security
API_URL = os.getenv("NLP_API_URL", "https://c8wgwo8w0c8swww08oo088kg.deploy.jensenhshoots.com/parse-receipt/")
API_KEY = os.getenv("NLP_API_KEY", "your-default-secure-api-key")  # Replace with your actual API key

def clean_number(value):
    """
    Clean a number string by removing currency symbols and standardizing decimal separators.
    Examples:
    '$14.98' -> '14.98'
    '14,98' -> '14.98'
    '1.234,56' -> '1234.56'
    """
    if isinstance(value, (int, float)):
        return value
    
    if not isinstance(value, str):
        return 0.0

    # Remove currency symbols and whitespace
    value = re.sub(r'[$€£¥]|\s', '', value)
    
    # Handle European number format (1.234,56 -> 1234.56)
    if ',' in value and '.' in value:
        value = value.replace('.', '')  # Remove thousand separators
        value = value.replace(',', '.')  # Replace decimal comma with dot
    # Handle simple comma as decimal separator
    elif ',' in value and '.' not in value:
        value = value.replace(',', '.')
    
    # Extract the first number found
    match = re.search(r'(\d+\.?\d*)', value)
    if match:
        return float(match.group(1))
    return 0.0

def register_receipt_handlers_nlp(bot):
    """
    Registers the NLP-based receipt handlers with the bot.
    """
    
    @bot.message_handler(commands=['upload_receipt'])
    def start_receipt_upload_nlp(message):
        """
        Starts the receipt upload process using the new API.
        """
        try:
            chat_id = message.chat.id
            msg = bot.send_message(chat_id, "Please reply to this message with an image of the receipt.")
            # Store the message ID to verify the reply
            pending_receipt_uploads_nlp[chat_id] = msg.message_id
            logging.info("Starting receipt upload process")
        except:
            logging.error("Failed to start receipt upload process")


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
            logging.info(f"Image saved as {receipt_filename} for chat {chat_id}.")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to save the image: {str(e)}")
            logging.error(f"Failed to save image for chat {chat_id}: {str(e)}")
            return

        # Send the image to the new NLP-based API
        try:
            headers = {
                "x-api-key": API_KEY
            }
            files = {
                "file": open(receipt_filename, 'rb')
            }
            logging.info(f"Sending image {receipt_filename} to NLP API at {API_URL}...")
            response = requests.post(API_URL, headers=headers, files=files)
            if response.status_code != 200:
                raise Exception(f"API returned status code {response.status_code}: {response.text}")
            response_data = response.json()
            receipt_data = response_data.get('receipt_data', {})
            line_items = receipt_data.get('line_items', [])
            if not line_items:
                raise Exception("No items found in the receipt.")
            logging.info(f"API parsed receipt data for chat {chat_id}: {receipt_data}")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to process receipt via NLP API: {str(e)}")
            logging.error(f"NLP API processing failed for chat {chat_id}: {str(e)}")
            os.remove(receipt_filename)
            return

        # Cleanup the temporary image file
        try:
            os.remove(receipt_filename)
            logging.info(f"Temporary file {receipt_filename} deleted.")
        except Exception as e:
            logging.warning(f"Failed to delete temporary file {receipt_filename}: {str(e)}")

        # Post-process receipt data
        try:
            # Handle duplicate subtotal
            subtotal_raw = receipt_data.get('subtotal', '')
            subtotal = clean_number(subtotal_raw)
            tax = clean_number(receipt_data.get('tax', '0.00'))
            
            total_raw = receipt_data.get('total', '')
            if not total_raw.strip():
                # Calculate total as subtotal + tax
                total = subtotal + tax
            else:
                total = clean_number(total_raw)

            # Update receipt_data with cleaned values
            receipt_data['subtotal'] = subtotal
            receipt_data['total'] = total

            # Update line items to match expected format
            items = []
            for item in line_items:
                # Skip items with missing or invalid values
                item_value = item.get('item_value', '')
                if not item_value or not item.get('item_name', '').strip():
                    continue

                # Clean the item value and validate it's a positive number
                cleaned_value = clean_number(item_value)
                if cleaned_value <= 0:
                    continue

                # Get quantity with proper default and validation
                try:
                    quantity = int(item.get('item_quantity', '1') or '1')
                    if quantity <= 0:
                        quantity = 1
                except (ValueError, TypeError):
                    quantity = 1

                items.append({
                    "item_name": item.get('item_name', '').strip(),
                    "amount": cleaned_value,
                    "item_quantity": quantity
                })

            # Verify we have at least one valid item
            if not items:
                raise Exception("No valid items found in the receipt.")
                
            receipt_data['items'] = items
            logging.info(f"Post-processed receipt data for chat {chat_id}: {receipt_data}")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to process receipt data: {str(e)}")
            logging.error(f"Post-processing failed for chat {chat_id}: {str(e)}")
            return

        # Store the parsed items in the current_receipts_nlp state
        current_receipts_nlp[chat_id]['items'] = receipt_data['items']
        current_receipts_nlp[chat_id]['group_id'] = group.group_id
        current_receipts_nlp[chat_id]['paid_by'] = user_id  # Telegram user_id

        # Format the items for user confirmation
        formatted_items = "\n".join([f"{i+1}. {item['item_name']} - ${item['amount']}" for i, item in enumerate(receipt_data['items'])])
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
                bot.send_message(chat_id, f"Tagged @{tagged_user.username} to '{item['item_name']}' (${item['amount']})")
            except Exception as e:
                bot.send_message(chat_id, f"Failed to tag @{tagged_user.username} to '{item['item_name']}': {str(e)}")
                logging.error(f"Failed to tag @{tagged_user.username} to '{item['item_name']}' for chat {chat_id}: {str(e)}")

        # Clear the current receipt processing state
        del current_receipts_nlp[chat_id]

        bot.send_message(chat_id, "Receipt processing complete and debts updated.", reply_markup=types.ReplyKeyboardRemove())