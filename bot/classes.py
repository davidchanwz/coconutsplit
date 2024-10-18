# bot/classes.py

from typing import List, Dict
from datetime import datetime
from client import supa
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

class User:
    def __init__(self, user_id: int, username: str, user_uuid: str = None, currency: str = "SGD"):
        self.user_id = user_id  # This is the Telegram user ID (integer)
        self.username = username
        self.uuid = user_uuid or str(uuid.uuid4())  # Generate a UUID if not provided
        self.currency = currency
        self.created_at = datetime.now()

    def save_to_db(self):
        """Save the user to the database."""
        user_data = {
            "uuid": self.uuid,  # The UUID field in the database
            "user_id": self.user_id,  # The Telegram user ID (integer)
            "username": self.username,
            "currency": self.currency,
            "created_at": self.created_at.isoformat() # Seralise datetime
        }
        return supa.table('users').insert(user_data).execute()

    @staticmethod
    def fetch_from_db_by_user_id(user_id: int):
        """Fetch a user from the database by Telegram user_id and create a User instance."""
        try:
            # Fetch user by user_id (Telegram ID)
            response = supa.table('users').select("*").eq("user_id", user_id).single().execute()
            user_data = response.data
            if user_data:
                return User(user_id=user_data['user_id'], username=user_data['username'], user_uuid=user_data['uuid'], currency=user_data['currency'])
        except Exception as e:
            print(f"User not found: {e}")
            return None
        
    @staticmethod
    def fetch_from_db_by_uuid(uuid: str):
        """Fetch a user from the database by Telegram user_id and create a User instance."""
        try:
            # Fetch user by uuid (Telegram ID)
            response = supa.table('users').select("*").eq("uuid", uuid).single().execute()
            user_data = response.data
            if user_data:
                return User(user_id=user_data['user_id'], username=user_data['username'], user_uuid=user_data['uuid'], currency=user_data['currency'])
        except Exception as e:
            print(f"User not found: {e}")
            return None
        
    
    @staticmethod
    def fetch_from_db_by_username(username: str):
        """
        Fetch a user from the database by their Telegram handle (username).

        Args:
            username (str): The Telegram handle of the user.

        Returns:
            User: An instance of the User class if the user is found, None otherwise.
        """
        try:
            response = supa.table('users').select("*").eq("username", username).single().execute()
            user_data = response.data
            if user_data:
                return User(
                    user_id=user_data['user_id'],
                    username=user_data['username'],
                    user_uuid=user_data['uuid'],
                    currency=user_data['currency']
                )
            else:
                print(f"User with handle @{username} not found.")
                return None
        except Exception as e:
            print(f"Error fetching user by username @{username}: {e}")
            return None

class Group:
    def __init__(self, group_name: str, created_by: User, chat_id: int, group_id: str = None):
        self.group_id = group_id or str(uuid.uuid4())  # Generate UUID if not provided
        self.group_name = group_name
        self.created_by = created_by
        self.chat_id = chat_id
        self.created_at = datetime.now()

        # Add logging to check UUID generation and its type
        logging.info(f"Generated group_id: {self.group_id}")
        logging.info(f"Type of group_id: {type(self.group_id)}")

    def check_user_in_group(self, user: User):
        existing_user_in_group = supa.table('group_members').select('*').eq('user_uuid', user.uuid).eq('group_id', self.group_id).execute()
        if existing_user_in_group.data:
            return True
        else:
            return False

    def save_to_db(self):
        """Save the group to the database."""
        group_data = {
            "group_id": self.group_id,  # Store the UUID as a string
            "group_name": self.group_name,
            "created_by": self.created_by.uuid,
            "chat_id": self.chat_id,  # Store the chat ID in the database
            "created_at": self.created_at.isoformat()  # Serialize datetime to ISO 8601 string
        }
        return supa.table('groups').insert(group_data).execute()

    def add_member(self, user: User):
        """Add a user to the group and save to database."""
        if not self.check_user_in_group(user):
            member_data = {
                "group_id": self.group_id,
                "user_uuid": user.uuid,
                "joined_at": datetime.now().isoformat()
            }

            existing_members = self.fetch_all_members()
            for member in existing_members:
                # Create two entries in the expense_splits table:
                # 1. The new user owes the existing member 0
                # 2. The existing member owes the new user 0

                split_data_new_to_existing = {
                    "group_id": self.group_id,
                    "user_id": user.uuid,  # New member
                    "opp_user_id": member.uuid,  # Existing member
                    "amount_owed": 0
                }

                split_data_existing_to_new = {
                    "group_id": self.group_id,
                    "user_id": member.uuid,  # Existing member
                    "opp_user_id": user.uuid,  # New member
                    "amount_owed": 0
                }

                # Insert into expense_splits table
                supa.table('expense_splits').insert(split_data_new_to_existing).execute()
                supa.table('expense_splits').insert(split_data_existing_to_new).execute()

            return supa.table('group_members').insert(member_data).execute()

    def fetch_all_members(self):
        """Fetch all members of the group from the database."""
        try:
            # Query the 'group_members' table to get all user UUIDs for the group
            response = supa.table('group_members').select('user_uuid').eq('group_id', self.group_id).execute()
            
            # Check if there are any members in the response
            if response.data:
                # Fetch user details for each user UUID
                members = []
                for member in response.data:
                    user = User.fetch_from_db_by_uuid(member['user_uuid'])
                    if user:
                        members.append(user)
                
                return members
            else:
                return []
        except Exception as e:
            logging.error(f"Error fetching members for group {self.group_id}: {e}")
            return []
    
    @staticmethod
    def fetch_from_db_by_chat(chat_id: int):
        """Fetch a group from the database using the chat_id."""
        try:
            response = supa.table('groups').select("*").eq("chat_id", chat_id).maybe_single().execute()
            group_data = response.data
            if group_data:
                created_by_user = User.fetch_from_db_by_uuid(group_data['created_by'])
                group_instance = Group(
                    group_id=group_data['group_id'],
                    group_name=group_data['group_name'],
                    created_by=created_by_user,
                    chat_id=group_data['chat_id']  # Ensure you pass chat_id

                )
                return group_instance
            else:
                return None
        except Exception as e:
            print(f"No group found: {e}")
            return None

    def delete_from_db(self):
        """Delete the group and related records (members, expenses, splits) from the database."""
        # Delete related data first (group members, expenses, etc.)
        supa.table('group_members').delete().eq('group_id', self.group_id).execute()
        supa.table('expenses').delete().eq('group_id', self.group_id).execute()
        supa.table('groups').delete().eq('group_id', self.group_id).execute()
    
    def remove_member(self, user: User):
        """Delete user from the group_members table in database."""
        # Delete related data first (group members, expenses, etc.)
        supa.table('group_members').delete().eq('user_uuid', user.uuid).execute()
        supa.table('expense_splits').delete().eq('user_id', user.uuid).execute()
        supa.table('expense_splits').delete().eq('opp_user_id', user.uuid).execute()


