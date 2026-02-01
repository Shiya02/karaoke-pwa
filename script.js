const API_KEYS = [
  "AIzaSyBWyFXBLNhRvlDYu-e3XLuhEtgOSIwBaFM",
  "AIzaSyCHV9kOJtGk54zmDeJRWIwv0FstrnYz70Y",
  "AIzaSyCBt5Fbj1Cqk2yI6WzQ74fsAc3YEacHM5M",
  "AIzaSyCWGQGr_woo75TyIM7Qll0Nlq7jxMIqBHo",
  "AIzaSyCOUj5cToyJEuoiEKBrlNLGFl-m984T838",
  "AIzaSyBuopTFOPpTFu-T3Lp4gScbxAGSD7Nr-K8",
  "AIzaSyAr7QFAoZ8q_BkTf86MvW3pDHipuBcUSpE",
  "AIzaSyAuPiNxuC-bptSTexRvAwUqwoH767y7-s",
  "AIzaSyDdYZeeCB96xQocVOOENFw6qSG-75Uell0",
  "AIzaSyB1MrOR3eiA-tjF3BlTXNqqTaEiDK70AfY",
  "AIzaSyDfOaai0txbJKjE_4i62cWv1OW5gQeKzFE",
  " AIzaSyAPpERvXMYwI-0fB2DvZ_u5KozemB6WIfU",
  "AIzaSyCfBDgS6ZinFTKxVvX3H1cgiliZhrZrv0g",
  "AIzaSyCHV9kOJtGk54zmDeJRWIwv0FstrnYz70Y",
  "AIzaSyDsSylrGy-yhsoRj5DfwTVReCP1UPySOz8"
];

/* ===============================
   STATE
================================ */
let player = null;
let playerInitializing = false;
let currentVideo = null;
let currentTitle = "";
let queue = [];

let suggestions = [];
let activeIndex = -1;
let debounceTimer = null;
let isTyping = false;


/* ===============================
   ELEMENTS
================================ */
const input = document.getElementById("search");
const suggestionBox = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearSearch");
const voiceBtn = document.getElementById("voiceBtn");
const playPauseBtn = document.getElementById("playPauseBtn");

let recognition; // 🔑 Make recognition accessible globally

/* ===============================
   HELPERS
================================ */
function truncate(text, max = 40) {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/* ===============================
   INPUT EVENTS
================================ */
input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();
  activeIndex = -1;
  isTyping = true;
  clearBtn.classList.toggle("show", q.length > 0);

  if (!q) return fadeOutSuggestions();

  debounceTimer = setTimeout(() => loadSuggestions(q), 200);
});


/* ===============================
   PLAY PAUSE
================================ */


playPauseBtn.addEventListener("click", () => {
  if (!player) return;

  const state = player.getPlayerState();

  // If playing → pause
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    playPauseBtn.textContent = "▶️";
    return;
  }

  // Force play for ALL other states
  player.playVideo();
  playPauseBtn.textContent = "⏸";
});


/* ===============================
   KEYBOARD HANDLING
================================ */
input.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return fadeOutSuggestions();

  if (e.key === "Enter") {
    e.preventDefault();
    isTyping = false;
    fadeOutSuggestions();

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSuggestion(suggestions[activeIndex]);
    } else {
      searchSongs();
    }
    return;
  }

  if (!suggestions.length) return;

  if (e.key === "ArrowDown") activeIndex = (activeIndex + 1) % suggestions.length;
  if (e.key === "ArrowUp") activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;

  renderSuggestions();
});

/* ===============================
   CLOSE DROPDOWN ON OUTSIDE CLICK
================================ */
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-container") && suggestionBox.style.display === "block") {
    fadeOutSuggestions();
  }
});

/* ===============================
   VOICE SEARCH
================================ */
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  voiceBtn.addEventListener("click", () => {
    recognition.start();
    voiceBtn.textContent = "🎤 Listening...";
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (!transcript) {
      voiceBtn.textContent = "🎤";
      return;
    }

    input.value = transcript;
    clearBtn.classList.add("show");

    // ✅ Slight delay to ensure input updates before search
    setTimeout(() => searchSongs(), 100);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    voiceBtn.textContent = "🎤";
  };

  recognition.onend = () => {
    voiceBtn.textContent = "🎤";
  };
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = "Voice search not supported on this device";
}

/* ===============================
   CLEAR INPUT ONLY
================================ */
function clearInputOnly() {
  input.value = "";
  clearBtn.classList.remove("show");
  fadeOutSuggestions();
  document.getElementById("results").innerHTML = "";
}

