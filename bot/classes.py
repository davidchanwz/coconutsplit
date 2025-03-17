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
            "created_at": self.created_at.isoformat(timespec="seconds") # Seralise datetime
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

    @staticmethod
    def fetch_usernames_dict(usernames):
        try:
            response = supa.table('users').select("*").in_("username", usernames).execute()
            user_data = response.data
            username_to_user_dict = {}
            if user_data:
                for user in user_data:
                    username_to_user_dict[user['username']] = User(
                        user_id=user['user_id'],
                        username=user['username'],
                        user_uuid=user['uuid'],
                        currency=user['currency']
                    )
                return username_to_user_dict
            else:
                print(f"A user handle was  not found.")
                return {}
        except Exception as e:
            print(f"Error fetching users by username: {e}")
            return {}

class Group:
    def __init__(self, group_name: str, created_by: User, chat_id: int, group_id: str = None, reminders = False):
        self.group_id = group_id or str(uuid.uuid4())  # Generate UUID if not provided
        self.group_name = group_name
        self.created_by = created_by
        self.chat_id = chat_id
        self.created_at = datetime.now()
        self.reminders = reminders

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
            "created_at": self.created_at.isoformat(timespec="seconds")  # Serialize datetime to ISO 8601 string
        }
        return supa.table('groups').insert(group_data).execute()

    def add_member(self, user: User):
        """Add a user to the group and save to database."""
        if not self.check_user_in_group(user):
            member_data = {
                "group_id": self.group_id,
                "user_uuid": user.uuid,
                "joined_at": datetime.now().isoformat(timespec="seconds")
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

    def fetch_debts_by_group(self):
        """Fetch all splits from the debts table for a given group."""
        response = supa.table('debts').select('*').eq('group_id', self.group_id).execute()
        return response.data
    
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
        supa.table('debts').delete().eq('user_id', user.uuid).execute()
        supa.table('debts').delete().eq('opp_user_id', user.uuid).execute()

    def update_debt(self, user_id: str, opp_user_id: str, amount_owed: float):
        """Update the debt amount between two users in the group."""
        
        # Call the RPC function
        response = supa.rpc("increment_amount_owed", {
            "group_id_param": self.group_id,
            "user_id_param": user_id,
            "opp_user_id_param": opp_user_id,
            "increment_value": -amount_owed  # Change this to the amount to add
        }).execute()

        # Check response
        if "error" in response:
            print("Error incrementing amount owed:", response["error"])
        else:
            print("Amount successfully incremented.")
    
    def delete_latest_expense(self):
        response = supa.rpc("select_latest_expense", {'group_id_param': self.group_id}).execute()

        if response.data:
            expense_entry = response.data[0]
            expense = Expense(
                self,
                None,
                expense_entry['amount'],
                expense_entry['description'],
                expense_entry['created_at'],
                expense_entry['expense_id']
            )
            expense_splits_dict = Expense.fetch_expense_splits_dict([expense])

            debt_updates = []
            for split in expense_splits_dict.get(expense_entry['expense_id'], []):
                debt_details = {
                    "group_id": self.group_id,
                    "user_id": split['user_id'],
                    "opp_user_id": expense_entry['paid_by'],
                    "increment_value": -split['amount']
                }

                reverse_debt_details = {
                    "group_id": self.group_id,
                    "user_id": expense_entry['paid_by'],
                    "opp_user_id": split['user_id'],
                    "increment_value": split['amount']
                }

                debt_updates.append(debt_details)
                debt_updates.append(reverse_debt_details)

            if debt_updates:
                Expense.add_debts_bulk(debt_updates)
                
            supa.table('expenses').delete().eq('expense_id', expense_entry['expense_id']).execute()
        else:
            raise Exception("Nothing to delete! There are no expenses recorded in this group.")
        
    def delete_latest_settlement(self):
        response = supa.rpc("select_latest_settlement", {'group_id_param': self.group_id}).execute()

        if response.data:
            settlement_entry = response.data[0]

            debt_updates = []

            debt_details = {
                "group_id": self.group_id,
                "user_id": settlement_entry['from_user'],
                "opp_user_id": settlement_entry['to_user'],
                "increment_value": settlement_entry['amount']
            }
            reverse_debt_details = {
                "group_id": self.group_id,
                "user_id": settlement_entry['to_user'],
                "opp_user_id": settlement_entry['from_user'],
                "increment_value": -settlement_entry['amount']
            }

            debt_updates.append(debt_details)
            debt_updates.append(reverse_debt_details)

            if debt_updates:
                Expense.add_debts_bulk(debt_updates)
                
            supa.table('settlements').delete().eq('settlement_id', settlement_entry['settlement_id']).execute()
        else:
            raise Exception("Nothing to delete! There are no settlements recorded in this group.")

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
                        reminders=True
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
    def fetch_group_members_usernames_dict(group):
        """Fetch all members of the group using a single database call."""
        try:
            # Call the RPC function to get all members in one query
            response = supa.rpc('get_group_members', {'group_id_param': group.group_id}).execute()
            username_to_user = {}
            
            if response.data:
                # Create User objects from the response data
                for member in response.data:
                    username_to_user[member['username']] = User(
                        user_id=member['user_id'],
                        username=member['username'],
                        user_uuid=member['uuid'],
                        currency=member['currency']
                    )
                return username_to_user
                
            return {}
            
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
                    reminders=group_data['reminders']
                )
                return group_instance
            else:
                return None
        except Exception as e:
            print(f"No group found: {e}")
            return None

