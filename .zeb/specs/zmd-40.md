## SOLDEF-zmd-40

### <u>Project Details</u>
- **Project ID:** ZMD
- **Project Name:** E:\tmp\.zeb-workspaces\test

### <u>Story Details</u>
- **Story ID:** ZMD-40
- **Story Name:** RE: User Authentication — Login, Forgot Password & Reset Password
- **Story Description:**
  SoundryAI — Login & Authentication

### <u>Table of Contents</u>
- [Section 1: Functional Requirements](#section-1-functional-requirements)
- [Section 2: Non Functional Requirements](#section-2-non-functional-requirements)
- [Section 3: In Scope and Out Scope](#section-3-in-scope-and-out-scope)
- [Section 4: Solution Diagrams](#section-4-solution-diagrams)

---

### <u>Section 1: Functional Requirements</u>

#### <u>1.1 Overview</u>

This plan covers a full implementation of the SoundryAI user authentication system across both backend (from scratch) and frontend (gap-filling). The backend must be built entirely: Express + TypeScript server with Mongoose User model (email, hashed password, lockout fields, reset token fields), auth routes for /auth/login, /auth/forgot-password, /auth/reset-password, and /auth/verify, controllers implementing login with bcrypt comparison, JWT issuance with 3-day expiry, account lockout after 5 failed attempts (15-minute lockout enforced server-side), password reset token generation with 10-minute expiry, nodemailer integration for recovery emails, express-validator input validation, helmet/cors/rate-limit middleware, and Jest tests. The frontend needs: (1) an Overview component (referenced in App.tsx but missing), (2) a protected route wrapper to guard /overview, (3) session expiry logic in useAuth to redirect to login after 3 days of inactivity, (4) a dedicated ForgotPasswordConfirmation component to replace the current inline confirmation text, (5) a ResetPassword test file (currently missing), (6) updates to ForgotPassword to navigate to the confirmation screen on success, and (7) updates to LoginScreen to ensure lockout error messaging matches the spec exactly. All existing patterns (React functional components, axios service layer, AuthProvider context, global CSS, jest mocking) must be followed.

#### <u>1.2 Requirement Details</u>

##### <u>1.2.1 REQ-01: REQ-01: Create backend project structure and configuration — Set up backend/src/ directory with tsconfig.json, .env.example (MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN=3d, SMTP_* vars, CLIENT_URL, PORT), src/config/index.ts to load and validate env vars via dotenv, and src/config/db.ts for Mongoose connection. Ensure build/dev/test scripts in package.json work with ts-node and tsc.</u>

> **Description:** REQ-01: Create backend project structure and configuration — Set up backend/src/ directory with tsconfig.json, .env.example (MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN=3d, SMTP_* vars, CLIENT_URL, PORT), src/config/index.ts to load and validate env vars via dotenv, and src/config/db.ts for Mongoose connection. Ensure build/dev/test scripts in package.json work with ts-node and tsc. _(ac_0)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.2 REQ-02: REQ-02: Create User Mongoose model — Define src/models/User.ts with fields: email (unique, required, lowercase), password (hashed, select:false), failedLoginAttempts (Number, default 0), lockUntil (Date, default null), resetPasswordToken (String), resetPasswordExpires (Date). Add pre-save hook to hash password with bcryptjs. Add instance method comparePassword(candidate). Add static method to increment failed attempts and set lockUntil when threshold (5) reached. Add static method to reset failed attempts on successful login.</u>

> **Description:** REQ-02: Create User Mongoose model — Define src/models/User.ts with fields: email (unique, required, lowercase), password (hashed, select:false), failedLoginAttempts (Number, default 0), lockUntil (Date, default null), resetPasswordToken (String), resetPasswordExpires (Date). Add pre-save hook to hash password with bcryptjs. Add instance method comparePassword(candidate). Add static method to increment failed attempts and set lockUntil when threshold (5) reached. Add static method to reset failed attempts on successful login. _(ac_0, ac_1, ac_5)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.3 REQ-03: REQ-03: Create JWT auth middleware — Implement src/middleware/auth.ts with verifyToken middleware that reads Bearer token from Authorization header, verifies with jsonwebtoken, attaches decoded user payload to req.user, and returns 401 if invalid/expired. Implement src/middleware/errorHandler.ts as centralized error handler returning JSON with message and exception code.</u>

> **Description:** REQ-03: Create JWT auth middleware — Implement src/middleware/auth.ts with verifyToken middleware that reads Bearer token from Authorization header, verifies with jsonwebtoken, attaches decoded user payload to req.user, and returns 401 if invalid/expired. Implement src/middleware/errorHandler.ts as centralized error handler returning JSON with message and exception code. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.4 REQ-04: REQ-04: Create validation middleware — Implement src/middleware/validators.ts using express-validator chains for: login (email is valid email, password not empty), forgot-password (email is valid email), reset-password (token not empty, newPassword meets policy, confirmPassword equals newPassword). Add a validation result checker middleware that returns 400 with EX_7.1 or EX_7.4 codes on validation failure.</u>

> **Description:** REQ-04: Create validation middleware — Implement src/middleware/validators.ts using express-validator chains for: login (email is valid email, password not empty), forgot-password (email is valid email), reset-password (token not empty, newPassword meets policy, confirmPassword equals newPassword). Add a validation result checker middleware that returns 400 with EX_7.1 or EX_7.4 codes on validation failure. _(ac_0, ac_3, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.5 REQ-05: REQ-05: Create auth controller — login — Implement src/controllers/authController.ts login function: find user by email, check account lockout (lockUntil > now → return EX_7.2 with 423 status), compare password with bcrypt (on failure increment failedLoginAttempts; if >=5 set lockUntil = now + 15min; return EX_7.3 'Invalid credentials' with 401), on success reset failedLoginAttempts to 0 and lockUntil to null, issue JWT with 3-day expiry, return { success, token, user: {id, email}, message }. No indication of which credential is wrong.</u>

> **Description:** REQ-05: Create auth controller — login — Implement src/controllers/authController.ts login function: find user by email, check account lockout (lockUntil > now → return EX_7.2 with 423 status), compare password with bcrypt (on failure increment failedLoginAttempts; if >=5 set lockUntil = now + 15min; return EX_7.3 'Invalid credentials' with 401), on success reset failedLoginAttempts to 0 and lockUntil to null, issue JWT with 3-day expiry, return { success, token, user: {id, email}, message }. No indication of which credential is wrong. _(ac_0, ac_1, ac_3, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.6 REQ-06: REQ-06: Create auth controller — forgotPassword — Implement forgotPassword function: find user by email (if not found, return success-like response to prevent email enumeration but do NOT send email), generate a crypto random reset token, hash and store resetPasswordToken + set resetPasswordExpires to now + 10 minutes, send recovery link email via nodemailer (link format: {CLIENT_URL}/reset-password?token={token}), return { success: true, message: 'Password reset link sent to your email' }.</u>

> **Description:** REQ-06: Create auth controller — forgotPassword — Implement forgotPassword function: find user by email (if not found, return success-like response to prevent email enumeration but do NOT send email), generate a crypto random reset token, hash and store resetPasswordToken + set resetPasswordExpires to now + 10 minutes, send recovery link email via nodemailer (link format: {CLIENT_URL}/reset-password?token={token}), return { success: true, message: 'Password reset link sent to your email' }. _(ac_0, ac_1, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.7 REQ-07: REQ-07: Create auth controller — resetPassword — Implement resetPassword function: receive token + newPassword + confirmPassword, find user by resetPasswordToken (hashed lookup or direct), check resetPasswordExpires > now (if expired → return error 'This recovery link has expired.'), validate newPassword meets password policy (min 8, uppercase, lowercase, number, special char — if not → 'Password does not meet requirements.'), validate newPassword === confirmPassword (if not → EX_7.4), hash new password, save user with cleared reset token fields, return { success: true, message: 'Your password has been successfully reset.' }.</u>

> **Description:** REQ-07: Create auth controller — resetPassword — Implement resetPassword function: receive token + newPassword + confirmPassword, find user by resetPasswordToken (hashed lookup or direct), check resetPasswordExpires > now (if expired → return error 'This recovery link has expired.'), validate newPassword meets password policy (min 8, uppercase, lowercase, number, special char — if not → 'Password does not meet requirements.'), validate newPassword === confirmPassword (if not → EX_7.4), hash new password, save user with cleared reset token fields, return { success: true, message: 'Your password has been successfully reset.' }. _(ac_0, ac_1, ac_3, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.8 REQ-08: REQ-08: Create auth controller — verify — Implement verifyToken controller function: called by GET /auth/verify with auth middleware, returns { valid: true, user: { id, email } } from req.user decoded JWT payload. Used by frontend useAuth to validate stored token on app load.</u>

> **Description:** REQ-08: Create auth controller — verify — Implement verifyToken controller function: called by GET /auth/verify with auth middleware, returns { valid: true, user: { id, email } } from req.user decoded JWT payload. Used by frontend useAuth to validate stored token on app load. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.9 REQ-09: REQ-09: Create auth routes — Implement src/routes/authRoutes.ts wiring POST /login (validators + login controller), POST /forgot-password (validators + forgotPassword controller), POST /reset-password (validators + resetPassword controller), GET /verify (auth middleware + verify controller). Apply express-rate-limit to login route (e.g., 10 attempts per 15 min per IP).</u>

> **Description:** REQ-09: Create auth routes — Implement src/routes/authRoutes.ts wiring POST /login (validators + login controller), POST /forgot-password (validators + forgotPassword controller), POST /reset-password (validators + resetPassword controller), GET /verify (auth middleware + verify controller). Apply express-rate-limit to login route (e.g., 10 attempts per 15 min per IP). _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.10 REQ-10: REQ-10: Create email service — Implement src/services/emailService.ts using nodemailer with SMTP config from env vars. Export sendResetEmail(toEmail, resetLink) function that sends an HTML email containing the recovery link. Handle errors gracefully (log, don't crash the request).</u>

> **Description:** REQ-10: Create email service — Implement src/services/emailService.ts using nodemailer with SMTP config from env vars. Export sendResetEmail(toEmail, resetLink) function that sends an HTML email containing the recovery link. Handle errors gracefully (log, don't crash the request). _(ac_0, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.11 REQ-11: REQ-11: Create Express server entry point — Implement src/server.ts: load dotenv, connect to MongoDB via db.ts, initialize Express app with helmet, cors, express.json() body parser, mount /api/auth routes, add 404 handler, add centralized error handler middleware, listen on PORT from env. Export app for testing.</u>

> **Description:** REQ-11: Create Express server entry point — Implement src/server.ts: load dotenv, connect to MongoDB via db.ts, initialize Express app with helmet, cors, express.json() body parser, mount /api/auth routes, add 404 handler, add centralized error handler middleware, listen on PORT from env. Export app for testing. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.12 REQ-12: REQ-12: Create backend Jest tests — Implement src/__tests__/auth.test.ts (or separate test files per controller) testing: login success, login wrong password (EX_7.3), login 5 failed attempts triggers lockout (EX_7.2), login during lockout blocked, login after lockout expiry succeeds, forgot-password sends email, reset-password success, reset-password expired token, reset-password password mismatch (EX_7.4), reset-password policy failure, verify token valid/invalid. Mock Mongoose model methods and nodemailer as needed.</u>

> **Description:** REQ-12: Create backend Jest tests — Implement src/__tests__/auth.test.ts (or separate test files per controller) testing: login success, login wrong password (EX_7.3), login 5 failed attempts triggers lockout (EX_7.2), login during lockout blocked, login after lockout expiry succeeds, forgot-password sends email, reset-password success, reset-password expired token, reset-password password mismatch (EX_7.4), reset-password policy failure, verify token valid/invalid. Mock Mongoose model methods and nodemailer as needed. _(ac_0, ac_1, ac_3, ac_9)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.13 REQ-13: REQ-13: Create frontend Overview component — Implement frontend/src/components/Overview/Overview.tsx as a simple authenticated landing page displaying a welcome message and a logout button. This resolves the missing import in App.tsx that currently breaks the build.</u>

> **Description:** REQ-13: Create frontend Overview component — Implement frontend/src/components/Overview/Overview.tsx as a simple authenticated landing page displaying a welcome message and a logout button. This resolves the missing import in App.tsx that currently breaks the build. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.14 REQ-14: REQ-14: Create frontend ProtectedRoute component — Implement frontend/src/components/common/ProtectedRoute.tsx that checks useAuth.isAuthenticated and redirects to /login if not authenticated. Wrap the /overview route in App.tsx with ProtectedRoute so unauthenticated users cannot access it.</u>

> **Description:** REQ-14: Create frontend ProtectedRoute component — Implement frontend/src/components/common/ProtectedRoute.tsx that checks useAuth.isAuthenticated and redirects to /login if not authenticated. Wrap the /overview route in App.tsx with ProtectedRoute so unauthenticated users cannot access it. _(ac_0, ac_1, ac_6)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.15 REQ-15: REQ-15: Add session expiry (3 days) to useAuth — Modify frontend/src/hooks/useAuth.ts to store a sessionTimestamp in localStorage alongside authToken. On app initialization and on each auth check, compare current time against sessionTimestamp + 3 days; if expired, clear localStorage and redirect to /login. Also add a periodic check (e.g., setInterval every 60s) to detect session expiry while the app is open and trigger logout + redirect.</u>

> **Description:** REQ-15: Add session expiry (3 days) to useAuth — Modify frontend/src/hooks/useAuth.ts to store a sessionTimestamp in localStorage alongside authToken. On app initialization and on each auth check, compare current time against sessionTimestamp + 3 days; if expired, clear localStorage and redirect to /login. Also add a periodic check (e.g., setInterval every 60s) to detect session expiry while the app is open and trigger logout + redirect. _(ac_0, ac_1, ac_5)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.16 REQ-16: REQ-16: Create ForgotPasswordConfirmation component — Implement frontend/src/components/Login/ForgotPasswordConfirmation.tsx as a dedicated confirmation screen shown after successful forgot-password submission. Display logo, title 'Check your email', description 'A password reset link has been sent to your email. The link expires in 10 minutes.', and a 'Back to sign in' link. Update ForgotPassword.tsx to navigate to this confirmation screen (or render it conditionally) instead of the current inline text block. Remove the auto-redirect-to-login timer; let the user click 'Back to sign in' manually.</u>

> **Description:** REQ-16: Create ForgotPasswordConfirmation component — Implement frontend/src/components/Login/ForgotPasswordConfirmation.tsx as a dedicated confirmation screen shown after successful forgot-password submission. Display logo, title 'Check your email', description 'A password reset link has been sent to your email. The link expires in 10 minutes.', and a 'Back to sign in' link. Update ForgotPassword.tsx to navigate to this confirmation screen (or render it conditionally) instead of the current inline text block. Remove the auto-redirect-to-login timer; let the user click 'Back to sign in' manually. _(ac_0, ac_1, ac_2)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.17 REQ-17: REQ-17: Update ForgotPassword component — Modify ForgotPassword.tsx to: (1) on successful submission, navigate to a confirmation state/screen showing the ForgotPasswordConfirmation component, (2) remove the 5-second auto-redirect timer, (3) keep the 'Back to sign in' link accessible. Ensure the button label reads 'Continue' per DDS_02 and is disabled until valid email is entered.</u>

> **Description:** REQ-17: Update ForgotPassword component — Modify ForgotPassword.tsx to: (1) on successful submission, navigate to a confirmation state/screen showing the ForgotPasswordConfirmation component, (2) remove the 5-second auto-redirect timer, (3) keep the 'Back to sign in' link accessible. Ensure the button label reads 'Continue' per DDS_02 and is disabled until valid email is entered. _(ac_0, ac_1, ac_2)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.18 REQ-18: REQ-18: Update LoginScreen lockout error message — Modify LoginScreen.tsx to display the exact lockout error message from the spec: 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.' for EX_7.2. Ensure the email and password fields remain editable during lockout (they already do since it's client-side). Verify the success message uses green background (success-message class already exists).</u>

> **Description:** REQ-18: Update LoginScreen lockout error message — Modify LoginScreen.tsx to display the exact lockout error message from the spec: 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.' for EX_7.2. Ensure the email and password fields remain editable during lockout (they already do since it's client-side). Verify the success message uses green background (success-message class already exists). _(ac_0, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.19 REQ-19: REQ-19: Update ResetPassword component — Modify ResetPassword.tsx to: (1) fetch the user's email from the reset token via a new authService.verifyResetToken endpoint or decode it from the token, so the subtitle 'Enter and confirm new password for {email}' shows the real email instead of hardcoded 'admin@zeb.co', (2) ensure the 'Continue' button label matches DDS_03 (currently says 'Continue' which is correct), (3) ensure error messages match spec exactly: 'Passwords do not match. Please re-enter.' for mismatch, 'Password does not meet requirements.' for policy failure, 'This recovery link has expired.' for expired link.</u>

> **Description:** REQ-19: Update ResetPassword component — Modify ResetPassword.tsx to: (1) fetch the user's email from the reset token via a new authService.verifyResetToken endpoint or decode it from the token, so the subtitle 'Enter and confirm new password for {email}' shows the real email instead of hardcoded 'admin@zeb.co', (2) ensure the 'Continue' button label matches DDS_03 (currently says 'Continue' which is correct), (3) ensure error messages match spec exactly: 'Passwords do not match. Please re-enter.' for mismatch, 'Password does not meet requirements.' for policy failure, 'This recovery link has expired.' for expired link. _(ac_0, ac_1, ac_8)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.20 REQ-20: REQ-20: Add verifyResetToken to authService — Add a new method to frontend/src/services/authService.ts: verifyResetToken(token) that calls GET /auth/verify-reset-token?token={token} and returns { valid: boolean, email: string } so the ResetPassword screen can display the user's email and validate the token before showing the form.</u>

> **Description:** REQ-20: Add verifyResetToken to authService — Add a new method to frontend/src/services/authService.ts: verifyResetToken(token) that calls GET /auth/verify-reset-token?token={token} and returns { valid: boolean, email: string } so the ResetPassword screen can display the user's email and validate the token before showing the form. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.21 REQ-21: REQ-21: Add verify-reset-token backend endpoint — Add GET /auth/verify-reset-token to backend auth routes and a corresponding controller function that validates the reset token, checks expiry, and returns { valid: true, email } or { valid: false } if expired/invalid. This supports the frontend ResetPassword screen.</u>

> **Description:** REQ-21: Add verify-reset-token backend endpoint — Add GET /auth/verify-reset-token to backend auth routes and a corresponding controller function that validates the reset token, checks expiry, and returns { valid: true, email } or { valid: false } if expired/invalid. This supports the frontend ResetPassword screen. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.22 REQ-22: REQ-22: Create ResetPassword test file — Implement frontend/src/components/Login/__tests__/ResetPassword.test.tsx following the same patterns as LoginScreen.test.tsx and ForgotPassword.test.tsx: mock authService, test rendering of all UI elements (title 'Set a new password', description with email, New Password field, Confirm Password field, Continue button, Back to sign in link), test password validation (policy enforcement), test password mismatch error, test expired token error, test successful reset with redirect to /login, test loading state, test disabled button when fields empty or invalid.</u>

> **Description:** REQ-22: Create ResetPassword test file — Implement frontend/src/components/Login/__tests__/ResetPassword.test.tsx following the same patterns as LoginScreen.test.tsx and ForgotPassword.test.tsx: mock authService, test rendering of all UI elements (title 'Set a new password', description with email, New Password field, Confirm Password field, Continue button, Back to sign in link), test password validation (policy enforcement), test password mismatch error, test expired token error, test successful reset with redirect to /login, test loading state, test disabled button when fields empty or invalid. _(ac_0, ac_9)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.23 REQ-23: REQ-23: Update ForgotPassword tests — Modify frontend/src/components/Login/__tests__/ForgotPassword.test.tsx to reflect the new confirmation screen flow: test that after successful submission the confirmation screen is shown (not inline text), remove the auto-redirect timer test, test that 'Back to sign in' link navigates to /login from the confirmation screen.</u>

> **Description:** REQ-23: Update ForgotPassword tests — Modify frontend/src/components/Login/__tests__/ForgotPassword.test.tsx to reflect the new confirmation screen flow: test that after successful submission the confirmation screen is shown (not inline text), remove the auto-redirect timer test, test that 'Back to sign in' link navigates to /login from the confirmation screen. _(ac_0, ac_9)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.24 REQ-24: REQ-24: Update LoginScreen tests — Modify frontend/src/components/Login/__tests__/LoginScreen.test.tsx to: (1) update the EX_7.2 expected message to match the exact spec text 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.', (2) add test verifying fields remain editable after lockout error, (3) add test verifying success message has green background (success-message class).</u>

> **Description:** REQ-24: Update LoginScreen tests — Modify frontend/src/components/Login/__tests__/LoginScreen.test.tsx to: (1) update the EX_7.2 expected message to match the exact spec text 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.', (2) add test verifying fields remain editable after lockout error, (3) add test verifying success message has green background (success-message class). _(ac_0, ac_9)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.25 REQ-25: REQ-25: Add CSS styles for confirmation screen — Add styles to frontend/src/styles/globals.css for the ForgotPasswordConfirmation component: centered layout matching auth-card, checkmark or email icon styling, confirmation message styling, and ensure 'Back to sign in' link uses existing back-link class.</u>

> **Description:** REQ-25: Add CSS styles for confirmation screen — Add styles to frontend/src/styles/globals.css for the ForgotPasswordConfirmation component: centered layout matching auth-card, checkmark or email icon styling, confirmation message styling, and ensure 'Back to sign in' link uses existing back-link class. _(ac_0, ac_2)_
> **Acceptance Criteria:** Implementation verified against story requirements.

##### <u>1.2.26 REQ-26: REQ-26: Update App.tsx routing — Modify App.tsx to: (1) add route for ForgotPasswordConfirmation if it's a separate route (e.g., /forgot-password-confirmation), (2) wrap /overview route with ProtectedRoute, (3) add a catch-all redirect to /login for unknown routes. Ensure all routes are correctly wired.</u>

> **Description:** REQ-26: Update App.tsx routing — Modify App.tsx to: (1) add route for ForgotPasswordConfirmation if it's a separate route (e.g., /forgot-password-confirmation), (2) wrap /overview route with ProtectedRoute, (3) add a catch-all redirect to /login for unknown routes. Ensure all routes are correctly wired. _(ac_0, ac_1)_
> **Acceptance Criteria:** Implementation verified against story requirements.

#### <u>1.3 Project Artifacts</u>

- `frontend/src/components/Login/LoginScreen.tsx` (modify)
- `frontend/src/components/Login/ForgotPassword.tsx` (modify)
- `frontend/src/components/Login/ResetPassword.tsx` (modify)
- `frontend/src/services/authService.ts` (modify)
- `frontend/src/hooks/useAuth.ts` (modify)
- `frontend/src/App.tsx` (modify)
- `frontend/src/styles/globals.css` (modify)
- `frontend/src/components/Login/__tests__/LoginScreen.test.tsx` (modify)
- `frontend/src/components/Login/__tests__/ForgotPassword.test.tsx` (modify)
- `backend/package.json` (modify)
- `backend/tsconfig.json` (create)
- `backend/.env.example` (create)
- `backend/src/config/index.ts` (create)
- `backend/src/config/db.ts` (create)
- `backend/src/models/User.ts` (create)
- `backend/src/middleware/auth.ts` (create)
- `backend/src/middleware/errorHandler.ts` (create)
- `backend/src/middleware/validators.ts` (create)
- `backend/src/controllers/authController.ts` (create)
- `backend/src/routes/authRoutes.ts` (create)
- `backend/src/services/emailService.ts` (create)
- `backend/src/server.ts` (create)
- `backend/src/__tests__/auth.test.ts` (create)
- `frontend/src/components/Overview/Overview.tsx` (create)
- `frontend/src/components/common/ProtectedRoute.tsx` (create)
- `frontend/src/components/Login/ForgotPasswordConfirmation.tsx` (create)
- `frontend/src/components/Login/__tests__/ResetPassword.test.tsx` (create)
- `frontend/src/components/Login/__tests__/ForgotPasswordConfirmation.test.tsx` (create)

#### <u>1.4 Dependencies</u>

- No blocking dependencies identified

---

### <u>Section 2: Non Functional Requirements</u>

#### 2.1 Infrastructure and Deployment

##### <u>2.1.1 Overview</u>
> Implementation targets the existing project infrastructure. No new infrastructure provisioning required unless specified in the story.

#### 2.2 Architecture and System Design

##### <u>2.2.1 Security and Compliance</u>
> Follow existing security patterns in the codebase (authentication, authorization, input validation).

##### <u>2.2.2 System Performance</u>
> Adhere to performance requirements specified in the story description.

---

### <u>Section 3: In Scope and Out Scope</u>

#### <u>3.1 In Scope Details</u>

- Given the updated Description has been implemented, when a reviewer compares the implemented behavior against the Description, then all described functional requirements must be met without omission.

#### <u>3.2 Out Scope Details</u>

- Features not mentioned in the acceptance criteria
- Infrastructure changes beyond what is specified
- Unrelated module modifications

---

### <u>Section 4: Solution Diagrams</u>

#### <u>4.1 UI/UX Design Diagram</u>
**Diagram Location:** _(refer to story attachments if any)_

#### <u>4.2 Architecture Design Diagram</u>
**Diagram Location:** _(to be added if applicable)_

#### <u>4.3 Infrastructure Design Diagram</u>
**Diagram Location:** _(to be added if applicable)_

---

### <u>Files Summary</u>

| Action | File |
|--------|------|
| Modify | `frontend/src/components/Login/LoginScreen.tsx` |
| Modify | `frontend/src/components/Login/ForgotPassword.tsx` |
| Modify | `frontend/src/components/Login/ResetPassword.tsx` |
| Modify | `frontend/src/services/authService.ts` |
| Modify | `frontend/src/hooks/useAuth.ts` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/styles/globals.css` |
| Modify | `frontend/src/components/Login/__tests__/LoginScreen.test.tsx` |
| Modify | `frontend/src/components/Login/__tests__/ForgotPassword.test.tsx` |
| Modify | `backend/package.json` |
| Create | `backend/tsconfig.json` |
| Create | `backend/.env.example` |
| Create | `backend/src/config/index.ts` |
| Create | `backend/src/config/db.ts` |
| Create | `backend/src/models/User.ts` |
| Create | `backend/src/middleware/auth.ts` |
| Create | `backend/src/middleware/errorHandler.ts` |
| Create | `backend/src/middleware/validators.ts` |
| Create | `backend/src/controllers/authController.ts` |
| Create | `backend/src/routes/authRoutes.ts` |
| Create | `backend/src/services/emailService.ts` |
| Create | `backend/src/server.ts` |
| Create | `backend/src/__tests__/auth.test.ts` |
| Create | `frontend/src/components/Overview/Overview.tsx` |
| Create | `frontend/src/components/common/ProtectedRoute.tsx` |
| Create | `frontend/src/components/Login/ForgotPasswordConfirmation.tsx` |
| Create | `frontend/src/components/Login/__tests__/ResetPassword.test.tsx` |
| Create | `frontend/src/components/Login/__tests__/ForgotPasswordConfirmation.test.tsx` |

> **Estimated changes:** 26
> **Status:** Draft — Awaiting Approval
