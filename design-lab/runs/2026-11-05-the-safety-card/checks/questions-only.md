# Reader test

You are an admin on a single-server AUGUR deployment. You are upgrading
from AUGUR 0.9 to the current release after two months away. You have the
server open and twenty minutes. You upgrade by hand.

Answer each question from the text you were given, and from nothing else.
For each answer:
1. Give the answer in a sentence or two.
2. Quote the line or lines it came from.
3. Name the heading (or the first words of the line) where you found it.
4. If the text doesn't answer it, write "The text doesn't say", and don't guess.
5. Say if you had to guess, or if two parts of the text seemed to disagree.

## Questions

1. Which settings must you add to `.env` for Mandate when you upgrade by hand, and which of them is optional?
2. The release that moves Keycloak to 26.8: what must you do before you upgrade, and how should you take that release?
3. After that upgrade, how do you check the realm job worked?
4. If something goes wrong after that release, can you just go back to the release before? What do you lose?
5. Your server has 6 GB of memory. Is there anything to do before upgrading?
6. What happens to a server that never runs the release that comes with the repository's new name?
7. After this upgrade, will AUGUR start installing new releases by itself? If so, which ones and when?
8. Can you upgrade straight from 0.9 to the current release, or must you go through another release first? If so, which?

At the end, in two or three sentences: what was hardest to find, and what
would you have done wrong on the server if you had trusted your first reading?