/* ===============================
   FULL RESET
================================ */
function clearSearch() {
  input.value = "";
  clearBtn.classList.remove("show");
  fadeOutSuggestions();
  document.getElementById("results").innerHTML = "";

  currentVideo = null;
  currentTitle = "";
  queue = [];
  updateQueue();
  updateUpNext();

  if (player) player.stopVideo();
  document.getElementById("skipBtn").disabled = true;
}

/* ===============================
   SUGGESTIONS
================================ */
function loadSuggestions(query) {
  const old = document.getElementById("jsonp");
  if (old) old.remove();

  const s = document.createElement("script");
  s.id = "jsonp";
  s.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&callback=handleSuggestions&q=${encodeURIComponent(query)}`;

  document.body.appendChild(s);
}

window.handleSuggestions = function (data) {
  if (!isTyping) return;
  suggestions = (data[1] || []).map(i => Array.isArray(i) ? i[0] : i).slice(0, 7);
  renderSuggestions();
};

function renderSuggestions() {
  suggestionBox.innerHTML = "";
  if (!suggestions.length) return fadeOutSuggestions();

  suggestions.forEach((text, i) => {
    const div = document.createElement("div");
    div.className = "suggestion-item" + (i === activeIndex ? " active" : "");
    div.textContent = text;
    div.onclick = () => selectSuggestion(text);
    suggestionBox.appendChild(div);
  });

  suggestionBox.style.display = "block";
  suggestionBox.style.opacity = "1";
}

function fadeOutSuggestions() {
  if (suggestionBox.style.display !== "block") return;

  suggestionBox.style.opacity = "0";
  setTimeout(() => {
    suggestionBox.style.display = "none";
    suggestionBox.innerHTML = "";
    suggestions = [];
    activeIndex = -1;
  }, 150);
}

function selectSuggestion(text) {
  isTyping = false;
  input.value = text;
  clearBtn.classList.add("show");
  fadeOutSuggestions();
  searchSongs(); // ✅ Removed input.blur() to allow TV remote
}

/* ===============================
   SEARCH SONGS
================================ */
function searchSongs(retryCount = 0, maxRetries = 3) {
  const text = input.value.trim();
  if (!text) return;

  isTyping = false;
  fadeOutSuggestions();

  const query = text.toLowerCase().includes("karaoke")
    ? text
    : text + " karaoke";

  const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=5&q=${encodeURIComponent(query)}&key=${apiKey}`;

  fetch(url)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      showResults(data.items || []);
    })
    .catch(err => {
      console.warn(`Search failed (attempt ${retryCount + 1})`, err);

      if (retryCount < maxRetries) {
        setTimeout(() => {
          searchSongs(retryCount + 1, maxRetries);
        }, 500); // small delay before retry
      } else {
        console.error("All retries failed.");
        showResults([]); // or show an error message to user
      }
    });
}

/* ===============================
   SHOW RESULTS
================================ */
function showResults(videos) {
  const results = document.getElementById("results");
  results.innerHTML = "";
  if (!videos.length) return;

  playOrQueue(videos[0].id.videoId, videos[0].snippet.title);

  videos.slice(1).forEach(v => {
    const row = document.createElement("div");
    row.className = "result-item";
    row.innerHTML = `<span>${truncate(v.snippet.title)}</span>`;

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
  if (playerInitializing) return setTimeout(() => ensurePlayerReady(cb), 200);
  if (!window.YT || !YT.Player) return setTimeout(() => ensurePlayerReady(cb), 300);

  playerInitializing = true;

  player = new YT.Player("player", {
    events: { onStateChange: onPlayerStateChange, onError: playNext }
  });

  setTimeout(() => {
    playerInitializing = false;
    cb();
  }, 400);
}

/* ===============================
   PLAY / QUEUE
================================ */
function playOrQueue(videoId, title) {
  const shortTitle = truncate(title);

  ensurePlayerReady(() => {
    if (!currentVideo) {
      currentVideo = videoId;
      currentTitle = shortTitle;
      player.loadVideoById(videoId);
      document.getElementById("skipBtn").disabled = false;
    } else {
      queue.push({ videoId, title: shortTitle });
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
    currentTitle = "";
    document.getElementById("skipBtn").disabled = true;
    updateUpNext();
    return;
  }

  const next = queue.shift();
  currentVideo = next.videoId;
  currentTitle = next.title;
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
