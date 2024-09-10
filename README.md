# Welcome to Coconutsplit

Coconutsplit is a Telegram bot built with [pyTelegramBotAPI](https://pytba.readthedocs.io/en/latest/).

## Directory Structure

```plaintext
/my-telegram-bot
│
├── /bot                    # Bot logic
│   ├── bot.py               # Main bot script
│   ├── handlers.py          # Custom message handlers
│
├── /web_app                 # Web app folder
│   ├── index.html           # Web app HTML
│   ├── style.css            # Styling
│   ├── script.js            # Web app logic
│
├── .env                     # Environment variables (bot token, etc.)
├── .gitignore               # Ignoring sensitive files (.env, .venv)
├── /venv                    # Virtual environment
│   └── ...
├── requirements.txt         # Python dependencies
├── Procfile                 # Logic for Heroku deployment
└── README.md                # Project documentation
```

## Database Schema

The following database schema outlines the structure used in Supabase to store user and expense data for the CoconutSplit bot.

### Users Table

Stores information about the users.

```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    currency TEXT DEFAULT 'USD'
);
```

| Column      | Type      | Description                          |
| ----------- | --------- | ------------------------------------ |
| `user_id`   | BIGINT    | Unique identifier for the user        |
| `username`  | TEXT      | The user's display name or username   |
| `created_at`| TIMESTAMP | The time when the user was created    |
| `currency`  | TEXT      | The user's preferred currency (optional) |

---

### Groups Table

Stores information about the groups users create.

```sql
CREATE TABLE groups (
    group_id BIGINT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    group_name TEXT NOT NULL,
    created_by BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

| Column       | Type      | Description                          |
| ------------ | --------- | ------------------------------------ |
| `group_id`   | BIGINT    | Unique identifier for the group      |
| `group_name` | TEXT      | The name of the group                |
| `created_by` | BIGINT    | ID of the user who created the group |
| `created_at` | TIMESTAMP | The time when the group was created  |

---

### Group Members Table

Stores the relationship between users and groups.

```sql
CREATE TABLE group_members (
    group_id BIGINT REFERENCES groups(group_id),
    user_id BIGINT REFERENCES users(user_id),
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);
```

| Column      | Type      | Description                          |
| ----------- | --------- | ------------------------------------ |
| `group_id`  | BIGINT    | ID of the group                      |
| `user_id`   | BIGINT    | ID of the user                       |
| `joined_at` | TIMESTAMP | Time when the user joined the group  |

---

### Expenses Table

Stores information about the expenses created in each group.

```sql
CREATE TABLE expenses (
    expense_id BIGINT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    group_id BIGINT REFERENCES groups(group_id),
    paid_by BIGINT REFERENCES users(user_id),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

| Column       | Type      | Description                          |
| ------------ | --------- | ------------------------------------ |
| `expense_id` | BIGINT    | Unique identifier for the expense    |
| `group_id`   | BIGINT    | ID of the group                      |
| `paid_by`    | BIGINT    | ID of the user who paid              |
| `amount`     | DECIMAL   | Total amount of the expense          |
| `description`| TEXT      | Description of the expense           |
| `created_at` | TIMESTAMP | Time when the expense was created    |

---

### Expense Splits Table

Stores how expenses are split among group members.

```sql
CREATE TABLE expense_splits (
    expense_id BIGINT REFERENCES expenses(expense_id),
    user_id BIGINT REFERENCES users(user_id),
    amount_owed DECIMAL(10, 2),
    PRIMARY KEY (expense_id, user_id)
);
```

| Column        | Type      | Description                          |
| ------------- | --------- | ------------------------------------ |
| `expense_id`  | BIGINT    | ID of the expense                    |
| `user_id`     | BIGINT    | ID of the user who owes              |
| `amount_owed` | DECIMAL   | Amount owed by the user              |

---

### Settlements Table

Tracks payments made between users to settle debts.

```sql
CREATE TABLE settlements (
    settlement_id BIGINT PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    from_user BIGINT REFERENCES users(user_id),
    to_user BIGINT REFERENCES users(user_id),
    amount DECIMAL(10, 2),
    group_id BIGINT REFERENCES groups(group_id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

| Column         | Type      | Description                          |
| -------------- | --------- | ------------------------------------ |
| `settlement_id`| BIGINT    | Unique identifier for the settlement |
| `from_user`    | BIGINT    | User ID of the payer                 |
| `to_user`      | BIGINT    | User ID of the recipient             |
| `amount`       | DECIMAL   | Amount settled                      |
| `group_id`     | BIGINT    | ID of the group (optional)           |
| `created_at`   | TIMESTAMP | Time when the settlement was created |

## User Flow Chart
```mermaid
graph TD
    A[/Start/] --> B[Bot lists main commands]
    
    B --> C[/User sends /create_group/]
    C --> D[Bot asks for group name]
    D --> E[User inputs group name]
    E --> F[Bot asks to add members]
    F --> G[User inputs members]
    G --> H[Bot confirms group]

    B --> I[/User sends /add_expense/]
    I --> J[Bot asks for group]
    J --> K[User selects group]
    K --> L[Bot asks for amount & desc]
    L --> M[User inputs amount & desc]
    M --> N[Bot asks who paid]
    N --> O[User inputs payer]
    O --> P[Bot asks for split option]
    P --> Q[User selects split option]
    Q --> R[Bot confirms expense]

    B --> S[/User sends /view_balance/]
    S --> T[Bot shows balances]

    B --> U[/User sends /settle_debt/]
    U --> V[Bot asks for group & user]
    V --> W[User selects group & user]
    W --> X[Bot asks for amount]
    X --> Y[User inputs amount]
    Y --> Z[Bot confirms settlement]

    B --> AA[/User sends /help/]
    AA --> AB[Bot lists commands]