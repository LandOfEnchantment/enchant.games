-- What each address agreed to, by the wording the form showed when it signed up:
--   releases         "Want to know when a game is out? Leave your email and we'll let you
--                    know." (2026-10-12, before the checkbox; for a while it added "We won't
--                    use it for anything else."). Release announcements only.
--   games-and-sales  the checkbox: news about our games, including releases and sales
--                    promotions, under the privacy policy (js/signup.js).
-- The rows already here signed up under the first.
ALTER TABLE signups ADD COLUMN consent TEXT NOT NULL DEFAULT 'releases';
