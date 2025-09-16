/* Mini-browser script
   Features:
   - URL navigation (with simple auto-fix for missing protocol)
   - Back / Forward / Reload / Home
   - Zoom in/out/reset (transform on iframe)
   - Theme toggle (saved in localStorage)
   - Language switch (en / ar)
   - Download button with confirmation modal; tries fetch() but falls back to a .txt download if blocked
*/

const DEFAULT_HOME = "https://www.google.com";
const iframe = document.getElementById("viewFrame");
const urlInput = document.getElementById("urlInput");
const goBtn = document.getElementById("goBtn");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const homeBtn = document.getElementById("homeBtn");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const zoomLabel = document.getElementById("zoomLabel");
const iframeWrapper = document.getElementById("iframeWrapper");
const statusbar = document.getElementById("statusbar");
const themeToggle = document.getElementById("themeToggle");
const langSelect = document.getElementById("langSelect");
const downloadBtn = document.getElementById("downloadBtn");

// modal elements
const confirmModal = document.getElementById("confirmModal");
const cancelDownload = document.getElementById("cancelDownload");
const confirmDownload = document.getElementById("confirmDownload");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");

let zoom = 1;
const ZOOM_STEP = 0.1;
updateZoomLabel();

// navigation history that we control (iframe history can't be fully read due to cross-origin)
let historyStack = [];
let historyIndex = -1;

// translations
const translations = {
  en: {
    homeTitle: "Mini Browser",
    modalTitle: "Are you sure?",
    modalMessage: "Are you sure you want to download this file?",
    ready: "Ready",
    loading: "Loading...",
    loadBlocked: "This site blocked embedding (not allowed in iframe).",
    go: "Go"
  },
  ar: {
    homeTitle: "متصفح صغير",
    modalTitle: "هل أنت متأكد؟",
    modalMessage: "هل تريد تنزيل هذا الملف فعلاً؟",
    ready: "جاهز",
    loading: "جارٍ التحميل...",
    loadBlocked: "الموقع يمنع العرض داخل iframe.",
    go: "اذهب"
  }
};

// initial setup
document.addEventListener("DOMContentLoaded", () => {
  // theme
  const savedTheme = localStorage.getItem("mini.browser.theme") || "light";
  setTheme(savedTheme);

  // lang
  const savedLang = localStorage.getItem("mini.browser.lang") || "en";
  langSelect.value = savedLang;
  applyLang(savedLang);

  // home
  navigateTo(DEFAULT_HOME, true);
});

// helpers
function fixUrl(input) {
  input = input.trim();
  if (!input) return "";
  // if it's a plain search (no dot or space), treat as Google search
  if (!input.includes(" ") && !input.includes(".") && input.length < 40) {
    return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  }
  // if protocol missing, add https
  if (!/^https?:\/\//i.test(input)) {
    return "https://" + input;
  }
  return input;
}

function setStatus(text) {
  statusbar.textContent = text;
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  localStorage.setItem("mini.browser.theme", theme);
}

function applyLang(lang) {
  const t = translations[lang] || translations.en;
  modalTitle.textContent = t.modalTitle;
  modalMessage.textContent = t.modalMessage;
  setStatus(t.ready);
  goBtn.textContent = t.go;
  localStorage.setItem("mini.browser.lang", lang);

  // Right-to-left for Arabic
  if (lang === "ar") {
    document.documentElement.dir = "rtl";
  } else {
    document.documentElement.dir = "ltr";
  }
}

// navigation stack functions
function pushHistory(url) {
  // if we navigated forward then nav to new URL, drop future entries
  if (historyIndex < historyStack.length - 1) {
    historyStack = historyStack.slice(0, historyIndex + 1);
  }
  historyStack.push(url);
  historyIndex = historyStack.length - 1;
  updateNavButtons();
}

function updateNavButtons() {
  backBtn.disabled = historyIndex <= 0;
  forwardBtn.disabled = historyIndex >= historyStack.length - 1;
}

// core navigation
function navigateTo(rawUrl, replace=false) {
  const url = fixUrl(rawUrl || urlInput.value || DEFAULT_HOME);
  if (!url) return;
  setStatus(translations[langSelect.value].loading);
  urlInput.value = url;

  // try load into iframe
  iframe.src = url;

  // Some sites block embedding; we cannot detect reliably before load, but we can show helpful message after timeout
  const timeout = setTimeout(() => {
    // after a short wait, we assume site blocked if iframe.contentDocument is inaccessible or empty
    try {
      const doc = iframe.contentDocument;
      // for cross-origin this throws; we still set history because iframe attempted load
      if (doc && doc.body && doc.body.innerHTML.trim().length === 0) {
        setStatus(translations[langSelect.value].loadBlocked);
      } else {
        setStatus("Loaded");
      }
    } catch (e) {
      // cross-origin — treat as loaded (but can't inspect)
      setStatus("Loaded (cross-origin)");
    }
  }, 1200);

  // track history (we track attempted URLs)
  if (!replace) pushHistory(url);
  // update address bar
  urlInput.value = url;
  setTimeout(()=> clearTimeout(timeout), 2000);
}

goBtn.addEventListener("click", () => navigateTo(urlInput.value));

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") navigateTo(urlInput.value);
});

// nav controls
backBtn.addEventListener("click", () => {
  if (historyIndex > 0) {
    historyIndex--;
    const url = historyStack[historyIndex];
    iframe.src = url;
    urlInput.value = url;
    updateNavButtons();
    setStatus("Loaded (history)");
  }
});
forwardBtn.addEventListener("click", () => {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    const url = historyStack[historyIndex];
    iframe.src = url;
    urlInput.value = url;
    updateNavButtons();
    setStatus("Loaded (history)");
  }
});
reloadBtn.addEventListener("click", () => {
  // reload current iframe
  const cur = iframe.src;
  iframe.src = cur;
  setStatus("Reloading...");
});
homeBtn.addEventListener("click", () => {
  navigateTo(DEFAULT_HOME);
});

