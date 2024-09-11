from typing import List, Dict
from datetime import datetime

class User:
    def __init__(self, user_id: int, username: str, currency: str = "USD"):
        self.user_id = user_id
        self.username = username
        self.currency = currency
        self.created_at = datetime.now()

    def create_group(self, group_name: str):
        return Group(group_id=len(groups) + 1, group_name=group_name, created_by=self)

    def add_expense(self, expense):
        # Placeholder for adding an expense
        print(f"Expense added by {self.username}: {expense}")

    def view_balance(self, group):
        # Placeholder for viewing balance
        print(f"Balance for {self.username} in group {group.group_name}")

    def settle_debt(self, settlement):
        # Placeholder for settling debt
        print(f"{self.username} settled debt: {settlement}")

class Group:
    def __init__(self, group_id: int, group_name: str, created_by: User):
        self.group_id = group_id
        self.group_name = group_name
        self.created_by = created_by
        self.members: List[User] = []
        self.created_at = datetime.now()

    def add_member(self, user: User):
        self.members.append(user)
        print(f"Added {user.username} to group {self.group_name}")

    def get_expenses(self) -> List:
        # Placeholder for getting expenses
        return []

    def get_balance(self):
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

    def add_split(self, user: User, amount: float):
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

    def settle(self):
        print(f"Settling {self.amount} between {self.from_user.username} and {self.to_user.username} in group {self.group.group_name}")