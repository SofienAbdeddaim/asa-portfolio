# Back-office guide

The back-office lives at `/admin` (for example http://localhost:4200/admin). It is private, not indexed, and only in English. Your content is still entered in three languages.

## First sign-in

1. Create the admin account once (see the API README): `pnpm --filter @asa/api seed:admin`.
2. Open `/admin` and sign in with that email and password.
3. **Two-factor authentication is mandatory.** The first time, you scan a QR code with an authenticator app (or type the key by hand) and enter the 6-digit code.
4. You then get **ten recovery codes**. Save them somewhere safe (a password manager). Each works once if you lose your phone. They are shown only this one time.

Later sign-ins ask for the 6-digit code, or a recovery code ("Use a recovery code").

## Managing content

| Section                                                                         | What it is                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Profile                                                                         | One entry: name, headline, bio, photo, availability, social links. |
| Experience, Skills, Projects, Education, Certificates, Testimonials, Blog posts | Lists. **New** adds one, the title opens it for editing.           |

- **Languages.** Every text has English, French and Arabic boxes. Only English is required. The list marks FR and AR as complete once every field that has English text is also translated. A missing translation falls back to English on the site.
- **Draft or published.** New entries start as drafts and stay private until you publish them (button on the list, or the checkbox in the editor).
- **Order.** The order in the list is the order on the site. Drag a row, or use the arrow buttons.
- **Images.** "Upload image" accepts JPEG, PNG, WebP, GIF or AVIF up to 5 MB. They are resized (1600px wide at most), converted to WebP, and stripped of camera and location data.
- **Blog posts and project descriptions use Markdown**: a toolbar for bold, italic, headings, lists, links and code, and a live preview next to the editor. Each language has its own tab.
- **Delete** asks for confirmation and cannot be undone.

## If something goes wrong

- _Lost authenticator and recovery codes:_ there is no self-service reset on purpose. Remove the user and its sessions from the `portfolio` database, run `seed:admin` again, and enroll again.
- _"Your session expired":_ sign in again. Sessions last 7 days of activity; the short-lived access token renews itself.
- _Too many attempts:_ sign-in is limited to 5 tries per minute and the account locks for 15 minutes after 5 wrong passwords.
