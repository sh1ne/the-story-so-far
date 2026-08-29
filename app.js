const $ = selector => document.querySelector(selector);

const view = $("#view");
const backBtn = $("#backBtn");
const homeBtn = $("#homeBtn");
const viewer = $("#viewer");
const viewerImg = $("#viewerImg");
const viewerCaption = $("#viewerCaption");
const viewerStage = $("#viewerStage");

let library = null;
let state = { screen: "categories", category: null, sub: null, search: "", imageBackTo: "subs" };
let viewerItems = [];
let viewerIndex = 0;
let scale = 1;
let tx = 0;
let ty = 0;
let pointerStart = null;
let touchStart = null;
let lastDist = 0;
let currentMapURL = null;
let mapObjectURLs = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function fallback(label) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 360">
      <rect width="500" height="360" fill="#eee8dc"/>
      <path d="M65 270 Q140 185 220 260 T440 235" fill="none" stroke="#766b5d" stroke-width="7"/>
      <path d="M110 240 Q160 175 215 235 M275 230 Q325 160 390 225" fill="none" stroke="#766b5d" stroke-width="6"/>
      <text x="250" y="325" text-anchor="middle" font-family="Georgia" font-size="22" fill="#766b5d">${String(label).replace(/[<>&]/g, "")}</text>
    </svg>`
  )}`;
}

function commonsFileURL(file) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;
}

function normalizeLibrary(raw) {
  return {
    categories: (raw.categories || []).map(category => ({
      id: category.id,
      name: category.name || category.title || category.id,
      subcategories: (category.subcategories || []).map(sub => ({
        id: sub.id,
        name: sub.name || sub.title || sub.id,
        images: (sub.images || []).map(image => ({
          ...image,
          title: image.title || image.name || sub.title || sub.name || "Reference",
          src: image.src || (image.file ? commonsFileURL(image.file) : ""),
          searchText: [
            image.title, image.name, image.file,
            ...(image.tags || [])
          ].filter(Boolean).join(" ").toLowerCase()
        }))
      }))
    }))
  };
}

async function removeOldServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("story-so-far")).map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Could not clear old cache:", error);
  }
}

async function load() {
  await removeOldServiceWorkers();
  const response = await fetch(`data/library.json?cb=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Reference library could not be loaded (${response.status}).`);
  library = normalizeLibrary(await response.json());
  render();
}

