# CasaStay Authentication Implementation Summary

This document summarizes the existing CasaStay Node.js + Express authentication implementation so it can be recreated accurately in another backend, such as FastAPI. It is based on the current CasaStay codebase and focuses only on authentication, OTP, sessions, email verification, password reset, and related security behavior.

## 1. Overall Authentication Architecture

CasaStay uses a server-rendered Express authentication system based on Passport sessions.

It does not use JWT.

There is no JWT signing, refresh token, access token, bearer token validation, token blacklist, or token rotation logic.

Authentication state is stored in an Express session. Sessions are persisted in MongoDB using `connect-mongo`. The browser receives the default Express session cookie, normally named `connect.sid`.

The authentication stack is:

- Express
- Passport
- Passport Local
- Passport Local Mongoose
- Express Session
- Connect Mongo
- Connect Flash
- MongoDB / Mongoose
- Brevo email API through Axios

The user logs in using `username` and `password`. Email is collected at signup and used for OTP verification and password reset, but Passport Local authenticates by username.

## 2. Important Auth Files

Main files:

- `app.js`
- `routes/user.js`
- `controllers/users.js`
- `models/user.js`
- `middleware.js`
- `utils/generateOTP.js`
- `utils/sendOTP.js`
- `utils/sendEmail.js`
- `views/users/signup.ejs`
- `views/users/login.ejs`
- `views/users/verifyEmail.ejs`
- `views/users/forgotPassword.ejs`
- `views/users/resetPassword.ejs`
- `views/emails/otp/otp.ejs`
- `views/emails/otp/otpStyle.js`
- `views/emails/message/welcome.ejs`
- `views/emails/message/mailStyle.js`
- `public/js/otpResend.js`
- `package.json`

Shared auth guards are in `middleware.js`.

## 3. Required Dependencies

Auth-related dependencies from `package.json`:

```json
{
  "axios": "^1.13.2",
  "connect-flash": "^0.1.1",
  "connect-mongo": "^5.1.0",
  "dotenv": "^17.2.3",
  "ejs": "^3.1.10",
  "ejs-mate": "^4.0.0",
  "express": "^5.1.0",
  "express-session": "^1.18.2",
  "mongoose": "^8.19.3",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-local-mongoose": "^8.0.0",
  "express-rate-limit": "^8.2.1",
  "rate-limit-mongo": "^2.3.2"
}
```

`express-rate-limit` and `rate-limit-mongo` are installed, but they are not actively wired into the current auth routes.

## 4. Environment Variables Used

Actually used for auth/session/email:

```env
NODE_ENV
ATLASDB_URL
SECRET
BREVO_API_KEY
```

Usage:

- `NODE_ENV`: controls whether `dotenv` is loaded.
- `ATLASDB_URL`: MongoDB connection string and Mongo session store URL.
- `SECRET`: Express session secret and `connect-mongo` crypto secret.
- `BREVO_API_KEY`: Brevo SMTP API key used in `utils/sendEmail.js`.

The README mentions `EMAIL_USER` and `EMAIL_PASS`, but the current Brevo implementation does not use those variables.

## 5. App-Level Session and Passport Setup

In `app.js`, non-production loads `.env`:

```js
if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
```

MongoDB connection:

```js
const dbUrl = process.env.ATLASDB_URL;
await mongoose.connect(dbUrl);
```

Mongo session store:

```js
const store = new MongoStore({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 3600,
});
```

Session options:

```js
const sessionOptions = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};
```

Cookie behavior:

- 7-day expiry.
- 7-day max age.
- HTTP-only.
- No explicit `secure`.
- No explicit `sameSite`.
- Default Express session cookie name is used.

Passport setup:

```js
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
```

Passport Local Mongoose serializes the username into the session and deserializes by finding the user by username.

The app also exposes current user and flash messages to all EJS views:

```js
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});
```

## 6. User Model and MongoDB Structure

User model file: `models/user.js`

MongoDB collection: `users`

Explicit schema fields:

```js
email: {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  trim: true,
}

isEmailVerified: {
  type: Boolean,
  default: false,
}

emailOTPHash: String
emailOTPExpires: Date
emailOTPAttempts: {
  type: Number,
  default: 0,
}
emailOTPLastSentAt: Date

resetOTPHash: String
resetOTPExpires: Date
resetOTPAttempts: {
  type: Number,
  default: 0,
}
resetOTPLastSentAt: Date
```

Then the schema applies:

```js
userSchema.plugin(passportLocalMongoose);
```

`passport-local-mongoose` adds fields including:

- `username`
- `hash`
- `salt`

The User schema does not enable Mongoose timestamps. This matters because some controller code sorts users by `createdAt`, but `createdAt` is not defined by this schema.

## 7. Password Hashing

Password hashing is handled by `passport-local-mongoose`.

The code does not customize hashing options, so the package defaults are used:

- Algorithm: Node crypto `pbkdf2`
- Digest algorithm: `sha256`
- Salt length: `32`
- Iterations: `25000`
- Key length: `512`
- Encoding: `hex`
- Hash field: `hash`
- Salt field: `salt`

Registration uses:

```js
User.register(newUser, password)
```

Password reset uses:

```js
await user.setPassword(password);
```

## 8. OTP Generation

OTP helper file: `utils/generateOTP.js`

OTP generation:

```js
crypto.randomInt(100000, 999999).toString();
```

This creates a numeric OTP as a string. It is intended to be 6 digits.

Note: Node `crypto.randomInt(min, max)` has an exclusive upper bound, so the actual generated range is `100000` through `999998`.

## 9. OTP Hashing

OTP hashing is also in `utils/generateOTP.js`.

Hash function:

```js
crypto.createHash("sha256").update(otp).digest("hex");
```

Important exact behavior:

- OTPs are hashed with unsalted SHA-256.
- The plaintext OTP is sent by email.
- Only the SHA-256 hex digest is stored in MongoDB.
- There is no per-user OTP salt.
- There is no HMAC secret for OTP hashing.

## 10. Generic OTP Sending Helper

OTP helper file: `utils/sendOTP.js`

Signature:

```js
sendOTP({
  target,
  hashField,
  expiryField,
  subject,
  template,
  templateData,
  recipientEmail,
})
```

Flow:

1. Generate plaintext OTP.
2. Hash OTP with SHA-256.
3. Store hash in `target[hashField]`.
4. Store expiry in `target[expiryField]`.
5. Expiry is exactly 2 minutes:

```js
Date.now() + 2 * 60 * 1000
```

6. Save the target document.
7. Render EJS template from:

```js
../views/emails/otp/${template}
```

8. Send the rendered HTML email through `sendEmail`.

This helper is reused for:

- signup email verification
- login verification when user is unverified
- password reset OTP
- password reset resend OTP
- booking cancellation OTP outside core auth

## 11. Brevo Email Integration

Email helper file: `utils/sendEmail.js`

Uses Axios:

```js
await axios.post(
  "https://api.brevo.com/v3/smtp/email",
  {
    sender: {
      name: "CasaStay",
      email: "CasaStay008@gmail.com",
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  },
  {
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
    },
  },
);
```

Important behavior:

- Sender name is hardcoded as `CasaStay`.
- Sender email is hardcoded as `CasaStay008@gmail.com`.
- Brevo API key comes from `process.env.BREVO_API_KEY`.
- Errors are caught and logged.
- Errors are not rethrown.
- Because errors are swallowed, controllers may continue even if email delivery fails.

Error handling:

```js
console.error("Email API error:", err.response?.data || err.message);
```

## 12. OTP Email Template

Template file: `views/emails/otp/otp.ejs`

Used for:

- email verification
- password reset

Template data:

```js
{
  username,
  otp,
  otpStyle
}
```

Template content:

- Heading: `Verify Your Email`
- Shows `username.toUpperCase()`
- Displays plaintext OTP
- States OTP expires in 2 minutes
- Says to ignore email if the user did not create a CasaStay account
- Footer: Team CasaStay

Styling file: `views/emails/otp/otpStyle.js`

Exports:

```js
container
heading
otpText
footerStyle
```

Important mismatch:

The EJS template uses `otpStyle.footer`, but the style object exports `footerStyle`, not `footer`.

## 13. Signup Route Behavior

Routes:

```http
GET /signup
POST /signup
```

Route file: `routes/user.js`

```js
router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));
```

GET behavior:

- Renders `users/signup.ejs`.

POST controller: `signup`

Expected body:

```js
username
email
password
```

Flow:

1. Read `username`, `email`, and `password` from `req.body`.
2. Check if a user already exists with the same email:

```js
const existingEmail = await User.findOne({ email });
```

3. If email exists:
   - flash error:

```text
An Account With This Email Already Exists. Please Log In Instead.
```

   - save session
   - redirect to `/login`

4. Create:

```js
const newUser = new User({ email, username });
```

5. Register user with Passport Local Mongoose:

```js
const registeredUser = await User.register(newUser, password);
```

6. Set:

```js
registeredUser.emailOTPAttempts = 0;
registeredUser.isEmailVerified = false;
```

7. Send email verification OTP:

```js
await sendOTP({
  target: registeredUser,
  hashField: "emailOTPHash",
  expiryField: "emailOTPExpires",
  subject: "Verify Your Email — CasaStay 🔐",
  template: "otp.ejs",
  templateData: (otp) => ({
    username: registeredUser.username,
    otp,
    otpStyle,
  }),
  recipientEmail: registeredUser.email,
});
```

8. Flash success:

```text
Account Created! Please Verify Your Email Using The OTP Sent To Your Email.
```

9. Save session and redirect to `/verify-email`.

Error behavior:

- Flash `err.message`.
- Redirect `/signup`.

Important exact behavior:

- Initial signup OTP does not increment `emailOTPAttempts`.
- Initial signup OTP does not set `emailOTPLastSentAt`.
- Duplicate username errors are handled by Passport Local Mongoose.
- Duplicate email is checked manually before registration.

## 14. Email Verification Form Route

Route:

```http
GET /verify-email
```

Controller: `renderVerifyEmailForm`

Flow:

1. Find one unverified user:

```js
const user = await User.findOne({
  isEmailVerified: false,
}).sort({ createdAt: -1 });
```

2. If no user:
   - flash:

```text
No Pending Verification Found. Please Sign Up Again.
```

   - redirect `/signup`

3. Set:

```js
const MAX_ATTEMPTS = 3;
```

4. Calculate attempts left:

```js
const resendAttemptsLeft =
  typeof user.emailOTPAttempts === "number"
    ? MAX_ATTEMPTS - user.emailOTPAttempts
    : null;
```

5. Render `users/verifyEmail.ejs` with:

```js
{
  otpExpiry: user.emailOTPExpires ? user.emailOTPExpires.getTime() : 0,
  resendAttemptsLeft
}
```

Important exact behavior:

- The pending verification page is not tied to the current session.
- It simply finds an unverified user in MongoDB.
- It tries to sort by `createdAt`, but the schema does not define timestamps.

## 15. Verify Email POST Flow

Route:

```http
POST /verify-email
```

Controller: `verifyEmail`

Expected body:

```js
otp
```

Flow:

1. Read OTP:

```js
const { otp } = req.body;
```

2. If OTP missing:
   - flash:

```text
OTP Is Required
```

   - save session
   - redirect `/verify-email`

3. Hash submitted OTP:

```js
const otpHash = hashOTP(otp);
```

4. Find user by OTP hash and expiry:

```js
const user = await User.findOne({
  emailOTPHash: otpHash,
  emailOTPExpires: { $gt: Date.now() },
});
```

5. If no user:
   - flash:

```text
Invalid Or Expired OTP
```

   - save session
   - redirect `/verify-email`

6. If user found:

```js
user.isEmailVerified = true;
user.emailOTPHash = undefined;
user.emailOTPExpires = undefined;
user.emailOTPAttempts = 0;
await user.save();
```

7. Render welcome email from `views/emails/message/welcome.ejs`.
8. Send welcome email to user.
9. Log user in:

