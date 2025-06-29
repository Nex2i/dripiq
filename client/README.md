# DripIQ Client

A modern React application built with the latest technologies and best practices, featuring a comprehensive TanStack ecosystem for robust state management, routing, and data handling.

## 🚀 Tech Stack

### Core Technologies
- **[React 19.0.0](https://react.dev/)** - The latest version of React with cutting-edge features
- **[TypeScript 5.7.2](https://www.typescriptlang.org/)** - Type-safe JavaScript development
- **[Vite 6.1.0](https://vitejs.dev/)** - Lightning-fast build tool and development server
- **[TailwindCSS 4.0.6](https://tailwindcss.com/)** - Utility-first CSS framework with latest v4 features

### TanStack Ecosystem
This project leverages the powerful TanStack ecosystem for a complete modern React development experience:

- **[@tanstack/react-router](https://tanstack.com/router)** - Type-safe routing with file-based routing patterns
- **[@tanstack/react-query](https://tanstack.com/query)** - Powerful data synchronization for React
- **[@tanstack/react-form](https://tanstack.com/form)** - Performant, flexible forms with validation
- **[@tanstack/react-table](https://tanstack.com/table)** - Headless UI for building powerful tables & datagrids
- **[@tanstack/react-store](https://tanstack.com/store)** - Framework agnostic state management

### Development Tools
- **[Vitest 3.0.5](https://vitest.dev/)** - Next generation testing framework
- **[@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/)** - Simple and complete testing utilities
- **[ESLint](https://eslint.org/)** - Code linting with TanStack configuration
- **[Prettier](https://prettier.io/)** - Code formatting with custom configuration
- **Dev Tools Integration** - TanStack Router and Query devtools for debugging

### Additional Libraries
- **[Zod](https://zod.dev/)** - TypeScript-first schema validation
- **[@faker-js/faker](https://fakerjs.dev/)** - Generate fake data for testing and demos
- **[Web Vitals](https://web.dev/vitals/)** - Performance monitoring

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── data/               # Static data and mock data
├── hooks/              # Custom React hooks
├── integrations/       # Third-party service integrations
│   └── tanstack-query/ # TanStack Query setup and providers
├── lib/                # Utility libraries and stores
├── routes/             # Page components and route definitions
├── styles.css          # Global styles and Tailwind imports
└── main.tsx           # Application entry point
```

## 🛠 Development Setup

### Prerequisites
- Node.js (Latest LTS version recommended)
- npm or yarn package manager

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   # or
   npm start
   ```
   The app will be available at `http://localhost:3000`

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run serve
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm start` | Alias for dev command |
| `npm run build` | Build for production |
| `npm run serve` | Preview production build |
| `npm test` | Run tests with Vitest |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |
| `npm run check` | Format code and fix linting issues |

## 🧪 Testing

The project uses **Vitest** as the testing framework with the following setup:
- **jsdom** environment for DOM testing
- **@testing-library/react** for component testing utilities
- Global test utilities enabled
- TypeScript support out of the box

Run tests:
```bash
npm test
```

## 🎨 Styling

The project uses **TailwindCSS v4.0** with:
- Utility-first approach
- Custom configuration via Vite plugin
- Modern CSS features
- Responsive design utilities

## 🔧 Configuration

### TypeScript Configuration
- Target: ES2022
- Strict mode enabled
- Path mapping with `@/*` aliases
- React JSX transform

### Vite Configuration
- React plugin integration
- TailwindCSS plugin
- Path aliases (`@` → `./src`)
- Test environment setup

### Code Style
- **ESLint**: TanStack configuration
- **Prettier**: Semi-colons disabled, single quotes, trailing commas

## 🚦 Routing

The application uses TanStack Router with:
- Type-safe routing
- File-based route organization
- Route-based code splitting
- Built-in devtools integration
- Preloading strategies

## 📊 State Management

Multiple state management solutions for different use cases:
- **TanStack Query**: Server state and caching
- **TanStack Store**: Client-side state management
- **TanStack Form**: Form state and validation
- **React Router**: URL state management

## 🔍 Development Features

- **Hot Module Replacement (HMR)** for instant updates
- **TypeScript IntelliSense** for better development experience
- **ESLint integration** for code quality
- **Prettier integration** for consistent formatting
- **TanStack Devtools** for debugging router and query states

## 🌟 Key Features

- ⚡ Lightning-fast development with Vite
- 🔒 Type-safe throughout with TypeScript
- 🎯 Modern React patterns and hooks
- 📱 Responsive design with TailwindCSS
- 🧪 Comprehensive testing setup
- 🔄 Advanced state management
- 🚀 Production-ready build optimization
- 🛠 Excellent developer experience

---

This client application represents a modern, scalable React setup with industry best practices and cutting-edge technologies.
