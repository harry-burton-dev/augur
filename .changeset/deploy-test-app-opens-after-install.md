---
---

The deploy test's browser check waits for a just-installed app's first answer through the gateway instead of for the page to go idle, and while that answer is the gateway's "Nothing is served" it tries again for up to a minute and a half, as a person would, saying how many tries it took. Any other failure counts the first time.