```js
req.login(user, (err) => {
  ...
});
```

10. Flash:

```text
Welcome To CasaStay
```

11. Save session and redirect `/listings`.

Error behavior:

- Flash `err.message`.
- Redirect `/signup`.

Important exact behavior:

- User lookup is based only on `emailOTPHash` and non-expired `emailOTPExpires`.
- The submitted OTP is not tied to a session email.
- `emailOTPLastSentAt` is not cleared after successful verification.
- Email OTP attempts are reset to `0`.
- The user is automatically logged in after successful verification.

## 16. Resend Email Verification OTP Flow

Route:

```http
POST /resend-otp
```

Controller: `resendOTP`

Flow:

1. Find one unverified user:

```js
const user = await User.findOne({
  isEmailVerified: false,
}).sort({ createdAt: -1 });
```

2. If no user:
   - flash:

```text
No Pending Verification Found. Please Sign Up Again.
```

   - redirect `/signup`

3. Constants:

```js
const MAX_ATTEMPTS = 3;
const WINDOW_TIME = 10 * 60 * 1000;
```

4. Reset attempts if window expired:

```js
if (
  user.emailOTPLastSentAt &&
  Date.now() - user.emailOTPLastSentAt > WINDOW_TIME
) {
  user.emailOTPAttempts = 0;
}
```

5. If attempts are exhausted:

```js
if (user.emailOTPAttempts >= MAX_ATTEMPTS) {
  const timeLeft = WINDOW_TIME - (Date.now() - user.emailOTPLastSentAt);
  const minutesLeft = Math.ceil(timeLeft / 60000);
  ...
}
```

Flash:

```text
Resend OTP Limit Reached. Please Try After X Minute(s).
```

Redirect:

```http
/verify-email
```

6. If allowed, send new OTP:

```js
await sendOTP({
  target: user,
  hashField: "emailOTPHash",
  expiryField: "emailOTPExpires",
  subject: "Your New OTP — CasaStay 🔐",
  template: "otp.ejs",
  templateData: (otp) => ({
    username: user.username,
    otp,
    otpStyle,
  }),
  recipientEmail: user.email,
});
```

7. Increment:

```js
user.emailOTPAttempts += 1;
user.emailOTPLastSentAt = Date.now();
await user.save();
```

8. Flash:

```text
A New OTP Has Been Sent To Your Email.
```

9. Redirect `/verify-email`.

Important exact behavior:

- Maximum resend attempts: 3.
- Window duration: 10 minutes.
- OTP expiry: 2 minutes.
- Resend attempts reset after 10 minutes.
- Initial signup OTP does not count as a resend attempt.
- Resend logic is database-field based, not IP-rate-limit based.
- Pending user selection is not session-bound.

## 17. Login Route Behavior

Routes:

```http
GET /login
POST /login
```

Route:

```js
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    wrapAsync(userController.login),
  );
```

GET behavior:

- Renders `users/login.ejs`.

POST expected body:

```js
username
password
```

Middleware flow:

1. `saveRedirectUrl`
2. `passport.authenticate("local")`
3. `userController.login`

If Passport authentication fails:

- Redirect `/login`.
- Flash Passport failure message.

If Passport authentication succeeds:

Controller: `login`

Flow:

1. Read authenticated user:

```js
const user = req.user;
```

2. If email is not verified:

```js
if (!user.isEmailVerified) {
  ...
}
```

3. Send new email verification OTP:

```js
await sendOTP({
  target: user,
  hashField: "emailOTPHash",
  expiryField: "emailOTPExpires",
  subject: "Verify Your Email — CasaStay 🔐",
  template: "otp.ejs",
  templateData: (otp) => ({
    username: user.username,
    otp,
    otpStyle,
  }),
  recipientEmail: user.email,
});
```

4. Logout immediately:

```js
req.logout(() => {});
```

5. Flash:

```text
Email Not Verified. A New OTP Has Been Sent To Your Email.
```

6. Redirect `/verify-email`.

If email is verified:

1. Flash:

```text
Welcome Back To CasaStay
```

2. Redirect to:

