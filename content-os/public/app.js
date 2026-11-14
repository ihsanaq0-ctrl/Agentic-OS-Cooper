const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  view: "home",
  activeDraft: null,
  accounts: [],
  services: {},
  imagePoll: null,
};

// ── Helpers ──────────────────────────────────────────────────────
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}
function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${kind}`;
  setTimeout(() => t.classList.add("hidden"), 3200);
}
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Navigation ───────────────────────────────────────────────────
function showView(view) {
  state.view = view;
  const isHome = view === "home";
  document.body.classList.toggle("hud-mode", isHome);
  $("#tabsNav").classList.toggle("hidden", isHome);
  $$(".navtab").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (isHome && window.HUD) window.HUD.load();
  if (isHome) loadContentLatest();
  if (view === "sources") loadSources();
  if (view === "feed") loadFeed();
  if (view === "studio") loadDrafts();
  if (view === "schedule") loadScheduled();
  if (view === "settings") loadSettings();
}
window.showView = showView;
$$(".navtab").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

// HUD ↔ Content System navigation
function enterContentSystem() { showView("sources"); }
$("#enterContent")?.addEventListener("click", enterContentSystem);
$("#backToHud")?.addEventListener("click", () => showView("home"));
$("#homeSettings")?.addEventListener("click", () => showView("settings"));

// Latest generated content, shown inside the HUD's Content System tile. Clicking
// an item jumps straight into the Studio with that draft open.
async function loadContentLatest() {
  const box = $("#contentLatest");
  if (!box) return;
  try {
    const drafts = await api("/api/drafts");
    if (!drafts.length) {
      box.innerHTML = `<div class="hud-empty">No content yet. Generate a post to see it here.</div>`;
      return;
    }
    box.innerHTML = drafts.slice(0, 4).map((d) => `
      <div class="cc-item" data-id="${d.id}">
        <div class="cc-item-title">${escapeHtml(d.title || d.caption || "Untitled")}</div>
        <div class="cc-item-meta"><span class="badge ${escapeHtml(d.status)}">${escapeHtml(d.status)}</span> · ${fmt(d.updated_at)}</div>
      </div>`).join("");
    $$(".cc-item", box).forEach((el) => el.addEventListener("click", () => {
      state.activeDraft = el.dataset.id;
      showView("studio");
    }));
  } catch {
    box.innerHTML = `<div class="hud-empty">Couldn’t load content.</div>`;
  }
}

// ── Health ───────────────────────────────────────────────────────
async function health() {
  try {
    const h = await api("/api/health");
    state.services = h.services;
    $("#serverStatus").textContent = "Server online";
    $("#serverStatus").classList.add("online");
    $("#queuePill").textContent = `Queue: ${h.queue}`;
  } catch {
    $("#serverStatus").textContent = "Server offline";
    $("#serverStatus").classList.remove("online");
  }
}

// ── Sources ──────────────────────────────────────────────────────
async function loadSources() {
  const sources = await api("/api/sources");
  $("#srcCount").textContent = `${sources.length} source(s)`;
  const list = $("#sourcesList");
  if (!sources.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">⌗</div><p>No sources yet. Add a URL or search query on the left.</p></div>`;
    return;
  }
  list.innerHTML = sources.map((s) => `
    <div class="source-item" data-id="${s.id}">
      <div class="source-top">
        <div>
          <div class="source-name">${escapeHtml(s.name)} ${s.last_status ? `<span class="badge ${s.last_status}">${s.last_status}</span>` : ""}</div>
          <div class="source-url">${escapeHtml(s.url)}</div>
        </div>
        <div class="source-actions">
          <button class="icon-btn" data-act="run">Run</button>
          <button class="icon-btn" data-act="toggle">${s.enabled ? "Disable" : "Enable"}</button>
          <button class="icon-btn danger" data-act="delete">Delete</button>
        </div>
      </div>
      <div class="source-meta">
        <span class="chip">${escapeHtml(s.type)}</span>
        <span class="chip">every ${s.interval_value} ${escapeHtml(s.interval_unit)}</span>
        ${s.freshness_override_hours ? `<span class="chip">fresh ≤ ${s.freshness_override_hours}h</span>` : ""}
        <span class="chip">next ${fmt(s.next_run_at)}</span>
        ${s.topic_tags.map((t) => `<span class="chip tag">${escapeHtml(t)}</span>`).join("")}
      </div>
    </div>
  `).join("");

  $$(".source-item", list).forEach((el) => {
    const id = el.dataset.id;
    $$("[data-act]", el).forEach((btn) => btn.addEventListener("click", async () => {
      try {
        if (btn.dataset.act === "run") { await api(`/api/sources/${id}/run`, { method: "POST" }); toast("Scrape started", "success"); }
        if (btn.dataset.act === "toggle") {
          const enabled = btn.textContent === "Enable";
          await api(`/api/sources/${id}`, { method: "PUT", body: { enabled } });
        }
        if (btn.dataset.act === "delete") { await api(`/api/sources/${id}`, { method: "DELETE" }); }
        loadSources();
      } catch (e) { toast(e.message, "error"); }
    }));
  });
}

