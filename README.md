# Welcome to Coconutsplit

Coconutsplit is a Telegram bot built with [pyTelegramBotAPI](https://pytba.readthedocs.io/en/latest/).

## Directory Structure

```plaintext
/my-telegram-bot
│
├── /bot                    # Bot logic
│   ├── __init__.py
│   ├── bot.py               # Main bot script
│   ├── handlers.py          # Custom message handlers
│   ├── config.py            # Load environment variables
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
└── README.md                # Project documentation