```js
res.locals.redirectUrl || "/listings"
```

3. Save session before redirect.

Important exact behavior:

- Unverified users can pass username/password authentication but are immediately logged out.
- A new OTP is sent on unverified login.
- This OTP send does not increment `emailOTPAttempts`.
- Redirect-after-login is stored through session and copied into `res.locals.redirectUrl`.

## 18. Logout Flow

Route:

```http
GET /logout
```

Controller: `logout`

Flow:

```js
req.logout((err) => {
  if (err) {
    return next(err);
  }
  req.flash("success", "Logged Out!");
  res.redirect("/listings");
});
```

Important exact behavior:

- Uses Passport `req.logout`.
- Clears Passport login state from the session.
- Does not destroy the whole Express session.
- Does not manually delete the session document from MongoDB.
- Does not manually clear the cookie.
- Redirects to `/listings`.

## 19. Forgot Password Flow

Routes:

```http
GET /forgot-password
POST /forgot-password
GET /reset-password
POST /reset-password
POST /resend-reset-otp
```

### GET /forgot-password

Controller: `renderForgotPasswordForm`

Renders:

```js
users/forgotPassword.ejs
```

### POST /forgot-password

Controller: `sendResetOTP`

Expected body:

```js
email
```

Flow:

1. Find user:

```js
const user = await User.findOne({ email });
```

2. If not found:
   - flash:

```text
No Account Found With This Email.
```

   - redirect `/forgot-password`

3. Store reset email in session:

```js
req.session.resetEmail = user.email;
```

4. Send reset OTP:

```js
await sendOTP({
  target: user,
  hashField: "resetOTPHash",
  expiryField: "resetOTPExpires",
  subject: "Reset Your Password — CasaStay 🔐",
  template: "otp.ejs",
  templateData: (otp) => ({
    username: user.username,
    otp,
    otpStyle,
  }),
  recipientEmail: user.email,
});
```

5. Initialize attempts:

```js
user.resetOTPAttempts = 1;
user.resetOTPLastSentAt = Date.now();
await user.save();
```

6. Flash:

```text
OTP Sent To Your Email.
```

7. Save session and redirect `/reset-password`.

Important exact behavior:

- Password reset initial OTP counts as attempt 1.
- Password reset is tied to `req.session.resetEmail`.

## 20. Reset Password Form Flow

Route:

```http
GET /reset-password
```

Controller: `renderResetPasswordForm`

Flow:

1. If no `req.session.resetEmail`:
   - flash:

```text
Session Expired. Please Try Again.
```

   - redirect `/forgot-password`

2. Find user by session email:

```js
const user = await User.findOne({
  email: req.session.resetEmail,
});
```

3. Calculate attempts left:

```js
const resetResendAttemptsLeft =
  typeof user.resetOTPAttempts === "number"
    ? MAX_ATTEMPTS - user.resetOTPAttempts
    : null;
```

4. Render `users/resetPassword.ejs` with:

```js
{
  otpExpiry: user.resetOTPExpires ? user.resetOTPExpires.getTime() : 0,
  resetResendAttemptsLeft
}
```

## 21. Resend Reset OTP Flow

Route:

```http
POST /resend-reset-otp
```

Controller: `resendResetOTP`

Flow:

1. Read email from:

```js
const email = req.session.resetEmail;
```

2. If missing:
   - flash:

```text
Session Expired. Please Try Again.
```

   - redirect `/forgot-password`

3. Find user by email.
4. Constants:

```js
const MAX_ATTEMPTS = 3;
const WINDOW_TIME = 10 * 60 * 1000;
```

5. Reset attempts after 10-minute window:

```js
if (
  user.resetOTPLastSentAt &&
  Date.now() - user.resetOTPLastSentAt > WINDOW_TIME
) {
  user.resetOTPAttempts = 0;
}
```

6. If attempts exhausted:
   - calculate remaining minutes
   - flash:

```text
Resend OTP Limit Reached. Please Try After X Minute(s).
```

   - save session
   - redirect `/reset-password`

7. If allowed, send new OTP:

