# $XVM Telegram Mini App

A Telegram Mini App built with React and TypeScript for XVM - Building the Future of RWA.

## Prerequisites

- Node.js v18+ and npm installed
- Telegram Bot Token (for production deployment)
- A Telegram account for testing

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

The app will open in your browser at `http://localhost:3000`. You can test the app locally in your browser, though some Telegram-specific features may not work outside the Telegram environment.

## Building for Production

Build the application:

```bash
npm run build
```

This will create an optimized production build in the `dist` folder.

## Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

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

## Deployment

### Option 1: Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts
4. Your app will be deployed with a URL like `https://your-app.vercel.app`

### Option 2: Deploy to GitHub Pages

1. Add to `vite.config.ts`:
   ```ts
   base: '/your-repo-name/'
   ```
2. Install gh-pages: `npm install --save-dev gh-pages`
3. Add deploy script to `package.json`:
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```
4. Run `npm run deploy`

### Option 3: Deploy to Your Own Server

1. Build the app: `npm run build`
2. Upload the `dist` folder to your web server
3. Configure your server to serve the `index.html` for all routes

## Testing in Telegram

1. **Desktop Testing:**
   - Open Telegram Desktop
   - Find your bot
   - Click the menu button to launch the Mini App

2. **Mobile Testing:**
   - Open Telegram on your phone
   - Find your bot
   - Tap the menu button to launch the Mini App

3. **Development Testing:**
   - Use [@BotFather](https://t.me/botfather) to set a development URL
   - Use ngrok for local testing: `npx ngrok http 3000`
   - Update your bot's Web App URL with the ngrok URL

## Project Structure

```
xvm-app/
├── src/
│   ├── App.tsx           # Main app component
│   ├── App.css          # App styling
│   ├── main.tsx         # Entry point with Telegram SDK init
│   ├── index.css        # Global styles
│   └── assets/
│       └── logo-placeholder.svg  # Placeholder logo
├── public/              # Static assets
├── index.html          # HTML template
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── vite.config.ts      # Vite configuration
└── README.md          # This file
```

## Features

- ⚫ Black screen design
- 🎨 Responsive layout for mobile devices
- 📱 Telegram Mini App SDK integration
- ⚡ Fast development with Vite
- 🔒 TypeScript for type safety
- 🎯 Optimized for Telegram's WebView

## Customization

### Updating the Logo
Replace `/src/assets/logo-placeholder.svg` with your actual logo file and update the import in `App.tsx`.

### Changing Colors
Edit the styles in `/src/App.css` to customize colors, fonts, and animations.

### Adding Features
The app is ready for expansion. You can add:
- Navigation/routing (React Router)
- State management (Context API, Redux, Zustand)
- Backend integration
- Telegram-specific features (payments, share, etc.)

## Troubleshooting

- **App doesn't load in Telegram:** Ensure your URL is HTTPS and properly configured in BotFather
- **Telegram SDK errors:** The SDK will show console warnings when running outside Telegram - this is normal
- **Build errors:** Make sure you're using Node.js v18+ and have run `npm install`

## License

ISC