# 🚀 DripIQ
[Production URL](https://dripiq.ai)

## Production Deployed status
[![Landing Page Status](https://api.netlify.com/api/v1/badges/db5a9b51-49f9-4536-8089-1f3e9aeed18f/deploy-status)](https://app.netlify.com/projects/dripiqlanding/deploys)
 [![Main App Status](https://api.netlify.com/api/v1/badges/2a1b21a4-335d-41f6-bc97-ca2953815e63/deploy-status)](https://app.netlify.com/projects/dripiq-app/deploys)

> *"Automated, intelligent follow-up for your lost leads."*

An AI-powered Salesforce re-engagement platform that transforms closed-lost leads into high-converting opportunities using intelligent drip campaigns, deep personalized outreach, and multi-channel engagement.

### First Commit - June 26 2025

## 📋 Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## 🎯 About

DripIQ solves the critical problem of lost sales opportunities by automating the re-engagement process. Instead of letting closed-lost leads disappear forever, our platform uses AI to research prospects, craft personalized messages, and execute multi-touch campaigns across email, SMS, voice, and video channels.

### Target Users

- **Account Executives (AEs)** – Recover deals without manual follow-up
- **Sales Managers / Directors** – Improve pipeline health and forecasting
- **Revenue Operations Teams** – Gain automation and ROI visibility
- **Salesforce Admins** – Easy plug-and-play integration

## ✨ Features

### 🔁 Closed-Lost Sync
- Native Salesforce integration (OAuth + REST API)
- Real-time and scheduled syncing of Closed-Lost Opportunities
- Advanced filtering (time-based, product line, deal size, region)
- Custom field mapping and lead enrichment

### 🤖 AI-Powered Research & Copywriting
- Automated per-lead research using public web data and Salesforce history
- Personalized message generation (not templates)
- Industry-specific pain point analysis
- Multi-format content creation (emails, PDFs, voicemail scripts)

### 🧠 Drip Campaign Engine
- Rules-based and ML-enhanced timing optimization
- Multi-touch, multi-channel campaigns
- Engagement scoring and auto-adjustment
- Response-based campaign flow modification

### 📹 Tailored Video & Voice Outreach
- AI script generation using lead data
- Text-to-voice integration (ElevenLabs API)
- Video message capabilities
- Persona-matched content and tone

### 📊 Analytics Dashboard
- Campaign performance tracking
- Revenue recovery metrics
- Team performance insights
- Exportable reports and KPI monitoring

## 🛠 Tech Stack

### Frontend
- **[React 19.0.0](https://react.dev/)** - The latest version of React with cutting-edge features
- **[TypeScript 5.7.2](https://www.typescriptlang.org/)** - Type-safe JavaScript development
- **[Vite 6.1.0](https://vitejs.dev/)** - Lightning-fast build tool and development server
- **[TailwindCSS 4.0.6](https://tailwindcss.com/)** - Utility-first CSS framework with latest v4 features
- **[@tanstack/react-router](https://tanstack.com/router)** - Type-safe routing with file-based routing patterns
- **[@tanstack/react-query](https://tanstack.com/query)** - Powerful data synchronization for React
- **[@tanstack/react-form](https://tanstack.com/form)** - Performant, flexible forms with validation
- **[@tanstack/react-table](https://tanstack.com/table)** - Headless UI for building powerful tables & datagrids
- **[@tanstack/react-store](https://tanstack.com/store)** - Framework agnostic state management
- **[Zod](https://zod.dev/)** - TypeScript-first schema validation

### Backend
- **[Node.js](https://nodejs.org/)** with **[Fastify](https://www.fastify.io/)**
- **[TypeScript](https://www.typescriptlang.org/)** for type safety
- **[Drizzle ORM](https://orm.drizzle.team/)** with **[PostgreSQL](https://www.postgresql.org/)**
- **[JWT](https://jwt.io/)** authentication
- **[Supabase](https://supabase.com/)** integration
- **[OpenAI/Claude](https://www.anthropic.com/claude)** for AI capabilities

### Infrastructure
- **[PostgreSQL](https://www.postgresql.org/)** database
- **[Supabase](https://supabase.com/)** for auth and real-time features
- **[AWS/Azure](https://aws.amazon.com/)** hosting ready
- **[Docker](https://www.docker.com/)** containerization support

### Third-Party Integrations
- **[Salesforce API](https://developer.salesforce.com/docs/apis)** (OAuth, REST)
- **[ElevenLabs](https://beta.elevenlabs.io/)** (Text-to-Speech)
- **[Twilio](https://www.twilio.com/)** (SMS, Voice)
- **[SendGrid/Mailgun](https://sendgrid.com/)** (Email)
- **[Calendar APIs](https://developers.google.com/calendar)** (Google/Outlook)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/dripiq.git
   cd dripiq
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install
   
   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup**
   
   **Server (.env)**
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Configure your environment variables:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/dripiq"
   
   # Authentication
   JWT_SECRET="your-jwt-secret"
   SUPABASE_URL="your-supabase-url"
   SUPABASE_ANON_KEY="your-supabase-anon-key"
   
   # API Keys
   OPENAI_API_KEY="your-openai-api-key"
   ELEVENLABS_API_KEY="your-elevenlabs-api-key"
   TWILIO_ACCOUNT_SID="your-twilio-sid"
   TWILIO_AUTH_TOKEN="your-twilio-token"
   SENDGRID_API_KEY="your-sendgrid-key"
   
   # Salesforce
   SALESFORCE_CLIENT_ID="your-salesforce-client-id"
   SALESFORCE_CLIENT_SECRET="your-salesforce-client-secret"
   ```

   **Client (.env)**
   ```bash
   cd client
   cp .env.example .env
   ```
   
   ```env
   VITE_API_BASE_URL="http://localhost:3001"
   VITE_SUPABASE_URL="your-supabase-url"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   ```

4. **Database Setup**
   ```bash
   cd server
   
   # Run migrations
   npm run db:migrate
   
   # Seed database (optional)
   npm run db:seed
   ```

5. **Start Development Servers**
   
   **Terminal 1 - Backend**
   ```bash
   cd server
   npm run dev
   ```
   
   **Terminal 2 - Frontend**
   ```bash
   cd client
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/docs

## 📁 Project Structure

```
dripiq/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   └── lib/            # Utility libraries
│   ├── public/             # Static assets
│   └── package.json
├── server/                 # Node.js backend application
│   ├── src/
│   │   ├── db/             # Database schema and migrations
│   │   ├── modules/        # Business logic modules
│   │   ├── routes/         # API route definitions
│   │   ├── plugins/        # Fastify plugins
│   │   ├── libs/           # External service integrations
│   │   └── utils/          # Utility functions
│   └── package.json
├── docs/                   # Documentation
└── README.md
```

## 🔧 Development

### Available Scripts

**Server**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm run test         # Run tests
npm run lint         # Run ESLint
```

**Client**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run tests
npm run lint         # Run ESLint
```

### Code Style

- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Conventional Commits** for commit messages

### Testing

- **Backend**: Jest with Supertest for API testing
- **Frontend**: Vitest with React Testing Library

## 📚 API Documentation

API documentation is automatically generated using Swagger and available at:
- Development: http://localhost:3001/docs
- Production: https://api.dripiq.com/docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.dripiq.com](https://docs.dripiq.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/dripiq/issues)
- **Email**: support@dripiq.com

---

**Built with ❤️ by the DripIQ team**