// Advanced toggle reveals the full form.
$("#advToggle")?.addEventListener("change", (e) => {
  $("#sourceForm").classList.toggle("adv-hidden", !e.target.checked);
});
// Schedule select: cron presets vs interval.
$("#srcSchedule")?.addEventListener("change", (e) => {
  const v = e.target.value;
  $("#srcCron").classList.toggle("hidden", v !== "custom");
  $("#intervalRow").classList.toggle("hidden", v !== "interval");
});

function collectSourceBody() {
  const url = $("#srcUrl").value.trim();
  const tags = $("#srcTags").value.split(",").map((t) => t.trim()).filter(Boolean);
  const fresh = $("#srcFresh").value ? Number($("#srcFresh").value) : null;
  const sched = $("#srcSchedule").value;
  const cron = sched === "interval" ? null : (sched === "custom" ? $("#srcCron").value.trim() : sched);
  return {
    url,
    name: $("#srcName").value.trim() || url,
    type: $("#srcType").value,
    research_depth: $("#srcDepth").value,
    interval_value: Number($("#srcIntervalValue").value) || 6,
    interval_unit: $("#srcIntervalUnit").value,
    cron_expression: cron || null,
    topic_tags: tags,
    freshness_override_hours: fresh,
  };
}

// Quick Source Presets (ArXiv, GitHub)
$$(".preset-btns .preset-btn").forEach((b) => {
  b.addEventListener("click", () => {
    const url = b.dataset.url;
    const type = b.dataset.type;
    const name = b.dataset.name;
    if ($("#srcUrl")) $("#srcUrl").value = url;
    if ($("#srcType")) $("#srcType").value = type;
    if ($("#srcName")) $("#srcName").value = name;
    if ($("#advToggle") && !$("#advToggle").checked) {
      $("#advToggle").checked = true;
      $("#sourceForm")?.classList.remove("adv-hidden");
    }
    toast(`Loaded preset: ${name}`, "info");
  });
});

// "Research now" — ad-hoc research into the feed without saving.
$("#researchNow")?.addEventListener("click", () => {
  const query = $("#srcUrl").value.trim();
  if (!query) return toast("Enter a topic to research", "error");
  return withBtnLoading($("#researchNow"), async () => {
    try {
      toast("Researching the web…");
      const r = await api("/api/research", { method: "POST", body: { query, depth: $("#srcDepth").value, topic_tags: $("#srcTags").value.split(",").map((t) => t.trim()).filter(Boolean) } });
      toast(`Found ${r.found}, added ${r.added} to feed`, "success");
      showView("feed");
    } catch (e) { toast(e.message, "error"); }
  }, "Researching…");
});

// "Save & schedule" — persist as a recurring source.
$("#srcSubmit")?.addEventListener("click", async () => {
  const body = collectSourceBody();
  if (!body.url) return toast("Enter a topic or URL", "error");
  try {
    await api("/api/sources", { method: "POST", body });
    $("#sourceForm").reset();
    $("#srcUrl").value = "";
    toast("Saved & scheduled", "success");
    loadSources();
  } catch (e) { toast(e.message, "error"); }
});

