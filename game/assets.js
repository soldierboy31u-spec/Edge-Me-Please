"use strict";
/* Redemption's Edge — assets.js
   Lightweight image loader (RE-ART-002). Loads once, caches by key, fails safe.
   Works on file:// (Image()) and GitHub Pages. See docs/CHARACTER_SPRITE_SPEC.md. */

const Assets = {
  _imgs: {},      // key -> HTMLImageElement | HTMLCanvasElement (placeholder)
  _status: {},    // key -> 'ok' | 'fail' | 'placeholder' | 'loading'
  // Load an image by key from src. Never rejects — resolves null on failure so
  // the game keeps running. Duplicate loads return the cached image.
  loadImage(key, src) {
    if (this._imgs[key]) return Promise.resolve(this._imgs[key]);
    this._status[key] = 'loading';
    return new Promise((resolve) => {
      const img = new Image();
      img.onload  = () => { this._imgs[key] = img; this._status[key] = 'ok'; resolve(img); };
      img.onerror = () => { this._status[key] = 'fail'; console.warn('[assets] could not load ' + src); resolve(null); };
      img.src = src;
    });
  },
  set(key, imgOrCanvas, status) { this._imgs[key] = imgOrCanvas; this._status[key] = status || 'ok'; },
  getImage(key) { return this._imgs[key] || null; },
  status(key)  { return this._status[key] || 'none'; },
};
