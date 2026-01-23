const API_KEY = "AIzaSyCSggH0GxbXpv4gxqWiWl3YEb3arkBaRXI";

let player = null;
let currentVideo = null;
let queue = [];

let suggestions = [];
let activeIndex = -1;
let debounceTimer = null;
let isTyping = false;

const input = document.getElementById("search");
const suggestionBox = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearSearch");

/* ===============================
   INPUT
================================ */
input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();
  activeIndex = -1;
  isTyping = true;

  clearBtn.classList.toggle("show", q.length > 0);

  if (!q) {
    fadeOutSuggestions();
    return;
  }

  debounceTimer = setTimeout(() => loadSuggestions(q), 200);
});

// Optional: auto-focus for mobile/desktop
// input.focus();

/* ===============================
   KEYBOARD HANDLING
================================ */
input.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    fadeOutSuggestions();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    isTyping = false;
    fadeOutSuggestions();
    input.blur(); // 📱 mobile keyboard closes
    if (activeIndex >= 0) {
      selectSuggestion(suggestions[activeIndex]);
    } else {
      searchSongs();
    }
    return;
  }

  if (!suggestions.length) return;

  if (e.key === "ArrowDown") {
    activeIndex = (activeIndex + 1) % suggestions.length;
  } else if (e.key === "ArrowUp") {
    activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
  }

  renderSuggestions();
});

/* ===============================
   CLOSE DROPDOWN ON OUTSIDE CLICK
================================ */
document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".search-container") &&
    suggestionBox.style.display === "block"
  ) {
    fadeOutSuggestions();
  }
});

/* ===============================
   CLEAR SEARCH
================================ */
function clearSearch() {
  input.value = "";
  clearBtn.classList.remove("show");
  fadeOutSuggestions();
  document.getElementById("results").innerHTML = "";
}

/* ===============================
   JSONP SUGGESTIONS
================================ */
function loadSuggestions(query) {
  const old = document.getElementById("jsonp");
  if (old) old.remove();

  const s = document.createElement("script");
  s.id = "jsonp";
  s.src =
    "https://suggestqueries.google.com/complete/search" +
    "?client=youtube&ds=yt&callback=handleSuggestions&q=" +
    encodeURIComponent(query);

  document.body.appendChild(s);
}

window.handleSuggestions = function (data) {
  if (!isTyping) return;

  suggestions = (data[1] || [])
    .map(i => (Array.isArray(i) ? i[0] : i))
    .slice(0, 7);

  renderSuggestions();
};

/* ===============================
   RENDER DROPDOWN
================================ */
function renderSuggestions() {
  suggestionBox.innerHTML = "";
  if (!suggestions.length) return fadeOutSuggestions();

  suggestions.forEach((text, i) => {
    const div = document.createElement("div");
    div.className = "suggestion-item" + (i === activeIndex ? " active" : "");
    div.textContent = text;

    div.onclick = () => selectSuggestion(text);

    suggestionBox.appendChild(div);

    // ✅ Scroll active item into view for mobile/desktop
    if (i === activeIndex) div.scrollIntoView({ block: "nearest" });
  });

  suggestionBox.style.display = "block";
  suggestionBox.style.opacity = "1";
}

/* ===============================
   FADE OUT DROPDOWN
================================ */
function fadeOutSuggestions() {
  suggestionBox.style.opacity = "0";

  setTimeout(() => {
    suggestionBox.style.display = "none";
    suggestionBox.innerHTML = "";
    suggestions = [];
    activeIndex = -1;
  }, 150);
}

/* ===============================
   SELECT SUGGESTION
================================ */
function selectSuggestion(text) {
  isTyping = false;
  input.value = text;
  clearBtn.classList.add("show");
  fadeOutSuggestions();
  input.blur(); // 📱 close keyboard
  searchSongs();
}

/* ===============================
   SEARCH
================================ */
function searchSongs() {
  const text = input.value.trim();
  if (!text) return;

  isTyping = false;
  fadeOutSuggestions();
  input.blur(); // 📱 close keyboard

  fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=5&q=${encodeURIComponent(
      text + " karaoke"
    )}&key=${API_KEY}`
  )
    .then(res => res.json())
    .then(data => showResults(data.items || []));
}

/* ===============================
   RESULTS
================================ */
function showResults(videos) {
  const results = document.getElementById("results");
  results.innerHTML = "";
  if (!videos.length) return;

  // 🔥 AUTO-PLAY FIRST
  playOrQueue(videos[0].id.videoId, videos[0].snippet.title);

  videos.slice(1).forEach(v => {
    const row = document.createElement("div");
    row.className = "result-item";

    row.innerHTML = `<span>${v.snippet.title}</span>`;

    const btn = document.createElement("button");
    btn.textContent = "Add";
    btn.onclick = () => playOrQueue(v.id.videoId, v.snippet.title);

    row.appendChild(btn);
    results.appendChild(row);
  });
}

/* ===============================
   PLAYER
================================ */
function ensurePlayerReady(cb) {
  if (player && window.YT && YT.Player) return cb();
  if (!window.YT || !YT.Player)
    return setTimeout(() => ensurePlayerReady(cb), 300);

  player = new YT.Player("player", {
    events: {
      onStateChange: onPlayerStateChange,
      onError: playNext
    }
  });

  setTimeout(cb, 400);
}

function playOrQueue(videoId, title) {
  ensurePlayerReady(() => {
    if (!currentVideo) {
      currentVideo = videoId;
      player.loadVideoById(videoId);
      document.getElementById("skipBtn").disabled = false;
    } else {
      queue.push({ videoId, title });
      updateQueue();
    }
    updateUpNext();
  });
}

function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.ENDED) playNext();
}

function playNext() {
  if (!queue.length) {
    currentVideo = null;
    document.getElementById("skipBtn").disabled = true;
    updateUpNext();
    return;
  }

  const next = queue.shift();
  currentVideo = next.videoId;
  player.loadVideoById(next.videoId);
  updateQueue();
  updateUpNext();
}

/* ===============================
   QUEUE UI
================================ */
function updateQueue() {
  const ul = document.getElementById("queue");
  ul.innerHTML = "";
  queue.forEach(q => {
    const li = document.createElement("li");
    li.textContent = q.title;
    ul.appendChild(li);
  });
}

function updateUpNext() {
  document.getElementById("upNext").textContent =
    queue.length ? queue[0].title : "No song queued";
}

/* ===============================
   HOST CONTROLS
================================ */
function skipSong() {
  if (!currentVideo) return;
  playNext();
}

function clearQueue() {
  queue = [];
  updateQueue();
  updateUpNext();
}
