# API Guidelines

This document provides guidelines for designing and implementing APIs in the DripIQ project.

## General Principles

- **RESTful**: APIs should follow RESTful principles.
- **JSON**: APIs should use JSON for request and response bodies.
- **Stateless**: APIs should be stateless.
- **Secure**: APIs should be secure.

## Naming Conventions

- **Endpoints**: Use plural nouns for resource names (e.g., `/users`, `/campaigns`).
- **Properties**: Use camelCase for property names (e.g., `firstName`, `lastName`).

## Authentication

- **JWT**: Use JSON Web Tokens for authentication.
- **Authorization Header**: Send the JWT in the `Authorization` header with the `Bearer` scheme.

## Error Handling

- **HTTP Status Codes**: Use appropriate HTTP status codes to indicate the outcome of a request.
- **Error Response Body**: Include a consistent error response body with a message and error code.
