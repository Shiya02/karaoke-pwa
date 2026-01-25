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

const API_KEY = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];

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

let userUnlockedPlayback = false;
const isTV = /TV|SmartTV|Tizen|WebOS|Android TV/i.test(navigator.userAgent);

/* ===============================
   ELEMENTS
================================ */
const input = document.getElementById("search");
const suggestionBox = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearSearch");
const voiceBtn = document.getElementById("voiceBtn");
const playPauseBtn = document.getElementById("playPauseBtn");

let recognition;


/* ===============================
   API KEY
================================ */

function getRandomApiKey() {
  return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
}



/* ===============================
   HELPERS
================================ */
function truncate(text, max = 40) {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/* ===============================
   UNLOCK PLAYBACK (TV REQUIREMENT)
================================ */
function unlockPlayback() {
  if (!player || userUnlockedPlayback) return;
  userUnlockedPlayback = true;
  player.playVideo();
}

document.addEventListener("click", unlockPlayback, { once: true });
document.addEventListener("keydown", unlockPlayback, { once: true });

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
  }

  if (!suggestions.length) return;
  if (e.key === "ArrowDown") activeIndex = (activeIndex + 1) % suggestions.length;
  if (e.key === "ArrowUp") activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;

  renderSuggestions();
});

/* ===============================
   VOICE SEARCH
================================ */
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";

  voiceBtn.addEventListener("click", () => {
    recognition.start();
    voiceBtn.textContent = "🎤 Listening...";
  });

  recognition.onresult = (e) => {
    input.value = e.results[0][0].transcript.trim();
    clearBtn.classList.add("show");
    setTimeout(searchSongs, 100);
  };

  recognition.onend = () => voiceBtn.textContent = "🎤";
} else {
  voiceBtn.disabled = true;
}

/* ===============================
   PLAY / PAUSE BUTTON (TV SAFE)
================================ */
playPauseBtn.addEventListener("click", () => {
  if (!player) return;

  if (isTV) {
    player.playVideo();
    playPauseBtn.textContent = "⏸";
    return;
  }

  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    playPauseBtn.textContent = "▶️";
  } else {
    player.playVideo();
    playPauseBtn.textContent = "⏸";
  }
});

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

window.handleSuggestions = (data) => {
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
  searchSongs();
}

/* ===============================
   SEARCH
================================ */
function searchSongs() {
  const text = input.value.trim();
  if (!text) return;

  const query = text.toLowerCase().includes("karaoke") ? text : text + " karaoke";

  fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=5&q=${encodeURIComponent(query)}&key=${API_KEY}`)
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
    events: { onStateChange: onPlayerStateChange }
  });

  setTimeout(() => {
    playerInitializing = false;
    cb();
  }, 400);
}

/* ===============================
   PLAY / QUEUE (TV FIXED)
================================ */
function playOrQueue(videoId, title) {
  const shortTitle = truncate(title);

  ensurePlayerReady(() => {
    if (!currentVideo) {
      currentVideo = videoId;
      currentTitle = shortTitle;

      if (isTV) {
        player.cueVideoById(videoId);
        setTimeout(() => player.playVideo(), 300);
      } else {
        player.loadVideoById(videoId);
      }

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

  if (e.data === YT.PlayerState.PLAYING) playPauseBtn.textContent = "⏸";
  if (e.data === YT.PlayerState.PAUSED) playPauseBtn.textContent = "▶️";
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

  if (isTV) {
    player.cueVideoById(next.videoId);
    setTimeout(() => player.playVideo(), 300);
  } else {
    player.loadVideoById(next.videoId);
  }

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

function clearInputOnly() {
  input.value = "";
  clearBtn.classList.remove("show");
  fadeOutSuggestions();
  document.getElementById("results").innerHTML = "";
  input.focus();
}