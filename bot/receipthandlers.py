# bot/receipthandlers.py
import pytesseract
from PIL import Image
import re
import uuid
import os
import logging
from telebot import types
from classes import User, Group, Expense
from client import supa  
from collections import defaultdict

pytesseract.pytesseract.tesseract_cmd = '/app/.apt/usr/bin/tesseract'
# Import the state management dictionary
current_receipts = defaultdict(dict)

pending_receipt_uploads = {}


# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s:%(message)s')
def register_receipt_handlers(bot):


    @bot.message_handler(commands=['upload_receipt'])
    def start_receipt_upload(message):
        """Start the receipt upload process."""
        chat_id = message.chat.id
        msg = bot.send_message(chat_id, "Please reply to this message with an image of the receipt.")
        # Store the message ID so we can verify if the reply is for this specific message
        pending_receipt_uploads[chat_id] = msg.message_id

    @bot.message_handler(content_types=['photo'])
    def handle_receipt_photo(message):
        chat_id = message.chat.id
        user_id = message.from_user.id

        reply_to_message_id = message.reply_to_message.message_id if message.reply_to_message else None

        # Check if this image is a reply to the bot's request
        if chat_id not in pending_receipt_uploads or reply_to_message_id != pending_receipt_uploads[chat_id]:
            bot.send_message(chat_id, "If you'd like to upload a receipt, please use /upload_receipt and reply to the bot's message.")
            return
        
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
        receipt_filename = f"receipt_{uuid.uuid4()}.jpg"
        try:
            with open(receipt_filename, 'wb') as f:
                f.write(downloaded_file)
        except Exception as e:
            bot.send_message(chat_id, f"Failed to save the image: {str(e)}")
            logging.error(f"Failed to save image for chat {chat_id}: {str(e)}")
            return
        
        # Process OCR
        try:
            items = process_receipt_ocr(receipt_filename)
            if not items:
                raise Exception("No items found in the receipt.")
        except Exception as e:
            bot.send_message(chat_id, f"Failed to process receipt: {str(e)}")
            logging.error(f"OCR processing failed for chat {chat_id}: {str(e)}")
            os.remove(receipt_filename)
            return
        
        # Cleanup the file
        try:
            os.remove(receipt_filename)
        except Exception as e:
            logging.warning(f"Failed to delete temporary file {receipt_filename}: {str(e)}")
        
        # Store the parsed items in the current_receipts state
        current_receipts[chat_id]['items'] = items
        current_receipts[chat_id]['group_id'] = group.group_id
        current_receipts[chat_id]['paid_by'] = user_id  # Telegram user_id
        
        # Format and send the items back to the user for confirmation with inline buttons
        formatted_items = "\n".join([f"{i+1}. {item['item']} - ${item['amount']}" for i, item in enumerate(items)])
        markup = types.ReplyKeyboardMarkup(one_time_keyboard=True, resize_keyboard=True)
        markup.add('Proceed to Tag', 'Cancel')

        # Remove chat from pending uploads
        pending_receipt_uploads.pop(chat_id, None)

        bot.send_message(chat_id, f"Here are the items I found:\n{formatted_items}\n\nWhat would you like to do next?", reply_markup=markup)

    def process_receipt_ocr(image_path):
        """
        Processes the receipt image using Tesseract OCR and parses the text to extract items and amounts.
        
        Args:
            image_path (str): Path to the receipt image.
        
        Returns:
            list: A list of dictionaries containing 'item' and 'amount'.
        """
        try:
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image)
            return parse_receipt_text(text)
        except Exception as e:
            raise Exception(f"OCR processing failed: {str(e)}")

    def parse_receipt_text(text):
        """
        Parses the OCR-extracted text to identify items and their corresponding amounts.
        
        Args:
            text (str): Text extracted from the receipt.
        
        Returns:
            list: A list of dictionaries containing 'item' and 'amount'.
        
        Raises:
            Exception: If no valid items are found.
        """
        items = []
        
        # Define patterns to exclude non-item lines
        exclude_patterns = [
            r'(?i)\bsubtotal\b',
            r'(?i)\btax\b',
            r'(?i)\btotal\b',
            r'(?i)\bchange\b',
            r'(?i)\brefund\b',
            r'(?i)\bdiscount\b',
            r'(?i)\bthank you\b',
            r'(?i)\bpurchase date\b',
            r'(?i)\bdate\b',
            r'(?i)\bbalance due\b',
            r'(?i)\bguests\b',
            r'(?i)\bpax\b',
            r'(?i)\breprint\b',
            r'(?i)\bserver\b',
            r'(?i)\bservice charge\b',
            r'(?i)\bfees\b',
            r'(?i)\bgst\b',







        ]
        
        # Split text into lines for line-by-line processing
        lines = text.split('\n')
        
        # Define multiple regex patterns to handle different receipt formats
        patterns = [
            # Pattern 1: "Item Name    123.45" or "Item Name 123.45"
            r'^([^\d]+?)\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)$',
            # Pattern 2: "Item Name ..... 123.45"
            r'^([^\d]+?)\.*\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)$',
            # Pattern 3: "Item Name - 123.45"
            r'^([^\d]+?)\s*-\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)$',
            # Pattern 4: "Item Name x2 123.45" (handling quantities)
            r'^([^\d]+?)\s*x\d+\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)$',
            # Pattern 5: "Item Name 2 @ 61.72 each = 123.44"
            r'^([^\d]+?)\s+\d+\s*@\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:each)?\s*=\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)$'
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue  # Skip empty lines
            
            # Check if the line matches any exclude patterns
            if any(re.search(excl_pat, line) for excl_pat in exclude_patterns):
                logging.debug(f"Excluded line: {line}")
                continue  # Skip non-item lines
            
            matched = False
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    item_name, item_price = match.groups()
                    
                    # Clean item name: remove trailing dots, hyphens, and extra spaces
                    item_name = re.sub(r'[.\-]+$', '', item_name).strip()
                    
                    # Normalize price by replacing comma with dot
                    item_price = item_price.replace(',', '.')
                    
                    try:
                        amount = float(item_price)
                        if amount <= 0:
                            logging.debug(f"Skipped invalid amount in line: {line}")
                            break  # Skip invalid amounts
                        items.append({'item': item_name, 'amount': amount})
                        matched = True
                        logging.debug(f"Matched line: {line} -> Item: {item_name}, Amount: {amount}")
                        break  # Stop checking other patterns once matched
                    except ValueError:
                        logging.debug(f"Invalid amount format in line: {line}")
                        continue  # Try next pattern
            
            if not matched:
                logging.debug(f"No pattern matched for line: {line}")
                continue  # Skip lines that don't match any pattern
        
        if not items:
            raise Exception("No valid items with positive amounts were found.")
        
        return items

    @bot.message_handler(func=lambda message: message.text == 'Proceed to Tag')
    def proceed_to_tag(message):
        chat_id = message.chat.id
        if chat_id not in current_receipts or 'items' not in current_receipts[chat_id]:
            bot.send_message(chat_id, "No receipt is being processed currently. Please upload a receipt image first.")
            return
        bot.send_message(chat_id, "Please tag users to each item using the format '@username item_number'. For example:\n@alice 1\n@bob 2")

    @bot.message_handler(func=lambda message: message.text == 'Cancel')
    def cancel_receipt_processing(message):
        chat_id = message.chat.id
        if chat_id in current_receipts:
            del current_receipts[chat_id]
        bot.send_message(chat_id, "Receipt processing has been canceled.", reply_markup=types.ReplyKeyboardRemove())

    @bot.message_handler(func=lambda message: message.text.startswith('@'))
    def handle_user_tagging(message):
        chat_id = message.chat.id
        user_id = message.from_user.id
        
        # Check if there is an ongoing receipt processing for this chat
        if chat_id not in current_receipts or 'items' not in current_receipts[chat_id]:
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
        group_id = current_receipts[chat_id]['group_id']
        group = Group.fetch_from_db_by_chat(chat_id)
        items = current_receipts[chat_id]['items']
        paid_by_telegram_id = current_receipts[chat_id]['paid_by']
        
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
        expense_description = "Receipt Import"
        total_amount = sum([item['amount'] for item in items])
        expense = Expense(group=Group.fetch_from_db_by_chat(chat_id), paid_by=payer_user, amount=total_amount, description=expense_description)
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
        del current_receipts[chat_id]
        
        bot.send_message(chat_id, "Receipt processing complete and debts updated.", reply_markup=types.ReplyKeyboardRemove())