# Expense Class
class Expense:
    def __init__(self, group: Group, paid_by: User, amount: float, description: str, created_at: datetime = None, expense_id: str = None):
        self.expense_id = expense_id or str(uuid.uuid4())
        self.group = group
        self.paid_by = paid_by
        self.amount = amount
        self.description = description
        self.created_at = created_at or datetime.now()

    def save_to_db(self):
        """Save the expense to the database."""
        expense_data = {
            "expense_id": self.expense_id,
            "group_id": self.group.group_id,
            "paid_by": self.paid_by.uuid,
            "amount": self.amount,
            "description": self.description,
            "created_at": self.created_at.isoformat(timespec="seconds")
        }
        return supa.table('expenses').insert(expense_data).execute()

    def add_debt(self, user: User, amount_owed: float):
        """Add debt for a user."""
        # Ensure the amount owed is within the allowed range
        if amount_owed >= 10**8:
            raise ValueError(f"Amount owed must be less than {10**8}.")

        # Check if a split already exists
        response = supa.table('debts').select("*").eq('group_id', self.group.group_id).eq('user_id', user.uuid).eq('opp_user_id', self.paid_by.uuid).single().execute()
        
        if response.data:
            # If it exists, update the amount owed
            new_amount = response.data['amount_owed'] + amount_owed
            supa.table('debts').update({'amount_owed': new_amount}).eq('group_id', self.group.group_id).eq('user_id', user.uuid).eq('opp_user_id', self.paid_by.uuid).execute()
        else:
            # Otherwise, insert a new entry
            split_data = {
                "group_id": self.group.group_id,
                "user_id": user.uuid,  # The user who owes
                "opp_user_id": self.paid_by.uuid,  # The user who is owed
                "amount_owed": amount_owed
            }
            supa.table('debts').insert(split_data).execute()

    @staticmethod
    def add_splits_bulk(splits_to_add):
        response = supa.table('expense_splits').insert(splits_to_add).execute()

         # Check response
        if "error" in response:
            print("Error adding bulk split records:", response["error"])
        else:
            print("Bulk split records added successfully.")

    @staticmethod
    def add_debts_bulk(debt_updates):
        # Ensure the amount owed in each debt update is within the allowed range
        for debt in debt_updates:
            if debt['increment_value'] >= 10**8:
                raise ValueError(f"Amount owed must be less than {10**8}.")

        response = supa.rpc("bulk_update_debts", {"debt_updates": debt_updates}).execute()

        # Check response
        if "error" in response:
            print("Error adding bulk debt records:", response["error"])
        else:
            print("Bulk debt records added successfully.")

    @staticmethod
    def fetch_expenses_by_group(group: Group, group_members_dict = None):
        """Fetch all expenses for a group."""
        if not group_members_dict:
            group_members_dict = Group.fetch_group_members_dict(group)
            
        response = supa.table('expenses').select("*").eq('group_id', group.group_id).execute()
        expenses = []
        if response.data:
            for exp in response.data:

                paid_by_user = group_members_dict[exp['paid_by']]

                expenses.append(Expense(
                    group=group, 
                    paid_by=paid_by_user, 
                    amount=exp['amount'], 
                    description=exp['description'], 
                    expense_id=exp['expense_id'],
                    created_at=datetime.fromisoformat(exp['created_at']) if exp['created_at'] else None
                    )),
        
        return expenses
    
    @staticmethod
    def fetch_expense_splits_dict(expenses):
        expense_ids = [expense.expense_id for expense in expenses]
        response = supa.table('expense_splits').select("*").in_('expense_id', expense_ids).execute()
        expense_id_to_expense_splits = {}

        for split in response.data:
            if not expense_id_to_expense_splits.get(split['expense_id']):
                expense_id_to_expense_splits[split['expense_id']] = []
            
            expense_id_to_expense_splits[split['expense_id']].append(split)

        return expense_id_to_expense_splits

