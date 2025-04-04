# bot/classes.py

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
            "created_at": self.created_at.isoformat(timespec="microseconds"), # Seralise datetime
        }
        return supa.table('users').insert(user_data).execute()
    
    def update_username(self, new_username: str):
        """Update the username of the user."""
        self.username = new_username
        supa.table('users').update({"username": new_username}).eq("uuid", self.uuid).execute()

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

class Group:
    def __init__(self, group_name: str, created_by: User, chat_id: int, group_id: str = None, reminders = False, message_id = None):
        self.group_id = group_id or str(uuid.uuid4())  # Generate UUID if not provided
        self.group_name = group_name
        self.created_by = created_by
        self.chat_id = chat_id
        self.created_at = datetime.now()
        self.reminders = reminders
        self.message_id = message_id  # Initialize with provided message_id or None

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
            "created_at": self.created_at.isoformat(timespec="microseconds"),  # Serialize datetime to ISO 8601 string,
            "message_id": self.message_id
        }
        return supa.table('groups').upsert(group_data, on_conflict='group_id').execute()

    def add_member(self, user: User):
        """Add a user to the group and save to database."""
        if not self.check_user_in_group(user):
            member_data = {
                "group_id": self.group_id,
                "user_uuid": user.uuid,
                "joined_at": datetime.now().isoformat(timespec="microseconds")
            }

            existing_members = self.fetch_all_members()
            debt_entries = []
            for member in existing_members:
                # Create two entries in the debts table:
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

                # Insert into debts table
                debt_entries.append(split_data_existing_to_new)
                debt_entries.append(split_data_new_to_existing)
                
            if debt_entries:
                supa.table('debts').insert(debt_entries).execute()
                
            return supa.table('group_members').insert(member_data).execute()

    def fetch_all_members(self):
        """Fetch all members of the group using a single database call."""
        try:
            # Call the RPC function to get all members in one query
            response = supa.rpc('get_group_members', {'group_id_param': self.group_id}).execute()
            
            if response.data:
                # Create User objects from the response data
                members = [
                    User(
                        user_id=member['user_id'],
                        username=member['username'],
                        user_uuid=member['uuid'],
                        currency=member['currency']
                    ) for member in response.data
                ]
                return members
            return []
            
        except Exception as e:
            logging.error(f"Error fetching members for group {self.group_id}: {e}")
            return []
    
    def delete_from_db(self):
        """Delete the group and related records (members, expenses, splits) from the database."""
        # Delete related data first (group members, expenses, etc.)
        supa.table('group_members').delete().eq('group_id', self.group_id).execute()
        supa.table('expenses').delete().eq('group_id', self.group_id).execute()
        supa.table('groups').delete().eq('group_id', self.group_id).execute()

    @staticmethod
    def get_groups_with_reminders_on():
        """
        Fetch all groups that have reminders enabled and return them as Group objects.
        Returns:
            list[Group]: List of Group objects with reminders enabled
        """
        try:
            response = supa.table('groups').select("*").eq("reminders", True).execute()
            groups = []
            
            if response.data:
                for group_data in response.data:
                    # Create temporary User object for created_by
                    created_by_user = User(
                        user_id=0,  # placeholder
                        username="deleted_user",  # placeholder
                        user_uuid=group_data['created_by']
                    )
                    
                    # Create Group object
                    group = Group(
                        group_id=group_data['group_id'],
                        group_name=group_data['group_name'],
                        created_by=created_by_user,
                        chat_id=group_data['chat_id'],
                        reminders=True,
                        message_id=group_data.get('message_id')  # Load message_id from database
                    )
                    groups.append(group)
                    
            return groups
        except Exception as e:
            raise Exception(f"Error fetching groups with reminders on: {str(e)}")
        
    def toggle_reminders(self):
        try:
            if self.reminders:
                supa.table("groups").update({"reminders": False}).eq("group_id", self.group_id).execute()
                self.reminders = False
                print("Reminders turned off for {self.group_id}.")
            else:
                supa.table("groups").update({"reminders": True}).eq("group_id", self.group_id).execute()
                self.reminders = True
                print("Reminders turned on for {self.group_id}.")
        except Exception as e: 
            print(f"Error toggling reminders for group {self.group_id}: {str(e)}")

    @staticmethod
    def fetch_group_members_dict(group):
        """Fetch all members of the group using a single database call."""
        try:
            # Call the RPC function to get all members in one query
            response = supa.rpc('get_group_members', {'group_id_param': group.group_id}).execute()
            user_id_to_user = {}
            
            if response.data:
                # Create User objects from the response data
                for member in response.data:
                    user_id_to_user[member['uuid']] = User(
                        user_id=member['user_id'],
                        username=member['username'],
                        user_uuid=member['uuid'],
                        currency=member['currency']
                    )
             
            return user_id_to_user
            
        except Exception as e:
            logging.error(f"Error fetching members for group {group.group_id}: {e}")
            return {}
    
    @staticmethod
    def fetch_from_db_by_chat(chat_id: int):
        """Fetch a group from the database using the chat_id."""
        try:
            response = supa.table('groups').select("*").eq("chat_id", chat_id).maybe_single().execute()
            group_data = response.data
            if group_data:
                created_by_user = User(user_id=0, username="deleted_user", user_uuid=group_data['created_by'])
                group_instance = Group(
                    group_id=group_data['group_id'],
                    group_name=group_data['group_name'],
                    created_by=created_by_user,
                    chat_id=group_data['chat_id'],
                    reminders=group_data['reminders'],
                    message_id=group_data.get('message_id')  
                )
                return group_instance
            else:
                return None
        except Exception as e:
            print(f"No group found: {e}")
            return None