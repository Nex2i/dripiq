
# Gemini Codebase Index

This document provides a comprehensive overview of the DripIQ project, indexed for the Gemini AI assistant.

## Project Overview

**DripIQ** is an AI-powered Salesforce re-engagement platform designed to convert closed-lost leads into opportunities through intelligent drip campaigns and multi-channel engagement.

- **Target Users**: Account Executives, Sales Managers, RevOps Teams, and Salesforce Admins.
- **Core Functionality**: Automated follow-ups, AI-driven research and messaging, multi-channel outreach (email, SMS, voice, video), and performance analytics.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, TanStack (Router, Query, Form, Table, Store), Supabase (Auth).
- **Backend**: Node.js, Fastify, TypeScript, Drizzle ORM, PostgreSQL, Supabase (Auth), JWT, Swagger.
- **Database**: PostgreSQL with a multi-tenant architecture.

## Project Structure

The project is a monorepo with two main packages: `client` and `server`.

- `client/`: The React frontend application.
  - `src/components/`: Reusable UI components.
  - `src/contexts/`: React contexts, primarily for authentication.
  - `src/pages/`: Application pages, including dashboard, landing, and auth pages.
  - `src/services/`: Services for interacting with the backend API.
  - `src/router.tsx`: Defines the application's routing structure.
- `server/`: The Fastify backend application.
  - `src/db/`: Database schema, migrations, and seeding.
  - `src/modules/`: Business logic services (e.g., `user.service.ts`, `tenant.service.ts`).
  - `src/routes/`: API route definitions.
  - `src/plugins/`: Fastify plugins, such as for authentication and Swagger documentation.
  - `src/app.ts`: The main Fastify application setup.

## Key Files and Code Snippets

### Frontend

- **`client/src/main.tsx`**: The entry point of the React application, setting up providers for TanStack Query, Auth, and the Router.
- **`client/src/router.tsx`**: Configures the application's routes using TanStack Router, including protected routes that require authentication.
- **`client/src/contexts/AuthContext.tsx`**: Manages authentication state, providing user and session information, and functions for login, logout, and registration.
- **`client/src/services/auth.service.ts`**: Handles communication with the backend for authentication-related tasks.

### Backend

- **`server/src/app.ts`**: Configures the Fastify server, registers plugins, and sets up middleware.
- **`server/src/db/schema.ts`**: Defines the database schema using Drizzle ORM, including `users`, `tenants`, and `user_tenants` tables to support the multi-tenant architecture.
- **`server/src/modules/user.service.ts`**: Provides methods for user-related database operations.
- **`server/src/modules/tenant.service.ts`**: Manages tenants and their relationships with users.
- **`server/src/routes/authentication.routes.ts`**: Defines authentication-related API endpoints, such as `/register` and `/me`.
- **`server/src/plugins/authentication.plugin.ts`**: A Fastify plugin that handles JWT validation and attaches user information to requests.

## How to Run the Project

1.  **Install dependencies** for both the `client` and `server` packages using `npm install`.
2.  **Set up environment variables** by creating `.env` files in both the `client` and `server` directories, based on the provided `.env.example` files.
3.  **Run database migrations** from the `server` directory with `npm run db:migrate`.
4.  **Start the development servers**:
    - Backend: `npm run dev` in the `server` directory.
    - Frontend: `npm run dev` in the `client` directory.