```js
await sendOTP({
  target: user,
  hashField: "resetOTPHash",
  expiryField: "resetOTPExpires",
  subject: "New OTP — CasaStay 🔐",
  template: "otp.ejs",
  templateData: (otp) => ({
    username: user.username,
    otp,
    otpStyle,
  }),
  recipientEmail: user.email,
});
```

8. Increment:

```js
user.resetOTPAttempts += 1;
user.resetOTPLastSentAt = Date.now();
await user.save();
```

9. Flash:

```text
A New OTP Has Been Sent.
```

10. Save session and redirect `/reset-password`.

## 22. Reset Password POST Flow

Route:

```http
POST /reset-password
```

Controller: `resetPassword`

Expected body:

```js
otp
password
```

Flow:

1. Read:

```js
const { otp, password } = req.body;
```

2. Hash OTP:

```js
const otpHash = hashOTP(otp);
```

3. Read email from session:

```js
const email = req.session.resetEmail;
```

4. If no email:
   - flash:

```text
Session Expired. Please Try Again.
```

   - redirect `/forgot-password`

5. Find user:

```js
const user = await User.findOne({
  email,
  resetOTPHash: otpHash,
  resetOTPExpires: { $gt: Date.now() },
});
```

6. If invalid:
   - flash:

```text
Invalid Or Expired OTP.
```

   - save session
   - redirect `/reset-password`

7. If valid:

```js
await user.setPassword(password);
user.resetOTPHash = undefined;
user.resetOTPExpires = undefined;
await user.save();
delete req.session.resetEmail;
```

8. Flash:

```text
Password Updated Successfully. Please Login.
```

9. Save session and redirect `/login`.

Important exact behavior:

- Reset OTP hash and expiry are cleared.
- `resetOTPAttempts` is not explicitly reset to 0 after success.
- `resetOTPLastSentAt` is not cleared.
- User is not automatically logged in after password reset.

## 23. Middleware and Auth Guards

File: `middleware.js`

### isLoggedIn

```js
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "You Must Be Logged In!");
    return res.redirect("/login");
  }
  next();
};
```

Behavior:

- Uses Passport `req.isAuthenticated()`.
- If unauthenticated:
  - stores original URL in `req.session.redirectUrl`
  - flashes error
  - redirects `/login`
- If authenticated:
  - continues

### saveRedirectUrl

```js
module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};
```

Behavior:

- Copies session redirect URL into `res.locals.redirectUrl`.
- Used before `passport.authenticate` on login POST.

### isOwner

Checks if current user owns a listing:

```js
if (!listing.owner.equals(res.locals.currUser._id)) {
  req.flash("error", "You Are Not The Owner Of This Listing");
  return res.redirect(`/listings/${id}`);
}
```

### isReviewAuthor

Checks if current user authored a review:

```js
if (!review.author.equals(res.locals.currUser._id)) {
  req.flash("error", "You Are Not The Author Of This Review");
  return res.redirect(`/listings/${id}`);
}
```

### storeResendAttempts

```js
module.exports.storeResendAttempts = (sessionKey) => {
  return (req, res, next) => {
    if (req.rateLimit) {
      req.session[sessionKey] = req.rateLimit.remaining;
    }
    next();
  };
};
```

This helper exists but is not wired into auth routes.

## 24. Rate Limiting and Anti-Spam Behavior

There is no active Express rate limiter configured on auth routes.

Actual resend throttling is implemented manually using MongoDB fields on the user document.

Email verification resend fields:

- `emailOTPAttempts`
- `emailOTPLastSentAt`

Password reset resend fields:

- `resetOTPAttempts`
- `resetOTPLastSentAt`

Rules:

- Maximum attempts: `3`
- Window: `10 * 60 * 1000`, exactly 10 minutes
- If last sent time is older than the window, attempts reset to 0
- If attempts are greater than or equal to 3, request is rejected with flash message
- Remaining wait time is calculated from `lastSentAt`
- OTP itself expires after 2 minutes

This means the resend limit window is longer than the OTP validity period.

## 25. Frontend OTP Countdown Behavior

