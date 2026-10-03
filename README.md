# 75 Hard Tracker

A Notion-style tracker for the 75 Hard challenge. Open `index.html` in a browser; there's no build step and nothing to install.

To run it on localhost:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

- **3D cover (three.js)** shows all 75 days as a ring of beads in black and white: solid for done, grey for in progress, small and dim for missed, frosted glass for days still ahead. Today has a ring around it, reward gems light up when unlocked, and the arc in the middle fills with your streak. Hover a bead to see the day, click it to open that day.
- **Calendar** in the sidebar shows the start date, today, the finish line, and which days are done or missed. **Reset** makes today Day 1, and every date on the page moves with it: day pages, reward unlock dates and the finish line.
- **Days board** lets you create a page for each day with as many tasks as you want. A day with every task checked turns solid black and moves to *Complete*.
- **Rewards** come every 15 days: a book at each one, then a piercing, a tattoo, a Lululemon top and an omakase dinner. A reward unlocks once every day up to it is complete. Its card then turns into a "Claim reward" link. Click a card to change the title, day, link or photo.
- **Progress reports** let you log mood, weight, notes and a photo.
- Data is saved in your browser's localStorage. Use *Export / Import backup* in the sidebar to move it to another device.

To host it, turn on GitHub Pages for this repo (Settings → Pages → deploy from branch).

## Look

Black and white throughout, in both light and dark mode. Photos show in greyscale, and a reward's photo turns to full colour once you unlock it.

## Photos

The photos in `assets/photos/` ship with the site, so they work offline and anywhere the page is hosted. They come from these open-source website templates on GitHub: SarahPorzig/AlphaYoga, bootstrap4cc/bootstrap-4-free-yoga-website-theme, phuthuy44/Books-Shop-Website, charvitete3012-coder/Jewellery-shop-01, MadeAndikaPramana/tattoo-studio-3, eastend-street/umi-sushi and withaarzoo/Responsive-Gym-Website. To use your own photo anywhere, click it and upload.