// ── Feed ─────────────────────────────────────────────────────────
async function loadFeed() {
  const bypass = $("#bypassFresh").checked;
  const statuses = $("#feedStatus").value;
  const articles = await api(`/api/articles?bypassFreshness=${bypass}&statuses=${statuses}`);
  const list = $("#feedList");
  if (!articles.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📰</div><p>No articles in this view. Run a source or relax the freshness filter.</p></div>`;
    return;
  }
  list.innerHTML = articles.map((a) => {
    const score = a.priority_score;
    const cls = score == null ? "" : score >= 80 ? "high" : score < 40 ? "low" : "";
    return `
    <div class="feed-card" data-id="${a.id}">
      <div class="score-badge ${cls}">${score == null ? "–" : score}</div>
      <div class="feed-body">
        <div class="feed-title"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.title)}</a></div>
        ${a.priority_reason ? `<div class="feed-reason">${escapeHtml(a.priority_reason)}</div>` : ""}
        ${a.suggested_angle ? `<div class="feed-angle">↳ ${escapeHtml(a.suggested_angle)}</div>` : ""}
        <div class="feed-sub">
          <span>${fmt(a.published_at || a.scraped_at)}</span>
          <span class="badge ${a.status}">${a.status}</span>
          ${a.topic_tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
      <div class="feed-actions">
        <button class="icon-btn" data-act="draft">Make post</button>
        <button class="icon-btn" data-act="shortlist">Shortlist</button>
        <button class="icon-btn" data-act="dismiss">Dismiss</button>
      </div>
    </div>`;
  }).join("");

  $$(".feed-card", list).forEach((el) => {
    const id = el.dataset.id;
    $("[data-act='draft']", el).addEventListener("click", (ev) => withBtnLoading(ev.currentTarget, async () => {
      try {
        toast("Generating caption…");
        const draft = await api(`/api/articles/${id}/draft`, { method: "POST", body: { platform: "general" } });
        state.activeDraft = draft.id;
        showView("studio");
      } catch (e) { toast(e.message, "error"); }
    }, "Writing…"));
    $("[data-act='shortlist']", el).addEventListener("click", async () => {
      await api(`/api/articles/${id}/status`, { method: "POST", body: { status: "shortlisted" } }); loadFeed();
    });
    $("[data-act='dismiss']", el).addEventListener("click", async () => {
      await api(`/api/articles/${id}/status`, { method: "POST", body: { status: "dismissed" } }); loadFeed();
    });
  });
}
$("#bypassFresh").addEventListener("change", loadFeed);
$("#feedStatus").addEventListener("change", loadFeed);
$("#feedRefresh").addEventListener("click", loadFeed);
$("#rankBtn").addEventListener("click", () => withBtnLoading($("#rankBtn"), async () => {
  try { toast("Ranking…"); const r = await api("/api/articles/rank", { method: "POST" }); toast(`Ranked ${r.ranked}`, "success"); loadFeed(); }
  catch (e) { toast(e.message, "error"); }
}, "Ranking…"));

// ── Studio ───────────────────────────────────────────────────────
async function loadDrafts() {
  const drafts = await api("/api/drafts");
  const list = $("#draftsList");
  if (!drafts.length) {
    list.innerHTML = `<p class="hint">No drafts yet.</p>`;
  } else {
    list.innerHTML = drafts.map((d) => `
      <div class="draft-item ${d.id === state.activeDraft ? "active" : ""}" data-id="${d.id}">
        <div class="t">${escapeHtml(d.title || d.caption || "Untitled")}</div>
        <div class="m">${escapeHtml(d.status)} · ${fmt(d.updated_at)}</div>
      </div>`).join("");
    $$(".draft-item", list).forEach((el) =>
      el.addEventListener("click", () => openDraft(el.dataset.id)));
  }
  if (state.activeDraft) openDraft(state.activeDraft);
}

// Spinner helper: shows an inline loader on a button while an async action runs.
async function withBtnLoading(btn, fn, loadingLabel) {
  if (!btn || btn.dataset.busy === "1") return;
  const original = btn.innerHTML;
  btn.dataset.busy = "1";
  btn.disabled = true;
  btn.classList.add("is-loading");
  btn.innerHTML = `<span class="spinner"></span>${loadingLabel ? `<span>${escapeHtml(loadingLabel)}</span>` : ""}`;
  try { return await fn(); }
  finally {
    btn.classList.remove("is-loading");
    btn.disabled = false;
    btn.dataset.busy = "0";
    btn.innerHTML = original;
  }
}

async function openDraft(id) {
  state.activeDraft = id;
  $$(".draft-item").forEach((el) => el.classList.toggle("active", el.dataset.id === id));
  const draft = await api(`/api/drafts/${id}`);
  $("#studioEmpty").classList.add("hidden");
  $("#studioPane").classList.remove("hidden");
  $("#draftCaption").value = draft.caption || "";
  renderPreview(draft);
  renderImageState(draft);
  renderImageHistory(draft.images || []);
  renderRefineLog(draft.versions || []);
  // A refresh during generation lands here with status "generating" — resume
  // tracking so the loader resolves on its own.
  if (draft.image_status === "generating") trackImageGeneration(id);
}

function renderPreview(draft) {
  $("#previewCaption").textContent = draft.caption || "";
}

// The preview image + its generating / failed states.
function renderImageState(draft) {
  const img = $("#previewImage");
  if (draft.image_status === "generating") {
    img.innerHTML = `<div class="img-generating"><span class="spinner big"></span><span>Generating image…</span></div>`;
  } else if (draft.image_path) {
    img.innerHTML = `<img src="${escapeHtml(draft.image_path)}" alt="preview" />`;
  } else {
    img.innerHTML = `<span class="ph">image preview</span>`;
  }

  const status = $("#imgStatus");
  if (status) {
    if (draft.image_status === "generating") status.innerHTML = `<span class="spinner"></span> Generating in the background — you can keep editing or even refresh.`;
    else if (draft.image_status === "failed") status.innerHTML = `<span class="img-failed">Generation failed. Try again.</span>`;
    else status.textContent = "";
  }
  const gen = $("#genImage");
  if (gen) gen.disabled = draft.image_status === "generating";
}

// Gallery of every image generated for this draft; click to make it current.
function renderImageHistory(images) {
  const box = $("#imgHistory");
  if (!box) return;
  if (!images.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="img-history-label">Generation history</div><div class="img-history-grid">` +
    images.map((im) => `
      <button class="img-thumb" data-path="${escapeHtml(im.image_path)}" title="${escapeHtml(im.aspect_ratio || "")}">
        <img src="${escapeHtml(im.image_path)}" alt="" loading="lazy" />
        ${im.aspect_ratio ? `<span class="img-thumb-ratio">${escapeHtml(im.aspect_ratio)}</span>` : ""}
      </button>`).join("") + `</div>`;
  $$(".img-thumb", box).forEach((b) => b.addEventListener("click", async () => {
    try {
      await api(`/api/drafts/${state.activeDraft}`, { method: "PUT", body: { image_path: b.dataset.path } });
      openDraft(state.activeDraft);
      toast("Image selected", "success");
    } catch (e) { toast(e.message, "error"); }
  }));
}