File: `public/js/otpResend.js`

The server passes `window.otpExpiry` to the page.

The script:

1. Reads:

```js
const expiryTime = window.otpExpiry || 0;
```

2. Every second, calculates:

```js
const remaining = expiryTime - Date.now();
```

3. If expired:
   - shows `0:00`
   - changes message to `You Can Resend OTP Now`
   - enables resend button

4. If not expired:
   - shows `minutes:seconds`

Important behavior:

- The resend button is disabled until OTP expiry time is reached.
- This is client-side only.
- Server-side resend restriction is based on attempts and 10-minute window, not just button state.

## 26. Validation Rules

There is no Joi schema for auth in `schema.js`.

`schema.js` only validates listings and reviews.

Signup form client-side:

- `username`: required
- `email`: type `email`, required
- `password`: required

Login form client-side:

- `username`: required
- `password`: required

Verify email form client-side:

- `otp`: required
- `maxlength="6"`
- `pattern="[0-9]{6}"`
- `inputmode="numeric"`

Reset password form client-side:

- `otp`: required
- `maxlength="6"`
- `pattern="[0-9]{6}"`
- `inputmode="numeric"`
- `password`: required

Server-side auth validation:

- Signup checks duplicate email.
- Passport Local Mongoose checks username and password requirements.
- Passport Local Mongoose checks duplicate username.
- Email verification explicitly checks if OTP is missing.
- OTP validity is checked through SHA-256 hash and expiry database query.
- Password reset requires `req.session.resetEmail`.
- Password reset OTP validity is checked through SHA-256 hash and expiry database query.

No server-side email format validation is implemented in auth controllers.

## 27. API Request and Response Behavior

This app is primarily server-rendered and redirect-based.

Most auth endpoints return redirects and flash messages, not JSON.

### GET /signup

Response:

- Render `users/signup.ejs`

### POST /signup

Success:

- Flash success
- Redirect `/verify-email`

Duplicate email:

- Flash error
- Redirect `/login`

Other error:

- Flash error
- Redirect `/signup`

### GET /verify-email

Success:

- Render `users/verifyEmail.ejs`

No pending user:

- Flash error
- Redirect `/signup`

### POST /verify-email

Success:

- Mark email verified
- Clear OTP hash and expiry
- Reset attempts to 0
- Send welcome email
- Log user in
- Flash success
- Redirect `/listings`

Missing OTP:

- Flash error
- Redirect `/verify-email`

Invalid/expired OTP:

- Flash error
- Redirect `/verify-email`

### POST /resend-otp

Success:

- Send new OTP
- Increment attempts
- Update last sent time
- Flash success
- Redirect `/verify-email`

Limit reached:

- Flash error with minute count
- Redirect `/verify-email`

No pending user:

- Flash error
- Redirect `/signup`

### GET /login

Response:

- Render `users/login.ejs`

### POST /login

Passport failure:

- Flash failure
- Redirect `/login`

Verified user success:

- Flash success
- Redirect saved URL or `/listings`

Unverified user:

- Send new verification OTP
- Logout user
- Flash error
- Redirect `/verify-email`

### GET /logout

Success:

- Passport logout
- Flash success
- Redirect `/listings`

### GET /forgot-password

Response:

- Render `users/forgotPassword.ejs`

### POST /forgot-password

Success:

- Store reset email in session
- Send reset OTP
- Set reset attempts to 1
- Set reset last sent time
- Flash success
- Redirect `/reset-password`

No user:

- Flash error
- Redirect `/forgot-password`

### GET /reset-password

Success:

- Render `users/resetPassword.ejs`

No reset email in session:

- Flash error
- Redirect `/forgot-password`

### POST /resend-reset-otp

Success:

- Send new reset OTP
- Increment reset attempts
- Update reset last sent time
- Flash success
- Redirect `/reset-password`

Limit reached:

- Flash error
- Redirect `/reset-password`

No reset session:

- Flash error
- Redirect `/forgot-password`

### POST /reset-password

Success:

- Update password using Passport Local Mongoose
- Clear reset hash and expiry
- Delete reset email from session
- Flash success
- Redirect `/login`

