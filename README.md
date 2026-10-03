# 75 Hard Tracker

A Notion-style tracker for the 75 Hard challenge. Open `index.html` in a browser; there's no build step and nothing to install.

To run it on localhost:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

- **3D cover (three.js)** shows all 75 days as a ring of glass beads: pink for done, gold for in progress, grey for missed, frosted for days still ahead. Today has a pulsing halo, reward gems light up when unlocked, and the arc in the middle fills with your streak. Hover a bead to see the day, click it to open that day.
- **Calendar** in the sidebar shows the start date, today, the finish line, and which days are done or missed. **Reset** makes today Day 1, and every date on the page moves with it: day pages, reward unlock dates and the finish line.
- **Days board** lets you create a page for each day with as many tasks as you want. A day with every task checked turns pink and moves to *Complete*.
- **Rewards** come every 15 days: a book at each one, then a piercing, a tattoo, a Lululemon top and an omakase dinner. A reward unlocks once every day up to it is complete. Its card then turns into a "Claim reward" link. Click a card to change the title, day, link or photo.
- **Progress reports** let you log mood, weight, notes and a photo.
- Data is saved in your browser's localStorage. Use *Export / Import backup* in the sidebar to move it to another device.

To host it, turn on GitHub Pages for this repo (Settings → Pages → deploy from branch).