// Poll the draft until image generation finishes (SSE also nudges this).
function trackImageGeneration(id) {
  if (state.imagePoll) clearInterval(state.imagePoll);
  state.imagePoll = setInterval(async () => {
    if (state.activeDraft !== id || state.view !== "studio") { clearInterval(state.imagePoll); state.imagePoll = null; return; }
    try {
      const d = await api(`/api/drafts/${id}`);
      if (d.image_status !== "generating") {
        clearInterval(state.imagePoll); state.imagePoll = null;
        renderImageState(d);
        renderImageHistory(d.images || []);
        $("#regenImage").classList.remove("hidden");
        toast(d.image_status === "ready" ? "Image ready" : "Image generation failed", d.image_status === "ready" ? "success" : "error");
      }
    } catch { /* keep polling */ }
  }, 2500);
}

function renderRefineLog(versions) {
  $("#refineLog").innerHTML = versions.map((v) =>
    `<div class="refine-msg ${v.role}">${escapeHtml(v.role === "user" ? v.content : (v.caption_snapshot || v.content))}</div>`
  ).join("");
}

$("#saveCaption").addEventListener("click", () => withBtnLoading($("#saveCaption"), async () => {
  try {
    await api(`/api/drafts/${state.activeDraft}`, { method: "PUT", body: { caption: $("#draftCaption").value } });
    $("#previewCaption").textContent = $("#draftCaption").value;
    toast("Saved", "success");
  } catch (e) { toast(e.message, "error"); }
}, "Saving…"));

// "Edit caption": focus the caption editor so it's obvious where to edit.
$("#editCaptionBtn")?.addEventListener("click", () => {
  const ta = $("#draftCaption");
  ta.scrollIntoView({ behavior: "smooth", block: "center" });
  ta.focus();
  const len = ta.value.length;
  ta.setSelectionRange(len, len);
});

// Kick off background image generation in the chosen ratio, then track it.
async function generateDraftImage(btn) {
  const ratio = $("#imgRatio").value;
  const research = $("#imgResearch").checked;
  await withBtnLoading(btn, async () => {
    try {
      await api(`/api/drafts/${state.activeDraft}/image`, { method: "POST", body: { aspectRatio: ratio, research } });
      const d = await api(`/api/drafts/${state.activeDraft}`);
      renderImageState(d);
      toast(`Generating ${ratio} image${research ? " (researching…)" : ""}`);
      trackImageGeneration(state.activeDraft);
    } catch (e) { toast(e.message, "error"); }
  }, "Starting…");
}
$("#genImage").addEventListener("click", () => generateDraftImage($("#genImage")));
$("#regenImage").addEventListener("click", () => generateDraftImage($("#regenImage")));

$("#refineBtn").addEventListener("click", () => withBtnLoading($("#refineBtn"), async () => {
  const instruction = $("#refineInput").value.trim();
  if (!instruction) return;
  try {
    const r = await api(`/api/drafts/${state.activeDraft}/refine`, { method: "POST", body: { instruction } });
    $("#refineInput").value = "";
    $("#draftCaption").value = r.caption;
    renderRefineLog(r.versions);
    $("#previewCaption").textContent = r.caption;
    toast("Updated", "success");
  } catch (e) { toast(e.message, "error"); }
}, "Editing…"));

// ── PDF Carousel Generator (LinkedIn Document Slides) ───────────
async function generateCarousel(btn) {
  if (!state.activeDraft) return toast("No active draft selected", "error");
  await withBtnLoading(btn, async () => {
    try {
      toast("Generating 5-slide PDF carousel via AI…", "info");
      const r = await api(`/api/drafts/${state.activeDraft}/carousel`, { method: "POST" });
      toast("PDF Carousel generated successfully!", "success");
      openCarouselModal(r);
      const d = await api(`/api/drafts/${state.activeDraft}`);
      renderImageState(d);
    } catch (e) {
      toast(e.message, "error");
    }
  }, "Generating…");
}