function setState(next) {
  state = { ...state, ...next };
  render();
  updateNav();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function updateNav() {
  document.querySelectorAll(".nav-btn").forEach(button => {
    const target = button.dataset.nav;
    const active =
      (target === "categories" && ["categories", "subs", "images"].includes(state.screen)) ||
      (target === "maps" && ["maps", "map-add", "map-detail"].includes(state.screen));
    button.classList.toggle("active", active);
  });
}

function render() {
  backBtn.hidden = !["subs", "images", "map-add", "map-detail"].includes(state.screen);

  if (state.screen === "categories") categories();
  else if (state.screen === "subs") subs();
  else if (state.screen === "images") images();
  else if (state.screen === "maps") maps().catch(showError);
  else if (state.screen === "map-add") mapForm();
  else if (state.screen === "map-detail") mapDetail();
}

function categories() {
  view.innerHTML = `
    <section class="title-card">
      <div class="title-card-kicker">THE STORY SO FAR</div>
      <p>Make the map. Keep the story.</p>
      <small>A visual reference library for drawing your world, plus a private place to keep photographs of the maps your group creates.</small>
    </section>
    <div class="section-head compact"><h1>Drawing References</h1></div>
    <input class="search" id="search" placeholder="Search horses, swords, castles…" value="${escapeAttr(state.search)}">
    <div class="category-list" id="catgrid"></div>`;

  $("#search").oninput = event => {
    state.search = event.target.value;
    renderCategoriesGrid();
  };

  renderCategoriesGrid();
}

function renderCategoriesGrid() {
  const query = (state.search || "").trim().toLowerCase();

  const categoryIcons = {
    animals: "🐾", buildings: "🏛", monsters: "🐉", objects: "📦",
    people: "🧑", plants: "🌿", vehicles: "🛞", weapons: "⚔"
  };

  const subcategoryIcons = {
    horses: "🐎", dogs: "🐕", cats: "🐈", birds: "🐦", fish: "🐟", wild: "🦌",
    swords: "🗡", axes: "🪓", bows: "🏹", shields: "🛡", fantasy: "✨",
    houses: "🏠", castles: "🏰", towers: "🗼", temples: "⛪", village: "🏘",
    standing: "🧍", warriors: "⚔", travelers: "🎒", groups: "👥",
    trees: "🌳", flowers: "🌷", crops: "🌾", vines: "🌿", mushrooms: "🍄",
    wagons: "🛒", boats: "⛵", other: "🛷",
    dragons: "🐲", giants: "🗿", undead: "💀", creatures: "👾",
    chests: "🧰", containers: "🛢", tools: "🔧", books: "📚", misc: "🏷"
  };

  // TSF8 expands the browse directory without adding fake empty sections.
  // Every alias below opens an existing reference group that already contains images.
  const aliases = [
    ["Archery", "weapons", "bows", "🏹"],
    ["Armor", "weapons", "shields", "🛡"],
    ["Boats", "vehicles", "boats", "⛵"],
    ["Camp Gear", "objects", "tools", "⛺"],
    ["Creatures", "monsters", "creatures", "👾"],
    ["Fantasy Creatures", "monsters", "creatures", "👾"],
    ["Fantasy Vehicles", "vehicles", "other", "🛸"],
    ["Fantasy Weapons", "weapons", "fantasy", "✨"],
    ["Figures", "people", "standing", "🧍"],
    ["Flags", "objects", "misc", "🚩"],
    ["Inns", "buildings", "village", "🏠"],
    ["Other Vehicles", "vehicles", "other", "🛷"]
  ];

  const rows = [];
  const addRow = row => {
    const key = `${row.name.toLocaleLowerCase()}|${row.type}|${row.categoryId || row.id || ""}`;
    if (!rows.some(item => item._key === key)) rows.push({ ...row, _key: key });
  };

  library.categories.forEach(category => {
    const referenceCount = category.subcategories.reduce((total, sub) => total + sub.images.length, 0);
    const categoryMatches = !query ||
      category.name.toLowerCase().includes(query) ||
      category.subcategories.some(sub =>
        sub.name.toLowerCase().includes(query) ||
        sub.images.some(image => image.searchText.includes(query))
      );

    if (categoryMatches) {
      addRow({
        type: "category",
        id: category.id,
        name: category.name,
        icon: categoryIcons[category.id] || "✦",
        meta: `${referenceCount} references ›`
      });
    }

    category.subcategories.forEach(sub => {
      const subMatches = !query ||
        sub.name.toLowerCase().includes(query) ||
        sub.images.some(image => image.searchText.includes(query));
      if (!subMatches) return;

      addRow({
        type: "subcategory",
        categoryId: category.id,
        subId: sub.id,
        name: sub.name,
        parent: category.name,
        icon: subcategoryIcons[sub.id] || categoryIcons[category.id] || "✦",
        meta: `${sub.images.length} reference${sub.images.length === 1 ? "" : "s"} ›`
      });
    });
  });

  aliases.forEach(([name, categoryId, subId, icon]) => {
    const category = library.categories.find(item => item.id === categoryId);
    const sub = category?.subcategories.find(item => item.id === subId);
    if (!category || !sub) return;

    const aliasMatches = !query ||
      name.toLowerCase().includes(query) ||
      category.name.toLowerCase().includes(query) ||
      sub.name.toLowerCase().includes(query) ||
      sub.images.some(image => image.searchText.includes(query));
    if (!aliasMatches) return;

    addRow({
      type: "subcategory",
      categoryId,
      subId,
      name,
      parent: category.name,
      icon,
      meta: `${sub.images.length} reference${sub.images.length === 1 ? "" : "s"} ›`
    });
  });

  const sortedRows = rows.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  $("#catgrid").innerHTML = sortedRows.map(row => {
    if (row.type === "category") {
      return `
        <button class="category-row category-row-parent" data-cat="${escapeAttr(row.id)}">
          <span class="category-icon" aria-hidden="true">${row.icon}</span>
          <span class="category-row-copy"><span class="category-row-name">${escapeHtml(row.name)}</span></span>
          <span class="category-row-meta">${row.meta}</span>
        </button>`;
    }

    return `
      <button class="category-row" data-direct-cat="${escapeAttr(row.categoryId)}" data-direct-sub="${escapeAttr(row.subId)}">
        <span class="category-icon" aria-hidden="true">${row.icon}</span>
        <span class="category-row-copy">
          <span class="category-row-name">${escapeHtml(row.name)}</span>
          <small class="category-row-parent-label">${escapeHtml(row.parent)}</small>
        </span>
        <span class="category-row-meta">${row.meta}</span>
      </button>`;
  }).join("") || `<div class="empty">Nothing matched that search.</div>`;

  $("#catgrid").querySelectorAll("[data-cat]").forEach(button => {
    button.onclick = () => setState({ screen: "subs", category: button.dataset.cat, sub: null, search: "" });
  });

  $("#catgrid").querySelectorAll("[data-direct-cat]").forEach(button => {
    button.onclick = () => setState({
      screen: "images",
      category: button.dataset.directCat,
      sub: button.dataset.directSub,
      search: "",
      imageBackTo: "categories"
    });
  });
}

function getCategory() {
  return library.categories.find(category => category.id === state.category);
}

function subs() {
  const category = getCategory();
  if (!category) return setState({ screen: "categories" });

  const subsSorted = [...category.subcategories].sort((a, b) => a.name.localeCompare(b.name));

  view.innerHTML = `
    <div class="section-head"><h1>${escapeHtml(category.name)}</h1></div>
    <div class="subgrid" id="subgrid"></div>`;

  $("#subgrid").innerHTML = subsSorted.map(sub => `
    <button class="subcard" data-sub="${escapeAttr(sub.id)}">
      <strong>${escapeHtml(sub.name)}</strong>
      <span>${sub.images.length} reference${sub.images.length === 1 ? "" : "s"} ›</span>
    </button>
  `).join("");

  $("#subgrid").querySelectorAll("[data-sub]").forEach(button => {
    button.onclick = () => setState({ screen: "images", sub: button.dataset.sub, imageBackTo: "subs" });
  });
}

function images() {
  const category = getCategory();
  const sub = category?.subcategories.find(item => item.id === state.sub);
  if (!category || !sub) return setState({ screen: "categories" });

  const imgs = sub.images || [];
  view.innerHTML = `
    <div class="section-head"><h1>${escapeHtml(sub.name)}</h1><span>${imgs.length}</span></div>
    ${imgs.length ? `<div class="image-grid" id="imggrid"></div>` : `<div class="empty">This section is ready for more references.</div>`}`;

  if (!imgs.length) return;

  $("#imggrid").innerHTML = imgs.map((image, index) => `
    <button class="image-tile" data-i="${index}" aria-label="Open ${escapeAttr(image.title)}">
      <img loading="lazy" src="${escapeAttr(image.src)}" alt="${escapeAttr(image.title)}">
    </button>
  `).join("");

  $("#imggrid").querySelectorAll("img").forEach(image => {
    image.onerror = () => {
      image.onerror = null;
      image.src = fallback("Reference");
    };
  });

  $("#imggrid").querySelectorAll("[data-i]").forEach(button => {
    button.onclick = () => openViewer(imgs, Number(button.dataset.i));
  });
}

function resetViewerTransform() {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

function applyTransform() {
  if (scale <= 1.01) {
    scale = 1;
    tx = 0;
    ty = 0;
  }
  viewerImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function openViewer(items, index) {
  viewerItems = items;
  viewerIndex = Math.max(0, Math.min(index, items.length - 1));
  viewer.hidden = false;
  document.body.style.overflow = "hidden";
  updateViewer();
}

function updateViewer() {
  const item = viewerItems[viewerIndex];
  if (!item) return closeViewer();

  resetViewerTransform();
  viewerImg.onload = resetViewerTransform;
  viewerImg.src = item.src;
  viewerImg.alt = item.title || "";
  viewerCaption.textContent = item.title || "";
}

function closeViewer() {
  viewer.hidden = true;
  document.body.style.overflow = "";
  viewerImg.onload = null;
  viewerImg.src = "";
  viewerItems = [];
  resetViewerTransform();
}

$("#viewerClose").onclick = closeViewer;
$("#viewerPrev").onclick = () => {
  if (viewerItems.length < 2) return;
  viewerIndex = (viewerIndex - 1 + viewerItems.length) % viewerItems.length;
  updateViewer();
};
$("#viewerNext").onclick = () => {
  if (viewerItems.length < 2) return;
  viewerIndex = (viewerIndex + 1) % viewerItems.length;
  updateViewer();
};

viewerStage.addEventListener("dblclick", () => {
  if (scale > 1) resetViewerTransform();
  else { scale = 2; applyTransform(); }
});

viewerStage.addEventListener("pointerdown", event => {
  pointerStart = { x: event.clientX, y: event.clientY };
  viewerStage.setPointerCapture?.(event.pointerId);
});
viewerStage.addEventListener("pointermove", event => {
  if (!pointerStart || scale <= 1) return;
  tx += event.movementX;
  ty += event.movementY;
  applyTransform();
});
viewerStage.addEventListener("pointerup", event => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  if (scale === 1 && Math.abs(dx) > 70) {
    if (dx < 0) $("#viewerNext").click();
    else $("#viewerPrev").click();
  }
  pointerStart = null;
});

function distance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

viewerStage.addEventListener("touchstart", event => {
  if (event.touches.length === 1) {
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now() };
  } else if (event.touches.length === 2) {
    lastDist = distance(event.touches[0], event.touches[1]);
  }
}, { passive: true });

viewerStage.addEventListener("touchmove", event => {
  if (event.touches.length === 2) {
    const nextDistance = distance(event.touches[0], event.touches[1]);
    if (lastDist) {
      scale = Math.max(1, Math.min(5, scale * (nextDistance / lastDist)));
      applyTransform();
    }
    lastDist = nextDistance;
    event.preventDefault();
  }
}, { passive: false });

viewerStage.addEventListener("touchend", event => {
  if (event.touches.length === 0 && touchStart) {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const elapsed = Date.now() - touchStart.time;

    if (scale === 1 && elapsed < 350 && Math.abs(dx) > 70) {
      if (dx < 0) $("#viewerNext").click();
      else $("#viewerPrev").click();
    }

    if (elapsed < 250 && Math.abs(dx) < 20) {
      const now = Date.now();
      if (viewerStage._lastTap && now - viewerStage._lastTap < 300) {
        if (scale > 1) resetViewerTransform();
        else { scale = 2; applyTransform(); }
        viewerStage._lastTap = 0;
      } else {
        viewerStage._lastTap = now;
      }
    }

    touchStart = null;
    lastDist = 0;
  }
}, { passive: true });

homeBtn.onclick = () => setState({ screen: "categories", category: null, sub: null, search: "" });
backBtn.onclick = () => {
  if (state.screen === "subs") setState({ screen: "categories", category: null, sub: null, search: "" });
  else if (state.screen === "images") {
    // All reference image pages return directly to the main Drawing References list.
    setState({ screen: "categories", category: null, sub: null, search: "", imageBackTo: "subs" });
  }
  else if (state.screen === "map-add") setState({ screen: "maps" });
  else if (state.screen === "map-detail") setState({ screen: "maps" });
};

document.querySelectorAll(".nav-btn").forEach(button => {
  button.onclick = () => {
    if (button.dataset.nav === "categories") setState({ screen: "categories", category: null, sub: null, search: "" });
    if (button.dataset.nav === "maps") setState({ screen: "maps" });
  };
});

/* Finished Maps: IndexedDB */
const DB_NAME = "story-so-far-db";
const STORE_NAME = "maps";
const DB_VERSION = 3;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local map storage."));
  });
}

