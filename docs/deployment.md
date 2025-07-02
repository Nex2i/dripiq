# Deployment

This document provides guidelines for deploying the DripIQ project.

## Prerequisites

- Docker
- AWS/Azure account

## Frontend

- **Build**: `npm run build`
- **Deploy**: Deploy the `client/dist` directory to a static hosting service like Netlify, Vercel, or AWS S3 + CloudFront.

## Backend

- **Build**: `npm run build`
- **Deploy**: Deploy the `server/dist` directory to a Node.js hosting service like Railway, Heroku, or AWS ECS.

## Database

- **Migrations**: Run database migrations before deploying the backend.
- **Seeding**: Seed the database with initial data.