function openCarouselModal(data) {
  const modal = $("#carouselModal");
  if (!modal) return;
  const list = $("#carouselSlidesPreview");
  const sub = $("#carouselSubtitle");
  const dlBtn = $("#carouselDownloadBtn");

  if (sub) sub.textContent = data.title || "Technical Slide Deck";
  if (dlBtn) dlBtn.href = data.carouselPath;

  if (list && Array.isArray(data.slides)) {
    list.innerHTML = data.slides.map((s) => `
      <div class="carousel-slide-item">
        <div class="carousel-slide-head">
          <span>SLIDE ${s.slideNumber} · ${escapeHtml(s.tag || "")}</span>
        </div>
        <div class="carousel-slide-title">${escapeHtml(s.headline || "")}</div>
        <div class="carousel-slide-body">${escapeHtml(s.body || "")}</div>
        ${s.callout ? `<div class="carousel-slide-callout">✦ ${escapeHtml(s.callout)}</div>` : ""}
      </div>
    `).join("");
  }

  modal.classList.remove("hidden");
}

$("#generateCarouselBtn")?.addEventListener("click", () => generateCarousel($("#generateCarouselBtn")));
$("#carouselModalClose")?.addEventListener("click", () => $("#carouselModal")?.classList.add("hidden"));
$("#carouselPublishDirect")?.addEventListener("click", () => {
  $("#carouselModal")?.classList.add("hidden");
  openModal("publish");
});

// ── Schedule & Publish modal ──────────────────────────────────────
async function openModal(mode = "publish") {
  await ensureAccounts();
  if (!state.accounts.length) return toast("Connect your LinkedIn or social account in Settings first", "error");
  $("#modalAccounts").innerHTML = state.accounts.map((a) => {
    const badge = `<span class="badge completed" style="margin-left:4px;font-size:9px;">Direct (Free)</span>`;
    return `
    <label class="modal-acct">
      <input type="checkbox" checked data-platform="${a.platform}" data-account="${a.id}" />
      <span class="p">${escapeHtml(a.platform)}</span>
      <span>${escapeHtml(a.display_name || a.username || a.platform)}${badge}</span>
    </label>`;
  }).join("");
  
  const isNow = mode === "publish";
  $("#modalNow").checked = isNow;
  $("#modalSubmit").textContent = isNow ? "Publish Now 🚀" : "Confirm Schedule 🗓";
  $("#modalError").classList.add("hidden");
  $("#scheduleModal").classList.remove("hidden");
}

$("#openPublishNow")?.addEventListener("click", () => openModal("publish"));
$("#openSchedule")?.addEventListener("click", () => openModal("schedule"));

$("#modalNow")?.addEventListener("change", (e) => {
  $("#modalSubmit").textContent = e.target.checked ? "Publish Now 🚀" : "Confirm Schedule 🗓";
});

$("#modalClose").addEventListener("click", () => $("#scheduleModal").classList.add("hidden"));

$("#modalSubmit").addEventListener("click", async () => {
  const platforms = $$("#modalAccounts input:checked").map((c) => ({ platform: c.dataset.platform, accountId: c.dataset.account }));
  if (!platforms.length) { $("#modalError").textContent = "Select at least one account."; $("#modalError").classList.remove("hidden"); return; }
  const publishNow = $("#modalNow").checked;
  const when = $("#modalWhen").value;
  if (!publishNow && !when) { $("#modalError").textContent = "Pick a time or choose publish now."; $("#modalError").classList.remove("hidden"); return; }
  try {
    $("#modalSubmit").disabled = true;
    const res = await api(`/api/drafts/${state.activeDraft}/schedule`, {
      method: "POST",
      body: { platforms, scheduledFor: when ? new Date(when).toISOString() : undefined, publishNow },
    });
    $("#scheduleModal").classList.add("hidden");
    toast(publishNow ? "Published to LinkedIn successfully! 🚀" : "Scheduled successfully", "success");
    showView("schedule");
  } catch (e) { $("#modalError").textContent = e.message; $("#modalError").classList.remove("hidden"); }
  finally { $("#modalSubmit").disabled = false; }
});

// ── Scheduled list ───────────────────────────────────────────────
async function loadScheduled() {
  const posts = await api("/api/scheduled");
  const list = $("#scheduledList");
  if (!posts.length) { list.innerHTML = `<div class="empty"><div class="empty-icon">🗓</div><p>No scheduled posts yet.</p></div>`; return; }
  list.innerHTML = posts.map((p) => `
    <div class="sched-item">
      ${p.draft_image ? `<img class="sched-thumb" src="${escapeHtml(p.draft_image)}" alt="" />` : `<div class="sched-thumb"></div>`}
      <div class="sched-body">
        <div class="sched-caption">${escapeHtml(p.draft_caption || p.draft_title || "(no caption)")}</div>
        <div class="sched-meta">
          <span class="badge ${p.status}">${p.status}</span>
          <span>${fmt(p.scheduled_for)}</span>
          ${p.platforms.map((pl) => `<span>${escapeHtml(pl.platform)}</span>`).join("")}
        </div>
      </div>
    </div>`).join("");
}
$("#schedRefresh").addEventListener("click", loadScheduled);