Invalid/expired OTP:

- Flash error
- Redirect `/reset-password`

No reset session:

- Flash error
- Redirect `/forgot-password`

## 28. Security Mechanisms

Implemented security patterns:

- Passwords hashed by Passport Local Mongoose with PBKDF2 SHA-256.
- Password hash and salt are stored in MongoDB.
- OTP plaintext is never stored.
- OTP is stored as SHA-256 hex digest.
- OTP expiry is enforced in MongoDB query.
- OTP resend attempts are tracked in MongoDB.
- OTP resend window is enforced by server logic.
- Sessions are HTTP-only cookies.
- Sessions are persisted server-side in MongoDB.
- Auth guards use Passport `req.isAuthenticated()`.
- Protected routes store original URL before redirecting to login.
- Email verification is mandatory before successful login.
- Unverified login sends OTP and immediately logs user out.
- Session reset email is required for password reset.

Not implemented or not active:

- No JWT.
- No CSRF protection visible in auth forms.
- No active Express rate limiter on auth routes.
- No IP-based OTP rate limit.
- No server-side Joi validation for auth requests.
- No server-side OTP format check beyond hash lookup, except missing OTP in email verification.
- No explicit cookie `secure`.
- No explicit cookie `sameSite`.
- No full session destruction on logout.
- Brevo failures are logged but not propagated.

## 29. Exact Patterns To Preserve In FastAPI Recreation

To recreate the current behavior accurately:

1. Use session-based authentication, not JWT.
2. Store server-side sessions in MongoDB or equivalent persistent storage.
3. Use an HTTP-only cookie with 7-day lifetime.
4. Authenticate users by username and password.
5. Store user email separately and make email verification mandatory.
6. Hash passwords using PBKDF2 SHA-256 with:
   - 25,000 iterations
   - 32-byte salt
   - 512-byte derived key
   - hex encoding
7. Generate OTP using secure random numeric generation in the 6-digit range.
8. Hash OTP using unsalted SHA-256 hex digest.
9. Store only OTP hash and expiry in MongoDB.
10. Set OTP expiry to exactly 2 minutes.
11. Use 3 resend attempts per 10-minute window.
12. Reset resend attempts when the 10-minute window expires.
13. For signup email verification:
    - initial OTP does not increment attempts
    - successful verification resets attempts to 0
14. For login by unverified user:
    - allow password authentication first
    - send a new verification OTP
    - immediately log user out
    - redirect to verify email
15. For password reset:
    - store reset email in session
    - initial reset OTP counts as attempt 1
    - resend reset OTP uses same 3-per-10-minute logic
    - successful reset clears reset OTP hash and expiry
    - successful reset deletes reset email from session
    - successful reset does not automatically log user in
16. Use Brevo SMTP HTTP API:
    - endpoint `https://api.brevo.com/v3/smtp/email`
    - API key header `api-key`
    - sender name `CasaStay`
    - sender email `CasaStay008@gmail.com`
17. Preserve redirect and flash-message style behavior if recreating the same UX.
18. Preserve `isLoggedIn` behavior:
    - unauthenticated users are redirected to login
    - original URL is saved and used after successful login
19. Preserve logout behavior:
    - clear Passport/auth state from session
    - do not destroy whole session
    - redirect `/listings`

## 30. Important Behavioral Quirks To Know

These are part of the observed implementation:

- Email verification is not session-bound.
- `/verify-email` and `/resend-otp` find any unverified user, attempting to sort by `createdAt`.
- User schema does not define `createdAt`.
- OTP verification searches by OTP hash and expiry only.
- Initial signup OTP does not count toward resend attempts.
- Login-generated OTP for unverified users does not count toward resend attempts.
- Password reset initial OTP does count as attempt 1.
- Password reset success does not reset `resetOTPAttempts`.
- Logout does not destroy the whole session.
- Brevo email errors do not fail the controller flow.
- Installed rate-limit packages are not currently active in auth routes.
- OTP style and welcome email style templates reference `footer`, while the style objects export `footerStyle`.

