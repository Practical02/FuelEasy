# DieselTrack - Trading Management System

## Overview

DieselTrack is a comprehensive diesel fuel trading business management system built with a modern full-stack architecture. The application provides functionality for stock tracking, client management, sales processing, payment recording, and business reporting. It's designed to handle the complete workflow of a diesel trading business from inventory management to financial tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Library**: Radix UI components with Tailwind CSS styling
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon serverless database
- **Validation**: Zod schemas shared between client and server

### Project Structure
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Shared TypeScript types and schemas
- Monorepo structure with unified TypeScript configuration

## Key Components

### Data Management
- **Stock Management**: Track diesel purchases, quantities, and current inventory levels
- **Client Management**: Store customer information and contact details
- **Sales Processing**: Handle sales orders with LPO tracking and status management
- **Payment Recording**: Track payments received with multiple payment methods
- **Invoice Generation**: Create and manage invoices for sales

### Business Logic
- **Stock Calculations**: Automatic current stock level calculations based on purchases and sales
- **Financial Calculations**: VAT calculations, subtotals, and total amounts
- **Status Workflow**: Sales progress through "Pending LPO" → "LPO Received" → "Invoiced" → "Paid"
- **Reporting**: Business overview with revenue, profit, and outstanding amounts

### UI/UX Features
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Progressive Web App**: Service worker for offline capabilities
- **Real-time Updates**: Automatic data refresh with React Query
- **Modal-based Workflows**: Streamlined data entry forms
- **Status Indicators**: Visual badges for sales and payment status

## Data Flow

### Database Schema
- **Users**: Authentication and user management
- **Stock**: Diesel fuel inventory tracking with purchase details
- **Clients**: Customer information and contact data
- **Sales**: Sales orders with client relationships and financial calculations
- **Invoices**: Invoice generation linked to sales
- **Payments**: Payment tracking linked to sales with method recording

### API Structure
- RESTful API design with Express.js
- Structured routes by resource (`/api/stock`, `/api/clients`, `/api/sales`, etc.)
- Shared validation schemas between frontend and backend
- Automatic request/response logging for debugging

### State Management
- Server state managed by TanStack Query with automatic caching
- Form state handled by React Hook Form
- Real-time updates through query invalidation
- Optimistic updates for better user experience

## External Dependencies

### Core Technologies
- **Database**: Neon PostgreSQL serverless database
- **Authentication**: Built-in session management (ready for expansion)
- **UI Components**: Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React for consistent iconography

### Development Tools
- **TypeScript**: Full type safety across the stack
- **ESBuild**: Fast production builds
- **Vite**: Development server with hot reload
- **Drizzle Kit**: Database migrations and schema management

### External Services
- **Google Fonts**: Inter font family for typography
- **Replit Integration**: Development environment optimizations

## Deployment Strategy

### Production Build
- **Frontend**: Static assets built with Vite to `dist/public`
- **Backend**: ESBuild compilation to `dist/index.js`
- **Database**: PostgreSQL with Drizzle ORM migrations
- **Environment**: Node.js production environment

### Development Environment
- **Hot Reload**: Vite dev server with Express API proxy
- **Database**: Neon serverless PostgreSQL
- **TypeScript**: Shared configuration with path mapping
- **Debugging**: Request logging and error handling

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- Development vs production mode detection
- Replit-specific optimizations for cloud development

## Recent Changes - January 30, 2025

### Enhanced VAT and Export Features
- **VAT Integration**: Added comprehensive VAT support to stock purchases with automatic 5% UAE VAT calculations
- **Excel Export**: Professional Excel export functionality with client details, invoice information, and financial summaries 
- **Edit LPO Functionality**: Complete sale editing with automatic VAT recalculation and status management
- **Invoice Date Tracking**: Automatic invoice date assignment when sales progress to "Invoiced" status
- **Enhanced Reports**: Improved Pending Business and VAT reports with client filtering and date ranges
- **Mobile Optimization**: Responsive design improvements for all reporting and export features

The application is designed to be scalable and maintainable, with clear separation of concerns between frontend and backend, comprehensive type safety, and modern development practices throughout the stack.