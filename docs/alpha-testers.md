# For alpha testers

Thank you for trying AUGUR early. This guide is for the people invited to the alpha: what it is, what to try, what doesn't work yet, and how to tell us when something goes wrong. Your server may show AUGUR under your organisation's own name for it. That name is set when the server is installed (`ORG_PRODUCT_NAME`), and this guide says AUGUR throughout.

## What the alpha is

AUGUR is where an organisation keeps its documents, its intent and what it knows, on **floors**: one for you, one for each team and department, and one for the whole organisation. What you make starts on your own floor or your team's, and you choose what goes up to the floors above.

The alpha is the first release built for people to use, rather than for building AUGUR. It has been checked by a scripted run of sample people over 48 hours on a server like yours, and that server was wiped before you arrived, so everything on it is yours. It is still early. Some things are missing, and they say so where you'd look for them. Expect the look to change as we learn from you.

It runs in a desktop browser. There is no layout for phones or small tablets yet.

## Getting in

Your admin adds you in Admin → People. Where the server can send email, you get an invite that lasts 72 hours: follow it to confirm your email and choose a password. Otherwise your admin gives you a one-time password, and you choose your own when you first sign in. If your role needs it, you also set up a code app or a passkey.

## Getting around

- Press `` ` `` (or Ctrl K, or ⌘ K) anywhere to open the shell: the menus over everything, with Find and the Inbox.
- The two round buttons top left go to **Home** and to **All apps**, from anywhere. Beside them is the floor you're on. Alt PgUp and Alt PgDn go up or down a floor.
- Your own settings are in **Account**: your profile, sign-in and security, notifications, appearance, language and region, privacy and data, and **About and help**, which shows what's running and the keys.
- The **Inbox** holds everything waiting on you or your team. A notification only tells you something; an Inbox item stays until it's dealt with.

## What to try

**Artifacts** keeps documents.
- Make a library on your own floor and add a few documents (**Add**, then **Add files**): PDF, Word (.docx), HTML, Markdown or plain text. Each shows as a page you can read.
- Move a document from In progress to In review to Complete, then **Publish up the floors** to your team's floor, choosing which states it shows there. Ask a teammate to find it with **Find**, and ask someone outside the team to try too: they shouldn't see it, and should be told why.

**Mandate** holds what a floor means to achieve and why.
- Write an intent on your team's floor and pass a part of it down to someone.
- As the holder, say you can't hold a part, and watch how it comes back up.

**Data Atlas** holds the things your organisation keeps track of (ships, ports, organisations, people, places) and what is known about them.
- Look something up by name, or by another name it goes by, and open it to see what's known, where each detail came from, and what uses it.
- In Artifacts, mark some words in a document and choose **Add to Data Atlas**. As a team lead, decide what it is in **Triage**.
- Bind an intent in Mandate to an entity, then open the entity's **Used by** in Data Atlas.

**Home** is where you start on each floor: the first open Inbox items, the notifications that need you, and your apps.

**Explorer** is the map: the floors you can go to and why, who's on each, and which apps you can use there. It changes nothing, and tells you who could.

**Admin**, if you're an admin: People (adding, changing, and someone leaving), Departments, Apps, Organisation (your organisation's name, time zone and email sender), Activity (who did what, with a download), and Status.

**The Upgrade Centre**, for admins, says which releases are available and how an upgrade went.

## Feature previews

Some new designs are in AUGUR but off until you choose them. These are **feature previews**. On the alpha server you turn each one on for yourself in **Previews**, in the band at the top of the shell, and turn it off the same way. While one is on, its app says **Preview on**, with the way back.

In this release, Home offers two previews from AUGUR's new design direction:
- **Focal planes**: what needs you comes forward, and the rest goes quiet behind it.
- **Radial menu**: right-click, long-press or use the "more" mark on something that needs you, to see its actions in a ring.

We'd like to know whether they help, get in the way, or confuse you.

## What doesn't work yet

Each of these stays visible where you'd look for it, says it isn't there yet, and says who can change it.

- **Phones and small tablets:** there is no layout for them yet. Use a desktop browser.
- **Agents:** AUGUR's own AI helpers aren't built. The shell shows Agents as unavailable.
- **Choosing who gets a preview:** for AUGUR's own apps, an admin can't yet choose who gets a feature preview, so each person decides for themselves.
- **Reading sources by itself:** Data Atlas doesn't read documents on its own yet. A person files what a document mentions, and a lead decides in Triage. Places are written as words until the map arrives.
- **Matching by meaning** in Data Atlas works only where the server has an AI model set up. Without one, Triage says it matched by name and spelling only, and why.
- **Email** (invites, notification emails, password resets) works only where the server has a mail relay. Admin → Status, Email says whether it does.
- **Accounts going idle:** accounts that go unused don't turn themselves off yet, and a person's data isn't deleted after they leave. Their sign-in is turned off, and they're signed out everywhere at once.
- **Explorer** doesn't yet show what apps have been doing on a floor, such as a document published there.
- **A report button:** there isn't one yet. See below.

## Telling us about a problem

Tell the person who invited you, by whatever way you normally reach them. Include:

1. **What you were doing**, and what you expected to happen.
2. **What happened instead**, with the exact words on the screen if it said why. A screenshot helps.
3. **Where:** the app, and the floor you were on.
4. **When**, to the minute, and your time zone. That lets an admin find it in the server's logs and in Admin → Activity.
5. **The version**, from Account → About and help → What's running.

If something says it can't be done, and why, and that seems wrong, tell us that too: the wording is part of what we're testing.

## What happens to your data

The alpha server keeps what you make, under the same rules as a real deployment: backed up each night, and kept for the periods your organisation sets. Privacy and data, in Account, shows what's kept about you and lets you download it. Before the next phase, we'll tell you whether this server carries on or is replaced.
