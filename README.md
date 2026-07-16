# Learning Map Prototype

A dependency-free interactive learning map for **Interactive Computer Graphics**.

## Features

- Zoomable and draggable concept map
- Hierarchical and cross-topic links
- Read, recall, application, and connection modes
- Fill-in-the-blank exercises
- Transfer tasks
- Progress saved locally in the browser

## Run locally

Open `index.html` directly, or run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the default branch and the `/ (root)` folder, then save.

The site will normally become available at:

`https://malynnxq.github.io/expert-octo-system/`

## Edit the course

- Edit `data.js` to change concepts, explanations, exercises, positions, and links.
- Edit `app.js` to change behavior.
- Edit `style.css` to change the visual design.
