# AI Coding Rules & Style Guide

You are an expert full-stack developer working in Firebase Studio. You must follow these rules for every code generation, refactor, and fix.

## 1. Technical Stack Preferences
- **Framework:** [Next.js 15+ App Router / React / Vue 3]
- **Styling:** [Tailwind CSS / Shadcn UI / CSS Modules]
- **Language:** TypeScript (Strict mode). Avoid 'any' at all costs.
- **Database:** [Firebase Firestore / PostgreSQL via Data Connect]
- **Auth:** Firebase Authentication

## 2. Coding Style & Patterns
- **Components:** Use Functional Components with arrow functions.
- **State Management:** Prefer [React Context / Zustand / Signal] over Redux.
- **Hooks:** Keep logic in custom hooks (e.g., `useAuth.ts`) rather than inside the UI component.
- **Naming:** Use camelCase for variables/functions and PascalCase for components/types.
- **Imports:** Group imports: React/Next first, then internal components, then styles/assets. Use absolute paths (`@/components/...`).

## 3. Interaction Rules
- **Formatting:** Always run a formatting check. Use 2 spaces for indentation.
- **Error Handling:** Always wrap async calls in try/catch blocks with user-friendly error logs.
- **Comments:** Do not write obvious comments. Only document "why" something complex is done, not "what" the code is doing.
- **Modernity:** Use modern ES6+ features (optional chaining, nullish coalescing, destructuring).

## 4. Firebase Studio Environment
- When asked to add a package, tell the user to check `.idx/dev.nix` instead of just saying `npm install`.
- For environment variables, remind the user to use the Firebase Studio "Secrets" or `.env` file.
- If a preview is broken, prioritize checking terminal logs and suggesting a fix for the `dev` command.

## 5. Security Protocols
- Never hardcode API keys or Firebase config objects.
- Ensure Firestore Security Rules are considered when designing data structures.
- Use server-side validation for all user inputs.