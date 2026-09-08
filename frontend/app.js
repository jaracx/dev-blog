const API_URL = "/api/posts";
const container = document.getElementById("posts-container");
const postView = document.getElementById("post-view");
const postDetailContent = document.getElementById("post-detail-content");
const backBtn = document.getElementById("back-btn");
const siteTitle = document.getElementById("site-title");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const adminBtn = document.getElementById("admin-btn");
const createPostSection = document.getElementById("create-post-section");
const newPostForm = document.getElementById("new-post-form");

let adminKey = localStorage.getItem("adminKey") || "";
let cachedPosts = [];
let editingPostId = null; // null = modo crear, string = modo editar

function updateAdminButtonState() {
  adminBtn.textContent = adminKey ? "Cerrar Modo Admin" : "Modo Admin";
  if (adminKey) {
    createPostSection.classList.remove("hidden");
  } else {
    createPostSection.classList.add("hidden");
  }
}

adminBtn.addEventListener("click", () => {
  if (adminKey) {
    localStorage.removeItem("adminKey");
    adminKey = "";
  } else {
    const key = prompt("Ingresá la clave de administrador:");
    if (key) {
      localStorage.setItem("adminKey", key.trim());
      adminKey = key.trim();
    }
  }
  updateAdminButtonState();
  fetchPosts();
});

async function toggleVisibility(id) {
  try {
    const response = await fetch(`${API_URL}/${id}/visibility`, {
      method: "PATCH",
      headers: { "x-admin-key": adminKey }
    });

    if (!response.ok) throw new Error("No se pudo cambiar la visibilidad");
    fetchPosts();
  } catch (err) {
    alert(err.message);
  }
}
window.toggleVisibility = toggleVisibility;

async function fetchPosts() {
  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");

  try {
    const headers = {};
    if (adminKey) headers["x-admin-key"] = adminKey;

    const res = await fetch(API_URL, { headers });
    if (!res.ok) throw new Error(`Error ${res.status}: Fallo al conectar con el backend`);

    cachedPosts = await res.json();
    loadingEl.classList.add("hidden");

    showListView();
    renderPosts(cachedPosts);
  } catch (err) {
    loadingEl.classList.add("hidden");
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  }
}

function showListView() {
  postView.classList.add("hidden");
  container.classList.remove("hidden");
  if (adminKey) createPostSection.classList.remove("hidden"); // <-- Lo vuelve a mostrar
}

function showDetailView(post) {
  container.classList.add("hidden");
  createPostSection.classList.add("hidden"); // <-- Oculta el formulario al leer
  postView.classList.remove("hidden");

  const badgeCategory = `badge-${post.category.toLowerCase()}`;
  const htmlContent = marked.parse(post.content);

  postDetailContent.innerHTML = `
    <div class="post-meta" style="margin-top: 1rem;">
      <span class="badge ${badgeCategory}">${post.category}</span>
      <span class="date">${post.date}</span>
    </div>
    <h1 style="margin: 0.8rem 0 1.5rem 0;">${post.title}</h1>
    <div class="markdown-body">${htmlContent}</div>
  `;
}

function renderPosts(posts) {
  container.innerHTML = "";
  if (posts.length === 0) {
    container.innerHTML = "<p class='state-message'>No hay posts disponibles.</p>";
    return;
  }

  posts.forEach(post => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.style.cursor = "pointer";

    const badgeCategory = `badge-${post.category.toLowerCase()}`;
    const privateBadge = post.isPrivate ? `<span class="badge badge-private">Privado</span>` : "";

    const adminControls = adminKey 
      ? `<div class="admin-actions" style="margin-top: 0.8rem; display: flex; gap: 0.5rem;">
          <button class="toggle-btn" onclick="event.stopPropagation(); toggleVisibility('${post.id}')">
            ${post.isPrivate ? "Hacer Público" : "Hacer Privado"}
          </button>
          <button class="toggle-btn" onclick="event.stopPropagation(); startEditPost('${post.id}')">
            Editar
          </button>
          <button class="toggle-btn btn-danger" onclick="event.stopPropagation(); deletePost('${post.id}')">
            Eliminar
          </button>
         </div>` 
      : "";

    card.innerHTML = `
      <div class="post-meta">
        <span class="badge ${badgeCategory}">${post.category}</span>
        ${privateBadge}
        <span class="date">${post.date}</span>
      </div>
      <h2 class="post-title">${post.title}</h2>
      <p class="post-summary">${post.summary}</p>
      ${adminControls}
    `;

    card.addEventListener("click", () => showDetailView(post));
    container.appendChild(card);
  });
}

async function deletePost(id) {
  if (!confirm("¿Seguro que querés eliminar este post?")) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey }
    });

    if (!res.ok) throw new Error("Error al eliminar el post");
    fetchPosts();
  } catch (err) {
    alert(err.message);
  }
}

function startEditPost(id) {
  const post = cachedPosts.find(p => p.id === id);
  if (!post) return;

  editingPostId = post.id;
  document.getElementById("post-title-input").value = post.title;
  document.getElementById("post-category-select").value = post.category;
  document.getElementById("post-private-check").checked = post.isPrivate;
  document.getElementById("post-summary-input").value = post.summary;
  document.getElementById("post-content-input").value = post.content;

  document.querySelector("#create-post-section h2").textContent = "Editar Entrada";
  document.querySelector("#new-post-form button[type='submit']").textContent = "Guardar Cambios";

  createPostSection.scrollIntoView({ behavior: "smooth" });
}

window.deletePost = deletePost;
window.startEditPost = startEditPost;

backBtn.addEventListener("click", showListView);
siteTitle.addEventListener("click", showListView);

updateAdminButtonState();
fetchPosts();
newPostForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("post-title-input").value;
  const category = document.getElementById("post-category-select").value;
  const isPrivate = document.getElementById("post-private-check").checked;
  const summary = document.getElementById("post-summary-input").value;
  const content = document.getElementById("post-content-input").value;

  const url = editingPostId ? `${API_URL}/${editingPostId}` : API_URL;
  const method = editingPostId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({ title, category, isPrivate, summary, content })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Error en la operación");
    }

    // Resetear formulario y volver a modo creación
    newPostForm.reset();
    editingPostId = null;
    document.querySelector("#create-post-section h2").textContent = "Nuevo Artículo / Apunte";
    document.querySelector("#new-post-form button[type='submit']").textContent = "Publicar Entrada";

    fetchPosts();
  } catch (err) {
    alert(err.message);
  }
});