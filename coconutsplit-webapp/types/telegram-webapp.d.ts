interface TelegramWebApp {
  close: () => void;
}

interface Window {
  Telegram: {
    WebApp: TelegramWebApp;
  };
} 