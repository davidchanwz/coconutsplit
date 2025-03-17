from classes import Group, User, Expense
import re

def simplify_debts(balances):
        """Simplify debts by finding who owes what to whom."""
        creditors = []
        debtors = []

        # Split users into creditors (positive balance) and debtors (negative balance)
        for user_id, balance in balances.items():
            if balance > 0:
                creditors.append((user_id, balance))  # Users who are owed money
            elif balance < 0:
                debtors.append((user_id, -balance))  # Users who owe money

        simplified_debts = []
        while creditors and debtors:
            creditor_id, credit_amount = creditors.pop()
            debtor_id, debt_amount = debtors.pop()

            # Calculate the minimum of what the debtor owes and what the creditor is owed
            amount = min(credit_amount, debt_amount)

            # Record this transaction
            simplified_debts.append((debtor_id, creditor_id, amount))

            # Adjust the remaining balances
            credit_amount -= amount
            debt_amount -= amount

            # If there's remaining debt, push the debtor back
            if debt_amount > 0:
                debtors.append((debtor_id, debt_amount))

            # If there's remaining credit, push the creditor back
            if credit_amount > 0:
                creditors.append((creditor_id, credit_amount))

        return simplified_debts

def calculate_user_balances(debts):
        """Calculate the net balances for each user based on expense splits."""
        balances = {}

        # Process each split, but only handle the "positive" direction (one-way) to avoid double counting
        for debt in debts:
            user_id = debt['user_id']
            opp_user_id = debt['opp_user_id']
            amount_owed = debt['amount_owed']

            # Only consider debts where amount_owed > 0 (ignore the reverse row where the amount is negative)
            if amount_owed > 0:
                # Update balances for the user who owes
                if user_id not in balances:
                    balances[user_id] = 0
                balances[user_id] -= amount_owed  # This user owes money

                # Update balances for the opposite user who is owed
                if opp_user_id not in balances:
                    balances[opp_user_id] = 0
                balances[opp_user_id] += amount_owed  # The opposite user is owed money

        return balances

def process_add_expense(group: Group, user: User, input_text: str):
        """
        Processes the /add_expense command input and updates the debts table accordingly.

        Args:
            group (Group): The group where the expense is being added.
            user (User): The user who created the expense (payer).
            input_text (str): The input text in the format provided by the user.

        Returns:
            None
        """
        # Step 1: Parse the input
        if not input_text:
            raise Exception("Please send a proper text!")

        lines = input_text.strip().split('\n')

        if len(lines) < 2:
            raise Exception("Please follow the format given!")

        # Parse the expense name and total amount
        expense_name = lines[0]
        try:
            expense_amount = float(lines[1])
        except ValueError:
            raise ValueError(f"Please key in a valid number for expense amount!")

        if expense_amount <= 0:
            raise ValueError(f"Expense amount must be more than 0!")

        # Ensure the expense amount is within the allowed range
        if expense_amount >= 10**8:
            raise ValueError(f"Expense amount must be less than {10**8}.")

        # Step 2: Parse tagged users and their amounts
        tagged_with_amount = {}
        tagged_without_amount = []
        total_tagged_amount = 0

        group_members_username_dict = Group.fetch_group_members_usernames_dict(group)

        tagged_users_so_far = []

        for line in lines[2:]:
            match_with_amount = re.match(r'@(\w+)\s+(\d+(\.\d+)?)', line.strip())
            match_without_amount = re.match(r'@(\w+)', line.strip())
            tagged_user = None

            if not match_with_amount and not match_without_amount:
                continue # ignore invalid lines

            if match_with_amount:
                # User with a specific amount
                username = match_with_amount.group(1)
                amount = float(match_with_amount.group(2))
                # Ensure the amount is within the allowed range
                if amount >= 10**8:
                    raise ValueError(f"Tagged amount must be less than {10**8}.")
                tagged_user = group_members_username_dict.get(username)
                if tagged_user:
                    tagged_with_amount[tagged_user] = amount
                    total_tagged_amount += amount
                else:
                    raise ValueError(f"{username} is not a member of this group.")

            elif match_without_amount:
                # User without a specific amount (to split remaining amount)
                username = match_without_amount.group(1)
                tagged_user = group_members_username_dict.get(username)
                if tagged_user:
                    tagged_without_amount.append(tagged_user)
                else:
                    raise ValueError(f"{username} is not a member of this group.")
                
            if tagged_user in tagged_users_so_far:
                raise ValueError(f"Please do not tag the same person more than once!")
            else:
                tagged_users_so_far.append(tagged_user)

        if total_tagged_amount > expense_amount:
            raise ValueError(f"Total tagged amount ${total_tagged_amount:.2f} exceeds the expense amount ${expense_amount:.2f}.")


        # Step 3: Calculate the remaining amount to be split among users with no specific amount
        remaining_amount = expense_amount - total_tagged_amount

        if tagged_without_amount:
            split_amount_per_user = remaining_amount / (len(tagged_without_amount) + 1)
        else:
            split_amount_per_user = 0

        # Ensure the split amount per user is within the allowed range
        if split_amount_per_user >= 10**8:
            raise ValueError(f"Split amount per user must be less than {10**8}.")

        # Step 4: Create the expense entry in the database
        expense = Expense(group=group, paid_by=user, amount=expense_amount, description=expense_name)
        expense.save_to_db()

        debt_updates = []
        splits_to_add = []

        # Step 5: Update expense splits for users tagged with specific amounts
        for tagged_user, amount in tagged_with_amount.items():
            debt_details = {
                "group_id": expense.group.group_id,
                "user_id": tagged_user.uuid,
                "opp_user_id": expense.paid_by.uuid,
                "increment_value": amount
            }

            reverse_debt_details = {
                "group_id": expense.group.group_id,
                "user_id": expense.paid_by.uuid,
                "opp_user_id": tagged_user.uuid,
                "increment_value": -amount
            }

            debt_updates.append(debt_details)
            debt_updates.append(reverse_debt_details)

            split_details = {
                "user_id" : tagged_user.uuid,
                "expense_id": expense.expense_id,
                "amount": amount
            }

            splits_to_add.append(split_details)
            

        # Step 6: Update expense splits for users tagged without specific amounts (split the remaining amount)
        for tagged_user in tagged_without_amount:
            debt_details = {
                "group_id": expense.group.group_id,
                "user_id": tagged_user.uuid,
                "opp_user_id": expense.paid_by.uuid,
                "increment_value": split_amount_per_user
            }

            reverse_debt_details = {
                "group_id": expense.group.group_id,
                "user_id": expense.paid_by.uuid,
                "opp_user_id": tagged_user.uuid,
                "increment_value": -split_amount_per_user
            }

            debt_updates.append(debt_details)
            debt_updates.append(reverse_debt_details)

            split_details = {
                "user_id" : tagged_user.uuid,
                "expense_id": expense.expense_id,
                "amount": split_amount_per_user
            }

            splits_to_add.append(split_details)
            
        if debt_updates:
            Expense.add_debts_bulk(debt_updates)

        if splits_to_add:
            Expense.add_splits_bulk(splits_to_add)

        print("Expense processing complete.")