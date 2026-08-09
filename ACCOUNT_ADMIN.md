# Account admin

Everything here is done by you, in the Supabase dashboard. None of it is in the game.

## Deleting someone's account

The privacy note on the character select screen tells players to open a GitHub issue to
request deletion. When one arrives:

1. **Check they own the address.** The issue only proves they control a GitHub account, not
   the email. Ask them to send the request from the email address on the account, or to
   confirm a detail only the owner would know. Do not delete on an unverified request: a
   malicious issue naming someone else's email is otherwise enough to wipe their progress.
2. Supabase dashboard → **Authentication** → **Users**.
3. Find the address, open the row menu, **Delete user**.

That is all. `profiles` and `runs` both declare
`references auth.users(id) on delete cascade`, so deleting the auth user removes their
profile and every run in the same operation. Nothing is left behind.

To confirm afterwards, run this in the SQL editor. Both counts should be 0:

```sql
select
  (select count(*) from public.profiles where user_id = 'THE-UUID') as profile_rows,
  (select count(*) from public.runs     where user_id = 'THE-UUID') as run_rows;
```

## Answering "what do you have on me"

Also a right people have. In the SQL editor, with their user id:

```sql
select * from public.profiles where user_id = 'THE-UUID';
select * from public.runs     where user_id = 'THE-UUID' order by created_at desc;
```

Send them the output. It is achievements, compendium, and their run history. The email
address itself lives in Authentication → Users.

## Password resets

Nothing for you to do. The player uses **Forgot password** on the character select screen,
Supabase emails them a link, they set a new one. You are never involved, and you can never
see anyone's password: only Supabase stores it, hashed.

If someone says the email never arrived, the likely causes are spam filtering or the free
tier's built-in email rate limit (a few per hour across the whole project). Supabase
dashboard → **Authentication** → **Logs** shows whether it was actually sent.

## The free tier pauses

A Supabase free project sleeps after 7 days with no requests and wakes on the next one, so
the first load after a quiet week is slow. Accounts fail soft when this happens: the game
shows a message and carries on as a guest, so a paused project never blocks play.

## What is NOT stored

No passwords (Supabase holds those, hashed, never the game). No IP logging by the game. No
analytics, no third-party scripts, no advertising. A logged-out player sends nothing
anywhere: progress stays in their browser and moves only via progress codes.
