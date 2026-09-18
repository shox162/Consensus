# Consensus

Interactive demo of **Station 3 — Reach Consensus** for the Swiss Pavilion experience concept (EXPO 2027 Belgrade).

Players steer hollow light rings with keyboard “wheels”. When two rings overlap they merge; merged players steer together (inputs add, opposite turns cancel). When one ring remains, the table flashes and a new round starts after 5 seconds.

## Run

Open `index.html` in a browser, or:

```bash
python -m http.server 8765
```

Then go to `http://127.0.0.1:8765/`.

First wheel key starts the round. Language: SRP / ENG.

| Players | Keys |
| --- | --- |
| 1 | A / D |
| 2 | J / L |
| 3 | ← / → |
| 4 | F / H |
| 5 | 1 / 3 |
| 6 | U / O |