# Expense Class
class Expense:
    def __init__(self, group: Group, paid_by: User, amount: float, description: str, expense_id: str = None):
        self.expense_id = expense_id or str(uuid.uuid4())
        self.group = group
        self.paid_by = paid_by
        self.amount = amount
        self.description = description
        self.created_at = datetime.now()

    def save_to_db(self):
        """Save the expense to the database."""
        expense_data = {
            "expense_id": self.expense_id,
            "group_id": self.group.group_id,
            "paid_by": self.paid_by.uuid,
            "amount": self.amount,
            "description": self.description,
            "created_at": self.created_at.isoformat()
        }
        return supa.table('expenses').insert(expense_data).execute()

    def add_split(self, user: User, amount_owed: float):
        """Add an expense split for a user."""
        # Check if a split already exists
        response = supa.table('expense_splits').select("*").eq('group_id', self.group.group_id).eq('user_id', user.uuid).eq('opp_user_id', self.paid_by.uuid).single().execute()
        
        if response.data:
            # If it exists, update the amount owed
            new_amount = response.data['amount_owed'] + amount_owed
            supa.table('expense_splits').update({'amount_owed': new_amount}).eq('group_id', self.group.group_id).eq('user_id', user.uuid).eq('opp_user_id', self.paid_by.uuid).execute()
        else:
            # Otherwise, insert a new entry
            split_data = {
                "group_id": self.group.group_id,
                "user_id": user.uuid,  # The user who owes
                "opp_user_id": self.paid_by.uuid,  # The user who is owed
                "amount_owed": amount_owed
            }
            supa.table('expense_splits').insert(split_data).execute()

    def add_split_reverse(self, user: User, amount_owed: float):
        """Add an expense split for a user."""
        # Check if a split already exists
        response = supa.table('expense_splits').select("*").eq('group_id', self.group.group_id).eq('user_id', self.paid_by.uuid).eq('opp_user_id', user.uuid).single().execute()
        
        if response.data:
            # If it exists, update the amount owed
            new_amount = response.data['amount_owed'] + amount_owed
            supa.table('expense_splits').update({'amount_owed': new_amount}).eq('group_id', self.group.group_id).eq('user_id', self.paid_by.uuid).eq('opp_user_id', user.uuid).execute()
        else:
            # Otherwise, insert a new entry
            split_data = {
                "group_id": self.group.group_id,
                "user_id": self.paid_by.uuid,  # The user who owes
                "opp_user_id": user.uuid,  # The user who is owed
                "amount_owed": amount_owed
            }
            supa.table('expense_splits').insert(split_data).execute()

    @staticmethod
    def fetch_expenses_by_group(group: Group):
        """Fetch all expenses for a group."""
        response = supa.table('expenses').select("*").eq('group_id', group.group_id).execute()
        expenses = []
        if response.data:
            for exp in response.data:
                paid_by_user = User.fetch_from_db_by_uuid(exp['paid_by'])
                expenses.append(Expense(group=group, paid_by=paid_by_user, amount=exp['amount'], description=exp['description'], expense_id=exp['expense_id']))
        return expenses

class Settlement:
    def __init__(self, settlement_id: int, from_user: User, to_user: User, amount: float, group: Group):
        self.settlement_id = settlement_id
        self.from_user = from_user
        self.to_user = to_user
        self.amount = amount
        self.group = group
        self.created_at = datetime.now()

    def save_to_db(self):
        """Save the settlement to the database."""
        settlement_data = {
            "settlement_id": self.settlement_id,
            "from_user": self.from_user.user_id,
            "to_user": self.to_user.user_id,
            "amount": self.amount,
            "group_id": self.group.group_id,
            "created_at": self.created_at.isoformat()
        }
        return supa.table('settlements').insert(settlement_data).execute()