// ── Settings + accounts ──────────────────────────────────────────
async function ensureAccounts() {
  state.accounts = await api("/api/accounts");
  return state.accounts;
}

async function loadSettings() {
  const s = await api("/api/settings");
  $("#setFreshness").value = s.global_freshness_hours || 24;
  $("#setTimezone").value = s.timezone || "";
  $("#setTextModel").value = s.text_model || "";
  $("#setImageModel").value = s.image_model || "";
  $("#setBrand").value = s.brand_voice || "";
  $("#setAssistantModel").value = s.assistant_model || "";
  $("#setAssistantFastModel").value = s.assistant_fast_model || "";
  $("#setResearchModel").value = s.research_model || "";
  $("#setImageContentModel").value = s.image_content_model || "";
  if ($("#setAssistantLanguage")) $("#setAssistantLanguage").value = s.assistant_language || "English";
  $("#setTtsProvider").value = s.tts_provider || "openrouter";
  $("#setTtsModel").value = s.tts_model || "";
  $("#setTtsVoice").value = s.tts_voice || "";
  $("#setTranscribeModel").value = s.transcribe_model || "";
  $("#setAutoUpdate").value = s.auto_update_hours ?? "6";
  try { $("#setNiche").value = JSON.parse(s.niche_keywords || "[]").join(", "); } catch { $("#setNiche").value = ""; }

  const flags = $("#serviceFlags");
  flags.innerHTML = Object.entries(state.services).map(([k, v]) =>
    `<span class="badge ${v ? "completed" : "failed"}">${k} ${v ? "✓" : "✗"}</span>`).join("");

  await renderAccounts();
}

async function renderAccounts() {
  await ensureAccounts();
  const list = $("#accountsList");
  if (!state.accounts.length) { list.innerHTML = `<p class="hint">No connected accounts yet.</p>`; return; }
  list.innerHTML = state.accounts.map((a) => {
    const badge = `<span class="badge completed" style="margin-left:6px;font-size:10px;">Direct (Free)</span>`;
    const avatar = a.avatar_url ? `<img src="${escapeHtml(a.avatar_url)}" style="width:20px;height:20px;border-radius:50%;margin-right:6px;vertical-align:middle;" />` : "";
    return `
    <div class="account-item">
      <div style="display:flex;align-items:center;">
        ${avatar}
        <div><span class="p">${escapeHtml(a.platform)}</span> ${escapeHtml(a.display_name || a.username || a.platform)}${badge}</div>
      </div>
      <button class="icon-btn danger" data-id="${a.id}">Remove</button>
    </div>`;
  }).join("");
  $$(".account-item .icon-btn", list).forEach((b) =>
    b.addEventListener("click", async () => { await api(`/api/accounts/${b.dataset.id}`, { method: "DELETE" }); renderAccounts(); }));
}

$$(".connect-btn").forEach((b) => b.addEventListener("click", async () => {
  try {
    const platform = b.dataset.platform;
    const res = await api(`/api/accounts/connect/${platform}`);
    if (res.url) {
      window.location.href = res.url;
    } else if (res.message) {
      toast(res.message, "info");
      renderAccounts();
    } else {
      toast("No connect URL returned", "error");
    }
  } catch (e) { toast(e.message, "error"); }
}));

$("#checkOllamaBtn")?.addEventListener("click", async () => {
  const pill = $("#ollamaPill");
  try {
    pill.className = "badge pending";
    pill.textContent = "Checking local Ollama...";
    const r = await api("/api/models/ollama");
    if (r.available) {
      const modelNames = r.models.map((m) => m.name).slice(0, 3).join(", ");
      pill.className = "badge completed";
      pill.textContent = `Ollama Online (${r.models.length} models: ${modelNames || "ready"})`;
      toast("Ollama local connection verified!", "success");
    } else {
      pill.className = "badge failed";
      pill.textContent = "Ollama Offline / Unreachable";
      toast("Ollama is not running locally. Start it with 'ollama serve'", "error");
    }
  } catch (err) {
    pill.className = "badge failed";
    pill.textContent = "Error testing Ollama";
    toast(err.message, "error");
  }
});

$("#syncAccounts").addEventListener("click", async () => {
  try { await api("/api/accounts/sync", { method: "POST" }); toast("Accounts synced", "success"); renderAccounts(); }
  catch (e) { toast(e.message, "error"); }
});