function withStore(mode, work) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    let request;
    let requestResult;

    try {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      request = work(store);

      transaction.oncomplete = () => {
        database.close();
        resolve(requestResult);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error("Local storage transaction failed."));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("Local storage transaction was cancelled."));
      };

      if (request) {
        request.onsuccess = () => { requestResult = request.result; };
        request.onerror = () => reject(request.error || new Error("Local storage request failed."));
      }
    } catch (error) {
      database.close();
      reject(error);
    }
  }));
}

function getMaps() {
  return withStore("readonly", store => store.getAll()).then(items =>
    (items || []).sort((a, b) => (b.created || 0) - (a.created || 0))
  );
}
function getMap(id) { return withStore("readonly", store => store.get(id)); }
function putMap(map) { return withStore("readwrite", store => store.put(map)); }
function removeMap(id) { return withStore("readwrite", store => store.delete(id)); }

function cleanupMapURLs() {
  mapObjectURLs.forEach(url => URL.revokeObjectURL(url));
  mapObjectURLs = [];
}

function mapURL(blob) {
  const url = URL.createObjectURL(blob);
  mapObjectURLs.push(url);
  return url;
}

async function maps() {
  cleanupMapURLs();
  const savedMaps = await getMaps();

  view.innerHTML = `
    <div class="section-head"><h1>Finished Maps</h1></div>
    <div class="notice">Finished maps are stored only in this browser on this device. Clearing browser data or losing the device can remove them.</div>
    <div class="map-actions">
      <button class="primary" id="addMap">＋ Add Finished Map</button>
    </div>
    ${savedMaps.length ? `
      <div class="map-grid">
        ${savedMaps.map(map => `
          <article class="map-card">
            <button data-map="${escapeAttr(map.id)}">
              <img src="${mapURL(map.image)}" alt="${escapeAttr(map.title || "Finished map")}">
              <div class="map-info">
                <strong>${escapeHtml(map.title || "Untitled map")}</strong>
                <small>${escapeHtml(map.date || "")}</small>
              </div>
            </button>
          </article>
        `).join("")}
      </div>
    ` : `<div class="empty">No finished maps yet. After a game, photograph the map and keep it here.</div>`}
  `;

  $("#addMap").onclick = openPhotoSheet;
  view.querySelectorAll("[data-map]").forEach(button => {
    button.onclick = async () => {
      try {
        const map = await getMap(button.dataset.map);
        if (!map) throw new Error("That map could not be found.");
        window.currentMap = map;
        setState({ screen: "map-detail" });
      } catch (error) {
        showError(error);
      }
    };
  });
}