// zoom controls
function applyZoom() {
  iframe.style.transform = `scale(${zoom})`;
  iframeWrapper.style.height = `calc(100% / ${zoom})`;
  updateZoomLabel();
  // store preference
  localStorage.setItem("mini.browser.zoom", zoom);
}
function updateZoomLabel() {
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

zoomIn.addEventListener("click", () => {
  zoom = Math.min(2.5, +(zoom + ZOOM_STEP).toFixed(2));
  applyZoom();
});
zoomOut.addEventListener("click", () => {
  zoom = Math.max(0.4, +(zoom - ZOOM_STEP).toFixed(2));
  applyZoom();
});

// keyboard zoom (Ctrl + / Ctrl -)
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
    e.preventDefault();
    zoomIn.click();
  } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
    e.preventDefault();
    zoomOut.click();
  } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
    e.preventDefault();
    zoom = 1; applyZoom();
  }
});

// theme toggle
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  setTheme(current === "dark" ? "light" : "dark");
});

// language select
langSelect.addEventListener("change", (e) => applyLang(e.target.value));

// download flow
downloadBtn.addEventListener("click", () => {
  confirmModal.classList.remove("hidden");
});

cancelDownload.addEventListener("click", () => {
  confirmModal.classList.add("hidden");
});

confirmDownload.addEventListener("click", async () => {
  confirmModal.classList.add("hidden");
  const currentUrl = urlInput.value || iframe.src || DEFAULT_HOME;
  setStatus("Preparing download...");
  try {
    // try to fetch page contents
    const res = await fetch(currentUrl, {mode: "cors"});
    if (!res.ok) throw new Error("Fetch failed");
    const text = await res.text();
    // create blob and download
    const blob = new Blob([text], {type: "text/html"});
    triggerDownload(blob, sanitizeFilename(currentUrl) + ".html");
    setStatus("Downloaded page content (if CORS allowed).");
  } catch (err) {
    // fall back: create a summary text file with the URL
    const fallback = `Could not fetch page due to CORS or cross-origin restrictions.\n\nURL: ${currentUrl}\n\nThis file was generated as a fallback.`;
    const blob2 = new Blob([fallback], {type: "text/plain"});
    triggerDownload(blob2, sanitizeFilename(currentUrl) + ".txt");
    setStatus("Downloaded fallback file.");
  }
});

function triggerDownload(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function sanitizeFilename(url){
  return url.replace(/[^a-z0-9.-]/gi, "_").slice(0,120);
}

// try restore zoom preference
const savedZoom = parseFloat(localStorage.getItem("mini.browser.zoom"));
if (!isNaN(savedZoom) && savedZoom > 0) {
  zoom = savedZoom;
  applyZoom();
}

// small polish: when iframe navigates (works for same-origin), update url input
iframe.addEventListener("load", () => {
  try {
    const u = iframe.contentWindow.location.href;
    if (u) {
      urlInput.value = u;
      // push into our history if it wasn't a history action
      const last = historyStack[historyIndex];
      if (last !== u) pushHistory(u);
    }
  } catch (e) {
    // cross-origin: we can't read location. leave address bar as we set it.
  }
  setStatus("Ready");
});

// initial UI labels from selected language
applyLang(langSelect.value);
const urlInput = document.getElementById("urlInput");
const frame = document.getElementById("browserFrame");
const suggestionsBox = document.getElementById("suggestions");

let historyList = [];
let zoomLevel = 1;

function goToURL() {
  let url = urlInput.value.trim();

  if (!url) return;

  // if it's not a full URL, search on Google
  if (!url.startsWith("http")) {
    url = "https://www.google.com/search?q=" + encodeURIComponent(url);
  }

  frame.src = url;
  addToHistory(url);
  urlInput.value = url;
  hideSuggestions();
}

function addToHistory(url) {
  if (!historyList.includes(url)) {
    historyList.unshift(url); // add latest first
    if (historyList.length > 10) historyList.pop(); // keep only 10
  }
}

function showSuggestions(value) {
  suggestionsBox.innerHTML = "";

  if (!value) {
    // show history
    historyList.forEach(h => {
      const div = document.createElement("div");
      div.textContent = h;
      div.onclick = () => {
        urlInput.value = h;
        goToURL();
      };
      suggestionsBox.appendChild(div);
    });
  } else {
    // show search suggestion
    const googleSuggest = document.createElement("div");
    googleSuggest.textContent = `Search Google for "${value}"`;
    googleSuggest.onclick = () => {
      urlInput.value = value;
      goToURL();
    };
    suggestionsBox.appendChild(googleSuggest);
  }

  suggestionsBox.style.display = "block";
}

function hideSuggestions() {
  suggestionsBox.style.display = "none";
}

urlInput.addEventListener("input", () => {
  showSuggestions(urlInput.value);
});

urlInput.addEventListener("focus", () => {
  showSuggestions(urlInput.value);
});

document.addEventListener("click", (e) => {
  if (!suggestionsBox.contains(e.target) && e.target !== urlInput) {
    hideSuggestions();
  }
});

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function zoomIn() {
  zoomLevel += 0.1;
  frame.style.transform = `scale(${zoomLevel})`;
  frame.style.transformOrigin = "0 0";
}

function zoomOut() {
  if (zoomLevel > 0.3) {
    zoomLevel -= 0.1;
    frame.style.transform = `scale(${zoomLevel})`;
    frame.style.transformOrigin = "0 0";
  }
}