$("#loadImageModels").addEventListener("click", async () => {
  try {
    const models = await api("/api/models/images");
    const picker = $("#imageModelPicker");
    picker.innerHTML = models.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || m.id)}</option>`).join("");
    picker.classList.remove("hidden");
    picker.onchange = () => { $("#setImageModel").value = picker.value; };
    toast(`${models.length} image models`, "success");
  } catch (e) { toast(e.message, "error"); }
});

$("#saveSettings").addEventListener("click", async () => {
  const niche = $("#setNiche").value.split(",").map((t) => t.trim()).filter(Boolean);
  try {
    await api("/api/settings", { method: "PUT", body: {
      global_freshness_hours: $("#setFreshness").value,
      timezone: $("#setTimezone").value,
      text_model: $("#setTextModel").value,
      image_model: $("#setImageModel").value,
      brand_voice: $("#setBrand").value,
      niche_keywords: JSON.stringify(niche),
      assistant_model: $("#setAssistantModel").value,
      assistant_fast_model: $("#setAssistantFastModel").value,
      research_model: $("#setResearchModel").value,
      image_content_model: $("#setImageContentModel").value,
      assistant_language: $("#setAssistantLanguage")?.value || "English",
      tts_provider: $("#setTtsProvider").value,
      tts_model: $("#setTtsModel").value,
      tts_voice: $("#setTtsVoice").value,
      transcribe_model: $("#setTranscribeModel").value,
      auto_update_hours: $("#setAutoUpdate").value,
    }});
    toast("Settings saved", "success");
  } catch (e) { toast(e.message, "error"); }
});

// Voice preset quick selector
$("#setVoicePreset")?.addEventListener("change", (e) => {
  const val = e.target.value;
  if (!val) return;
  const presets = {
    jarvis_gb: { provider: "google", model: "en-GB-Journey-O", voice: "en-GB-Journey-O" },
    jarvis_local: { provider: "voicestudio", model: "tts-1", voice: "jarvis-prime" },
    onyx: { provider: "openrouter", model: "tts-1", voice: "onyx" },
    fable: { provider: "openrouter", model: "tts-1", voice: "fable" },
    journey_f: { provider: "google", model: "en-US-Journey-F", voice: "en-US-Journey-F" },
    journey_d: { provider: "google", model: "en-US-Journey-D", voice: "en-US-Journey-D" },
    urdu_f: { provider: "google", model: "ur-PK-Standard-A", voice: "ur-PK-Standard-A" },
    urdu_m: { provider: "google", model: "ur-PK-Standard-B", voice: "ur-PK-Standard-B" },
    browser: { provider: "browser", model: "", voice: "" },
  };
  const cfg = presets[val];
  if (cfg) {
    $("#setTtsProvider").value = cfg.provider;
    $("#setTtsModel").value = cfg.model;
    $("#setTtsVoice").value = cfg.voice;
  }
});

// ── Global live events ───────────────────────────────────────────
function connectEvents() {
  const es = new EventSource("/api/events");
  es.onmessage = (ev) => {
    let data; try { data = JSON.parse(ev.data); } catch { return; }
    if (data.type === "scheduler") toast(data.message);
    if (data.type === "done" && state.view === "feed") loadFeed();
    if (data.type === "post-status" && state.view === "schedule") loadScheduled();
    if (data.type === "auto-sync") {
      if (data.message) toast(data.message);
      if (data.phase === "done" && state.view === "home" && window.HUD) window.HUD.load();
    }
    if (data.type === "draft-image" && data.draftId === state.activeDraft && state.view === "studio" && data.status !== "generating") {
      openDraft(state.activeDraft);
    }
    if (data.type === "briefing:ready") {
      toast("Autonomous briefing ready!", "info");
      if (window.soundEngine) window.soundEngine.play("engage");
      if (window.HUD?.loadBriefing) window.HUD.loadBriefing();
    }
    if (data.type === "auth:lock") {
      toast("Cooper Locked: Biometric authentication active", "warn");
      if (window.soundEngine) window.soundEngine.play("lock");
      if (window.faceAuth) window.faceAuth.lock();
    }
    if (data.type === "auth:unlock") {
      toast(`Operator Verified: ${data.user?.name || "Access Granted"}`, "info");
      if (window.soundEngine) window.soundEngine.play("unlock");
      if (window.faceAuth) window.faceAuth.hideLockScreen();
    }
    if (data.type === "auth:open-portal") {
      if (window.biometricAdmin) window.biometricAdmin.open();
    }
    if (data.type === "barehands:status") {
      if (window.barehandsOverlay) window.barehandsOverlay.setStatus(data.running);
    }
    if (data.type === "barehands:presented") {
      toast(`Holographic Stage: Presented "${data.title}"`, "info");
      if (window.soundEngine) window.soundEngine.play("repulsor");
      if (window.barehandsOverlay) window.barehandsOverlay.onPresented(data);
    }
    if (data.type === "barehands:cleared") {
      toast("Holographic Stage: Board cleared", "info");
    }
    if (data.type === "hud:sound") {
      if (window.soundEngine) window.soundEngine.play(data.cue);
    }
    if (data.type === "hud:mode") {
      if (window.arcReactor) window.arcReactor.setMode(data.mode);
    }
    if (data.type === "hud:power") {
      if (window.arcReactor) window.arcReactor.setPower(data.power);
    }
    if (data.type === "brainstorm:open") {
      if (window.jarvisFlowOverlay) window.jarvisFlowOverlay.open(data.topic);
    }
    if (data.type === "brainstorm:ready") {
      toast(`JarvisFlow: Mind map ready for "${data.topic}"`, "info");
      if (window.soundEngine) window.soundEngine.play("engage");
      if (window.jarvisFlowOverlay && window.jarvisFlowOverlay.isOpen) {
        window.jarvisFlowOverlay.session = data.session;
        window.jarvisFlowOverlay.render();
      }
    }
    if (data.type === "brainstorm:node-selected") {
      if (window.jarvisFlowOverlay && window.jarvisFlowOverlay.isOpen) {
        window.jarvisFlowOverlay.triggerNode(data.nodeId);
      }
    }
    if (data.type === "ironhands:transform") {
      if (window.ironHandsController) {
        window.ironHandsController.transform = { ...window.ironHandsController.transform, ...data.transform };
        if (data.gripState) window.ironHandsController.gripState = data.gripState;
        window.ironHandsController.applyTransform();
      }
    }
    if (data.type === "ironhands:target") {
      if (window.ironHandsController) window.ironHandsController.setTarget(data.target);
    }
    if (data.type === "ironhands:explode") {
      if (window.ironHandsController) window.ironHandsController.setExplodeFactor(data.explodeFactor);
      if (window.soundEngine) window.soundEngine.play(data.explodeFactor > 0 ? "repulsor" : "lock");
      toast(`IronHands: Arc Reactor ${data.explodeFactor > 0 ? "Deconstructed (" + Math.round(data.explodeFactor * 100) + "%)" : "Reassembled"}`, "info");
    }
    if (data.type === "ironhands:reset") {
      if (window.ironHandsController) window.ironHandsController.reset();
      toast("IronHands: 3D spatial alignment reset", "info");
    }
    if (data.type === "godseye:status") {
      if (window.godsEyeOverlay) {
        window.godsEyeOverlay.isRunning = data.status === "running";
        window.godsEyeOverlay.updateBadge(data.status === "running" ? "ONLINE (KEYLESS ESRI)" : (data.status === "booting" ? "BOOTING..." : "STANDBY"));
      }
    }
    if (data.type === "godseye:command") {
      if (data.command?.action === "open") {
        if (window.godsEyeOverlay) window.godsEyeOverlay.open();
      } else if (data.command?.action === "flyTo") {
        if (window.godsEyeOverlay) window.godsEyeOverlay.flyToTarget(data.command.location, data.command.lat, data.command.lon, data.command.altitude);
        toast(`God's Eye: Aligning orbit over ${data.command.location}`, "info");
      } else if (data.command?.action === "setOptics") {
        if (window.godsEyeOverlay) window.godsEyeOverlay.setOptics(data.command.mode);
        toast(`God's Eye: Sensor optics switched to ${data.command.mode}`, "info");
      }
    }
    health();
  };
  es.onerror = () => {};
}

