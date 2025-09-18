# replit.md

## Overview

VibeTune is an AI-powered English prosody learning application designed specifically for ESL (English as Second Language) learners. The app focuses on improving pronunciation, intonation, rhythm, and stress patterns through interactive AI conversations and real-time feedback. Built as a mobile-first React application with offline-first architecture, VibeTune provides personalized learning experiences with placement testing, level-based content, and comprehensive progress tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Build Tool**: Vite for fast development and optimized production builds
- **State Management**: Context API with useReducer for global app state management
- **UI Framework**: Custom design system built on Radix UI primitives with Tailwind CSS
- **Animation**: Motion library for smooth transitions and micro-interactions
- **Mobile Support**: Responsive design with mobile-first approach, prepared for Capacitor integration

### Routing and Navigation
- **App State Machine**: Custom state-based routing using enum states (loading, onboarding, auth, main-app, etc.)
- **Dynamic Navigation**: Conditional rendering based on user authentication status and app state
- **Error Boundaries**: Comprehensive error handling with fallback components

### Authentication System
- **Provider**: Supabase Auth with OAuth support (Google, GitHub)
- **Session Management**: Automatic token refresh and persistent sessions
- **Profile Management**: User profiles with skill levels and preferences stored in Supabase
- **Security**: PKCE flow for enhanced security in single-page applications

### Data Layer
- **Primary Database**: Supabase (PostgreSQL) for user data, conversations, and analytics
- **Local Storage**: Browser localStorage for offline data persistence
- **Offline-First Design**: Local data storage with background sync when online
- **Conflict Resolution**: Timestamp-based merge strategies for data synchronization

### AI Integration
- **Speech Analysis**: Custom audio analysis API for prosody feedback
- **Real-time Processing**: Voice-to-text transcription with prosody scoring
- **Adaptive Learning**: AI-powered placement testing with dynamic question selection
- **Feedback Engine**: Detailed pronunciation analysis with visual highlighting

### Offline Architecture
- **Service Workers**: Background sync capabilities for seamless offline experience
- **Local Caching**: IndexedDB wrapper with localStorage fallback
- **Sync Manager**: Automatic data synchronization with conflict resolution
- **Queue System**: Offline action queuing with retry mechanisms

### Component Architecture
- **Atomic Design**: Reusable UI components following atomic design principles
- **Custom Hooks**: Business logic abstraction through custom React hooks
- **Context Providers**: Separation of concerns with multiple context providers
- **Error Boundaries**: Granular error handling at component levels

### Performance Optimizations
- **Code Splitting**: Dynamic imports for route-based code splitting
- **Lazy Loading**: Component lazy loading for improved initial load times
- **Memoization**: React.memo and useMemo for expensive computations
- **Bundle Optimization**: Vite's tree-shaking and minification

### Testing Strategy
- **Unit Testing**: Vitest for component and utility function testing
- **Integration Testing**: React Testing Library for user interaction testing
- **Mock Services**: Comprehensive service mocking for isolated testing
- **Error Scenarios**: Edge case and error condition testing

## External Dependencies

### Core Services
- **Supabase**: Backend-as-a-Service providing PostgreSQL database, authentication, and real-time subscriptions
- **Supabase Edge Functions**: Serverless functions for AI analysis and API endpoints

### UI and Styling
- **Radix UI**: Headless component library for accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography
- **Motion**: Animation library for smooth transitions and micro-interactions

### Development Tools
- **TypeScript**: Static type checking for improved developer experience
- **Vite**: Fast build tool with hot module replacement
- **ESLint**: Code linting with TypeScript-specific rules
- **PostCSS**: CSS processing with Autoprefixer

### Testing and Quality
- **Vitest**: Fast unit testing framework with ES modules support
- **React Testing Library**: Testing utilities focused on user behavior
- **@testing-library/jest-dom**: Custom Jest matchers for DOM testing

### Audio Processing
- **Web Audio API**: Browser-native audio recording and processing
- **Speech Recognition API**: Browser speech-to-text capabilities where available
- **Custom Audio Analysis**: Server-side prosody analysis through Supabase Edge Functions

### Analytics and Monitoring
- **Custom Analytics Service**: Event tracking with offline queue support
- **Error Tracking**: Custom error boundary system with event logging
- **Performance Monitoring**: Core Web Vitals tracking

### Mobile Integration (Future)
- **Capacitor**: Planned mobile app deployment for iOS and Android
- **Native Audio**: Enhanced audio recording capabilities on mobile devices