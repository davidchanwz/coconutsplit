from typing import List, Dict
from datetime import datetime
from client import supa
import uuid

class User:
    def __init__(self, user_id: int, username: str, user_uuid: str = None, currency: str = "USD"):
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
    def fetch_from_db(user_id: int):
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
    def __init__(self, group_id: int, group_name: str, created_by: User):
        self.group_id = group_id
        self.group_name = group_name
        self.created_by = created_by
        self.members = [created_by]
        self.created_at = datetime.now()

    def save_to_db(self):
        """Save the group to the database."""
        group_data = {
            "group_id": self.group_id,
            "group_name": self.group_name,
            "created_by": self.created_by.user_id,
            "created_at": self.created_at
        }
        return supa.table('groups').insert(group_data).execute()

    def add_member(self, user: User):
        """Add a user to the group and save to database."""
        if user not in self.members:
            self.members.append(user)
            member_data = {
                "group_id": self.group_id,
                "user_id": user.user_id,
                "joined_at": datetime.now()
            }
            return supa.table('group_members').insert(member_data).execute()

    @staticmethod
    def fetch_from_db(group_id: int):
        """Fetch a group from the database and create a Group instance."""
        response = supa.table('groups').select("*").eq("group_id", group_id).single().execute()
        group_data = response.data
        if group_data:
            created_by_user = User.fetch_from_db(group_data['created_by'])
            group_instance = Group(group_id=group_data['group_id'], group_name=group_data['group_name'], created_by=created_by_user)
            return group_instance
        return None
        # Placeholder for getting the group's balance
        return 0

class Expense:
    def __init__(self, expense_id: int, group: Group, paid_by: User, amount: float, description: str):
        self.expense_id = expense_id
        self.group = group
        self.paid_by = paid_by
        self.amount = amount
        self.description = description
        self.created_at = datetime.now()
        self.splits: Dict[User, float] = {}

    def save_to_db(self):
        """Save the expense to the database."""
        expense_data = {
            "expense_id": self.expense_id,
            "group_id": self.group.group_id,
            "paid_by": self.paid_by.user_id,
            "amount": self.amount,
            "description": self.description,
            "created_at": self.created_at
        }
        return supa.table('expenses').insert(expense_data).execute()

    def add_split(self, user: User, amount: float):
        """Add a split for the expense."""
        self.splits[user] = amount
        split_data = {
            "expense_id": self.expense_id,
            "user_id": user.user_id,
            "amount_owed": amount
        }
        return supa.table('expense_splits').insert(split_data).execute()

    @staticmethod
    def fetch_from_db(expense_id: int):
        """Fetch an expense from the database and create an Expense instance."""
        response = supa.table('expenses').select("*").eq("expense_id", expense_id).single().execute()
        expense_data = response.data
        if expense_data:
            group = Group.fetch_from_db(expense_data['group_id'])
            paid_by_user = User.fetch_from_db(expense_data['paid_by'])
            expense_instance = Expense(
                expense_id=expense_data['expense_id'], 
                group=group, 
                paid_by=paid_by_user, 
                amount=expense_data['amount'], 
                description=expense_data['description']
            )
            return expense_instance
        return None
        self.splits[user] = amount
        print(f"Added split for {user.username}: {amount}")

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
            "created_at": self.created_at
        }
        return supa.table('settlements').insert(settlement_data).execute()