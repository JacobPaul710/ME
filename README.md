# Tracker: Patch 1

A workout and nutrition tracker that installs to your phone's home screen.
Plain HTML, CSS and JavaScript. Data is kept on the phone (so it works offline)
and syncs to your own Supabase database.

## Folder map
- `index.html`, `css/app.css`: the page and the one shared style
- `js/logic/`: rules and math (streak, rep goal, nutrition, search). No screens in here.
- `js/core/`: storage, sync, sign-in, food lookups, barcode scanner
- `js/data.js`: connects the logic to storage
- `js/ui/`: the screens
- `js/ui/streakWidget.js`: the streak look (placeholder flame for now)
- `js/celebrations.js`: milestone pop-ups (wording and animation)
- `sw.js`: offline support. Bump `VERSION` with every patch.
- `supabase/schema.sql`: the database table and security rules
- `tools/build-usda.py`: builds the offline basic-foods list

## Setup
See the steps in the chat message that came with this patch.
