import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
require("dotenv").config();

// 1. Inicialización y constantes
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
  console.error("ERROR CRÍTICO: No se definió la variable de entorno ADMIN_SECRET.");
  process.exit(1);
}

// 2. Rutas del sistema de archivos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const postsFilePath = path.join(__dirname, "../data/posts.json");

// 3. Middlewares
app.use(cors());
app.use(express.json());

// 4. Endpoints

// Listar posts (públicos por defecto, todos si se envía la clave)
app.get("/api/posts", async (req, res) => {
  try {
    const rawData = await fs.readFile(postsFilePath, "utf-8");
    const posts = JSON.parse(rawData);

    const authHeader = req.headers["x-admin-key"];
    const isAdmin = authHeader === ADMIN_SECRET;

    const postsVisibles = isAdmin 
      ? posts 
      : posts.filter(post => !post.isPrivate);

    res.json(postsVisibles);
  } catch (error) {
    console.error("Error al leer los posts:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Alternar visibilidad de un post (Privado <-> Público)
app.patch("/api/posts/:id/visibility", async (req, res) => {
  const authHeader = req.headers["x-admin-key"];
  
  if (authHeader !== ADMIN_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { id } = req.params;

  try {
    const rawData = await fs.readFile(postsFilePath, "utf-8");
    const posts = JSON.parse(rawData);

    const postIndex = posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    posts[postIndex].isPrivate = !posts[postIndex].isPrivate;

    await fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2));

    res.json({ 
      message: "Visibilidad actualizada", 
      post: posts[postIndex] 
    });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar la visibilidad" });
  }
});

// DELETE: Eliminar un post por ID
app.delete("/api/posts/:id", async (req, res) => {
  const authHeader = req.headers["x-admin-key"];
  if (authHeader !== ADMIN_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { id } = req.params;

  try {
    const rawData = await fs.readFile(postsFilePath, "utf-8");
    const posts = JSON.parse(rawData);

    const filtrados = posts.filter(p => p.id !== id);
    if (filtrados.length === posts.length) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    await fs.writeFile(postsFilePath, JSON.stringify(filtrados, null, 2));
    res.json({ message: "Post eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el post" });
  }
});

// PUT: Editar un post existente por ID
app.put("/api/posts/:id", async (req, res) => {
  const authHeader = req.headers["x-admin-key"];
  if (authHeader !== ADMIN_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { id } = req.params;
  const { title, category, summary, content, isPrivate } = req.body;

  try {
    const rawData = await fs.readFile(postsFilePath, "utf-8");
    const posts = JSON.parse(rawData);

    const index = posts.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Post no encontrado" });
    }

    // Actualiza campos conservando fecha original e ID
    posts[index] = {
      ...posts[index],
      title: title || posts[index].title,
      category: category || posts[index].category,
      summary: summary || posts[index].summary,
      content: content || posts[index].content,
      isPrivate: isPrivate !== undefined ? Boolean(isPrivate) : posts[index].isPrivate
    };

    await fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2));
    res.json({ message: "Post actualizado", post: posts[index] });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar el post" });
  }
});

// 5. Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

// Crear un post nuevo (Protegido con clave de admin)
app.post("/api/posts", async (req, res) => {
  const authHeader = req.headers["x-admin-key"];
  if (authHeader !== ADMIN_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { title, category, summary, content, isPrivate } = req.body;

  if (!title || !category || !content) {
    return res.status(400).json({ error: "Faltan campos obligatorios (title, category, content)" });
  }

  try {
    const rawData = await fs.readFile(postsFilePath, "utf-8");
    const posts = JSON.parse(rawData);

    // Generar slug simple a partir del título
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const newPost = {
      id: Date.now().toString(),
      slug,
      title,
      category,
      isPrivate: Boolean(isPrivate),
      date: new Date().toISOString().split("T")[0],
      summary: summary || title,
      content
    };

    posts.unshift(newPost); // Lo agregamos al inicio para que quede arriba de todo
    await fs.writeFile(postsFilePath, JSON.stringify(posts, null, 2));

    res.status(201).json({ message: "Post creado con éxito", post: newPost });
  } catch (error) {
    console.error("Error al guardar el post:", error);
    res.status(500).json({ error: "Error al persistir el post" });
  }
});