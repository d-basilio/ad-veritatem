import { loadPosts, formatDate, escapeHtml } from "./posts.js";

function setActiveMenu(){
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach(a=>{
    const href = a.getAttribute("href");
    if(href === path) a.classList.add("active");
  });
}

async function loadSiteConfig(){
  try{
    const res = await fetch("./data/site.json", { cache: "no-store" });
    if(!res.ok) throw new Error("sem site.json");
    return await res.json();
  }catch{
    // defaults se o arquivo não existir
    return {
      authorName: "Autor",
      siteName: "Ad Veritatem",
      tagline: "Um caminhar pela Palavra"
    };
  }
}

function applyTokens(str, cfg){
  if(!str) return "";
  return str
    .replaceAll("{{AUTHOR}}", cfg.authorName ?? "")
    .replaceAll("{{SITE_NAME}}", cfg.siteName ?? "")
    .replaceAll("{{TAGLINE}}", cfg.tagline ?? "");
}

function renderPostItem(p, cfg, { showContent=false } = {}){
  const id = escapeHtml(p.id || "");
  const titleRaw = applyTokens(p.title || "", cfg);
  const excerptRaw = applyTokens(p.excerpt || "", cfg);
  const contentRaw = applyTokens(p.content || "", cfg);

  const title = escapeHtml(titleRaw);
  const excerpt = escapeHtml(excerptRaw);

  const date = formatDate(p.date);
  const book = escapeHtml(p.bibleBook || "");
  const ref = escapeHtml(p.bibleRef || "");
  const topics = Array.isArray(p.topics) ? p.topics : [];
  const tags = topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");

  // Link do post (Home) -> Arquivos com id
  const link = id ? `arquivos.html?id=${encodeURIComponent(p.id)}` : "arquivos.html";

  const content = showContent
  ? `<hr class="sep"><div class="small" style="white-space:pre-wrap">${contentRaw}</div>`
  : "";

  return `
    <article class="post" id="${id ? `post-${id}` : ""}">
      <div class="kicker">${book}${ref ? " • " + ref : ""}</div>
      <h2><a href="${link}">${title}</a></h2>
      <div class="meta">
        <span>📅 ${date}</span>
        <span>🏷️ ${topics.length ? escapeHtml(topics.join(", ")) : "Sem temas"}</span>
      </div>
      ${excerpt ? `<p class="small">${excerpt}</p>` : ""}
      ${tags}
      ${content}
    </article>
  `;
}

async function homePage(cfg){
  const list = document.querySelector("#recentPosts");
  if(!list) return;

  try{
    const posts = await loadPosts();
    const latest = posts.slice(0, 8);
    list.innerHTML = latest.map(p => renderPostItem(p, cfg)).join("");
  }catch(err){
    list.innerHTML = `<div class="pad notice">Erro: ${escapeHtml(err.message)}</div>`;
  }
}

function uniq(arr){ return [...new Set(arr)].filter(Boolean); }

async function arquivosPage(cfg){
  const container = document.querySelector("#archiveResults");
  const q = document.querySelector("#q");
  const bookSel = document.querySelector("#book");
  const topicSel = document.querySelector("#topic");
  const count = document.querySelector("#count");
  if(!container || !q || !bookSel || !topicSel || !count) return;

  let posts = [];
  try{
    posts = await loadPosts();
  }catch(err){
    container.innerHTML = `<div class="pad notice">Erro: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const params = new URLSearchParams(location.search);
  const focusId = params.get("id")?.trim();

  const books = uniq(posts.map(p => p.bibleBook)).sort((a,b)=>a.localeCompare(b));
  const topics = uniq(posts.flatMap(p => Array.isArray(p.topics) ? p.topics : [])).sort((a,b)=>a.localeCompare(b));

  bookSel.innerHTML = `<option value="">Todos os livros</option>` + books.map(b=>`<option>${escapeHtml(b)}</option>`).join("");
  topicSel.innerHTML = `<option value="">Todos os temas</option>` + topics.map(t=>`<option>${escapeHtml(t)}</option>`).join("");

  // Se veio com ?id=..., filtra direto aquele post
  if(focusId){
    const found = posts.filter(p => p.id === focusId);
    count.textContent = `${found.length} texto(s)`;
    container.innerHTML = found.map(p => renderPostItem(p, cfg, { showContent:true })).join("")
      || `<div class="pad notice">Não achei nenhum texto com id "${escapeHtml(focusId)}".</div>`;

    // opcional: rola até o artigo
    setTimeout(()=>{
      const el = document.getElementById(`post-${focusId}`);
      if(el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return;
  }

  function apply(){
    const term = q.value.trim().toLowerCase();
    const book = bookSel.value;
    const topic = topicSel.value;

    const filtered = posts.filter(p=>{
      const hay = [
        p.title, p.excerpt, p.content, p.bibleBook, p.bibleRef,
        ...(Array.isArray(p.topics) ? p.topics : [])
      ].join(" ").toLowerCase();

      const okTerm = !term || hay.includes(term);
      const okBook = !book || (p.bibleBook === book);
      const okTopic = !topic || (Array.isArray(p.topics) && p.topics.includes(topic));
      return okTerm && okBook && okTopic;
    });

    count.textContent = `${filtered.length} texto(s)`;

    container.innerHTML = filtered
      .map(p => renderPostItem(p, cfg, { showContent:true }))
      .join("") || `<div class="pad notice">Nenhum texto encontrado com esses filtros.</div>`;
  }

  q.addEventListener("input", apply);
  bookSel.addEventListener("change", apply);
  topicSel.addEventListener("change", apply);

  apply();
}

function pixCopy(){
  const btn = document.querySelector("#copyPix");
  if(!btn) return;

  btn.addEventListener("click", async ()=>{
    const keyEl = document.querySelector("#pixKey");
    const key = (keyEl?.textContent || "").trim();
    if(!key || key === "COLE_SUA_CHAVE_PIX_AQUI") return;

    try{
      await navigator.clipboard.writeText(key);
      btn.textContent = "Copiado!";
      setTimeout(()=>btn.textContent="Copiar PIX", 1200);
    }catch{
      btn.textContent = "Não deu :(";
      setTimeout(()=>btn.textContent="Copiar PIX", 1200);
    }
  });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  setActiveMenu();
  const cfg = await loadSiteConfig();
  await homePage(cfg);
  await arquivosPage(cfg);
  pixCopy();
});

