---
'@augur/kit-common': minor
---

Common gets Dialog and Heading in React. A Dialog's primary checks every field inside it and goes to the first gap. While it works, nothing can be pressed and Esc waits, and if it fails the dialog stays open and says why. Focus starts on the first empty field, or on Cancel for a danger action. Fields tell a surrounding form about themselves through `useFieldCheck`.
