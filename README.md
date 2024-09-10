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