function openPhotoSheet() {
  $("#sheet").hidden = false;
}

$("#cancelSheet").onclick = () => { $("#sheet").hidden = true; };
$("#takePhoto").onclick = () => {
  $("#sheet").hidden = true;
  $("#cameraInput").value = "";
  $("#cameraInput").click();
};
$("#choosePhoto").onclick = () => {
  $("#sheet").hidden = true;
  $("#photoInput").value = "";
  $("#photoInput").click();
};

function handleSelectedFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  window.pendingImage = file;
  window.editingMap = null;
  event.target.value = "";
  setState({ screen: "map-add" });
}

$("#cameraInput").onchange = handleSelectedFile;
$("#photoInput").onchange = handleSelectedFile;

function mapForm() {
  const editing = window.editingMap || {};
  const image = editing.image || window.pendingImage;

  if (!image) {
    setState({ screen: "maps" });
    return;
  }

  const previewURL = URL.createObjectURL(image);

  view.innerHTML = `
    <div class="section-head"><h1>${editing.id ? "Edit" : "Add"} Finished Map</h1></div>
    <form class="form form-card" id="mapForm">
      <img class="photo-preview" src="${previewURL}" alt="Map preview">
      <div class="field">
        <label>Map Title</label>
        <input name="title" value="${escapeAttr(editing.title || "")}" placeholder="Kingdom of Eldoria">
      </div>
      <div class="field">
        <label>Date Played</label>
        <input name="date" type="date" value="${escapeAttr(editing.date || new Date().toISOString().slice(0, 10))}">
      </div>
      <div class="field">
        <label>Players</label>
        <input name="players" value="${escapeAttr(editing.players || "")}" placeholder="Ryan, Sarah, Mike, Jess">
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea name="notes" placeholder="What do you want to remember about this game?">${escapeHtml(editing.notes || "")}</textarea>
      </div>
      <button class="primary" id="saveMap" type="submit">Save Finished Map</button>
    </form>`;

  $("#mapForm").onsubmit = async event => {
    event.preventDefault();
    const saveButton = $("#saveMap");
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    try {
      const form = new FormData(event.currentTarget);
      const record = {
        id: editing.id || crypto.randomUUID(),
        title: String(form.get("title") || "").trim(),
        date: String(form.get("date") || ""),
        players: String(form.get("players") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        image: editing.image || window.pendingImage,
        created: editing.created || Date.now()
      };

      if (!(record.image instanceof Blob)) {
        throw new Error("The selected image is no longer available. Please choose it again.");
      }

      await putMap(record);

      URL.revokeObjectURL(previewURL);
      window.pendingImage = null;
      window.editingMap = null;
      window.currentMap = null;
      setState({ screen: "maps" });
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = "Save Finished Map";
      alert(`Could not save this map. ${error?.message || "Please try again."}`);
      console.error(error);
    }
  };
}

function mapDetail() {
  const map = window.currentMap;
  if (!map || !map.image) return setState({ screen: "maps" });

  if (currentMapURL) URL.revokeObjectURL(currentMapURL);
  currentMapURL = URL.createObjectURL(map.image);

  view.innerHTML = `
    <img class="detail-photo" id="mapPhoto" src="${currentMapURL}" alt="${escapeAttr(map.title || "Finished map")}">
    <div class="detail-meta">
      <h1>${escapeHtml(map.title || "Untitled map")}</h1>
      ${map.date ? `<p><span class="label">Date:</span> ${escapeHtml(map.date)}</p>` : ""}
      ${map.players ? `<p><span class="label">Players:</span> ${escapeHtml(map.players)}</p>` : ""}
      ${map.notes ? `<p><span class="label">Notes:</span> ${escapeHtml(map.notes)}</p>` : ""}
    </div>
    <div class="form-actions">
      <button class="secondary" id="editMap">Edit</button>
      <button class="danger" id="deleteMap">Delete</button>
    </div>
  `;

  $("#mapPhoto").onclick = () => openViewer(
    [{ src: currentMapURL, title: map.title || "Finished map" }],
    0
  );

  $("#editMap").onclick = () => {
    window.editingMap = map;
    setState({ screen: "map-add" });
  };

  $("#deleteMap").onclick = async () => {
    if (!confirm("Delete this finished map?")) return;
    try {
      await removeMap(map.id);
      window.currentMap = null;
      window.editingMap = null;
      setState({ screen: "maps" });
    } catch (error) {
      showError(error);
    }
  };
}

function showError(error) {
  console.error(error);
  view.innerHTML = `<div class="empty">Something went wrong. ${escapeHtml(error?.message || "Please reload and try again.")}</div>`;
}

window.addEventListener("beforeunload", () => {
  cleanupMapURLs();
  if (currentMapURL) URL.revokeObjectURL(currentMapURL);
});

load().catch(showError);
