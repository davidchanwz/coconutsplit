from classes import Group
\
def is_group_chat(message):
    """Check if the message is from a group chat"""
    return message.chat.type in ['group', 'supergroup']

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

        # Sort creditors and debtors by their balances
        creditors.sort(key=lambda x: x[1], reverse=True)  # Sort by amount owed, descending
        debtors.sort(key=lambda x: x[1], reverse=True)  # Sort by amount owed, descending

        simplified_debts = []
        while creditors and debtors:
            creditor_id, credit_amount = creditors.pop()
            debtor_id, debt_amount = debtors.pop()

            # Calculate the minimum of what the debtor owes and what the creditor is owed
            amount = min(credit_amount, debt_amount)

            # Record this transaction
            if amount >= 0.01:
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

def get_display_debts_string(debts, group):
    """Format and display simplified debts in the group."""
    debt_messages = []

    group_members_dict = Group.fetch_group_members_dict(group)

    for debtor_id, creditor_id, amount in debts:
        debtor = group_members_dict[debtor_id]
        creditor = group_members_dict[creditor_id]
        debt_messages.append(f"{debtor.username} owes {creditor.username} ${amount:.2f}")

    return "\n".join(debt_messages)

def get_display_debts_string_with_at(debts, group):
    """Format and display simplified debts in the group."""
    debt_messages = []

    group_members_dict = Group.fetch_group_members_dict(group)

    for debtor_id, creditor_id, amount in debts:
        debtor = group_members_dict[debtor_id]
        creditor = group_members_dict[creditor_id]
        debt_messages.append(f"@{debtor.username} owes @{creditor.username} ${amount:.2f}")

    debt_messages.reverse()
    return "\n".join(debt_messages)

def process_reminders():
    groups = Group.get_groups_with_reminders_on()

    chat_id_to_display_debts_string = {}

    if groups:
        for group in groups:
            debts = group.fetch_debts_by_group()
            if debts:
                user_balances = calculate_user_balances(debts)
                simplified_debts = simplify_debts(user_balances)
                chat_id = group.chat_id
                if simplified_debts:
                    display_debts_string = get_display_debts_string_with_at(simplified_debts, group)
                    chat_id_to_display_debts_string[chat_id] = display_debts_string
    
    return chat_id_to_display_debts_string

def remove_underscore_markdown(text: str) -> str:
    """Escape Markdown special characters in a string."""
    return text.replace("_", "\\_")