class Settlement:
    def __init__(self, from_user: User, to_user: User, amount: float, group: Group, 
                 settlement_id: uuid = None, created_at: datetime = None):
        self.settlement_id = settlement_id or str(uuid.uuid4())
        self.from_user = from_user
        self.to_user = to_user
        self.amount = amount
        self.group = group
        self.created_at = datetime.now()

    def save_to_db(self):
        """Save the settlement to the database."""
        settlement_data = {
            "settlement_id": self.settlement_id,
            "from_user": self.from_user.uuid,
            "to_user": self.to_user.uuid,
            "amount": self.amount,
            "group_id": self.group.group_id,
            "created_at": self.created_at.isoformat(timespec="seconds")
        }
        return supa.table('settlements').insert(settlement_data).execute()
    
    @staticmethod
    def add_settlement_bulk(settlements_to_add):

        settlements_data = []

        for settlement in settlements_to_add:
            # Ensure the amount in each settlement is within the allowed range
            if settlement.amount >= 10**8:
                raise ValueError(f"Settlement amount must be less than {10**8}.")

            settlement_data = {
                "settlement_id": settlement.settlement_id,
                "from_user": settlement.from_user.uuid,
                "to_user": settlement.to_user.uuid,
                "amount": settlement.amount,
                "group_id": settlement.group.group_id,
                "created_at": settlement.created_at.isoformat(timespec="seconds")
            }
            settlements_data.append(settlement_data)

        response = supa.table('settlements').insert(settlements_data).execute()

         # Check response
        if "error" in response:
            print("Error adding bulk settlement records:", response["error"])
        else:
            print("Bulk settlement records added successfully.")


    @staticmethod
    def fetch_settlements_by_group(group: Group):
        """Fetch all settlements for a group."""
        response = supa.table('settlements').select("*").eq('group_id', group.group_id).execute()
        settlements = []
        group_members_dict = Group.fetch_group_members_dict(group)
        if response.data:
            for settlement in response.data:
                from_user = group_members_dict[settlement['from_user']]
                to_user = group_members_dict[settlement['to_user']]
                settlements.append(Settlement(
                    settlement_id=settlement['settlement_id'],
                    from_user=from_user,
                    to_user=to_user,
                    amount=settlement['amount'],
                    group=group,
                    created_at=datetime.fromisoformat(settlement['created_at']) if settlement['created_at'] else None
                ))
        return settlements