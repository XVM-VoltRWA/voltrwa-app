# $XVM Telegram Mini App

A Telegram Mini App built with React and TypeScript for XVM - Building the Future of RWA.

## Prerequisites

- Node.js v18+ and npm installed
- Telegram Bot Token (for production deployment)
- A Telegram account for testing

## Telegram Bot Setup

To deploy this as a Telegram Mini App:

1. **Create a Telegram Bot:**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` and follow the prompts
   - Save your bot token

2. **Set Up Web App:**
   - Send `/mybots` to BotFather
   - Select your bot
   - Go to "Bot Settings" → "Menu Button" → "Configure menu button"
   - Enter your deployed app URL

3. **Configure Mini App:**
   - Send `/newapp` to BotFather
   - Select your bot
   - Choose a short name for your app
   - Upload app icon (640x360px)
   - Provide your app URL
   - Enter short description

## Testing in Telegram

3. **Development Testing:**
   - Use [@BotFather](https://t.me/botfather) to set a development URL
   - Use ngrok for local testing: `npx ngrok http 3000`
   - Update your bot's Web App URL with the ngrok URL


## License

ISC
