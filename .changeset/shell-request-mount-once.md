---
'@augur/shell': patch
---

An app answering a request (a picker, or any app opened over another) is mounted once per request. Before, the catalogue loading again while its dialog was open mounted it a second time, so whatever the person had started in it was lost.