// ── Gmail connect (Settings) ─────────────────────────────────────
async function renderGmailStatus() {
  try {
    const s = await api("/api/gmail/status");
    const el = $("#gmailStatus");
    if (!el) return;
    if (!s.configured) {
      el.innerHTML = `<span class="badge failed">not configured · add GOOGLE_CLIENT_ID/SECRET to .env</span>`;
    } else if (s.connected) {
      el.innerHTML = `<span class="badge completed">connected${s.email ? " · " + escapeHtml(s.email) : ""}</span>`;
    } else {
      el.innerHTML = `<span class="badge pending">configured · not connected</span>`;
    }
  } catch { /* ignore */ }
}
$("#gmailConnect")?.addEventListener("click", async () => {
  try {
    const { url } = await api("/api/gmail/connect");
    if (url) window.location.href = url;
  } catch (e) { toast(e.message, "error"); }
});
$("#gmailDisconnect")?.addEventListener("click", async () => {
  try { await api("/api/gmail/disconnect", { method: "POST" }); toast("Gmail disconnected", "success"); renderGmailStatus(); }
  catch (e) { toast(e.message, "error"); }
});
const _loadSettings = loadSettings;
loadSettings = async function () { await _loadSettings(); renderGmailStatus(); };

// ── Init ─────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
if (params.get("gmail") === "1") { toast("Gmail connected", "success"); history.replaceState(null, "", location.pathname); }
else if (params.get("gmail") === "error") { toast("Gmail connection failed", "error"); history.replaceState(null, "", location.pathname); }
if (params.get("connected") === "linkedin") { toast("LinkedIn connected successfully!", "success"); history.replaceState(null, "", location.pathname); }
else if (params.get("connected")) { toast("Account connected successfully", "success"); history.replaceState(null, "", location.pathname); }
if (params.get("error")) { toast(`OAuth Error: ${params.get("error")}`, "error"); history.replaceState(null, "", location.pathname); }

// Always boot into the Jarvis dashboard (HUD) on load/refresh — never restore a
// deep content-system view. Strip any lingering hash so refresh stays home.
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
showView("home");
health();
connectEvents();
setInterval(health, 15000);

// ── PWA Service Worker Registration ─────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
