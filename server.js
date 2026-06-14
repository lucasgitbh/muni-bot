import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* 🔁 RETRY API */
axiosRetry(axios, {
  retries: 2,
  retryDelay: (retryCount) => retryCount * 1500,
  retryCondition: (error) => error.response?.status === 429
});

/* 📦 JSON LOCAL */
const sanRoque = JSON.parse(
  fs.readFileSync("./data/sanroque.json", "utf-8")
);

/* 🧠 CACHE SIMPLE EN MEMORIA */
const cache = new Map();

/* 🏠 HEALTH CHECK */
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot PRO activo (San Roque)");
});

/* 🧠 CONTEXTO */
const contextoSanRoque = `
SAN ROQUE - DATOS OFICIALES

Historia:
- Fundación: ${sanRoque.historia.fundacion.fecha}
- Lugar: ${sanRoque.historia.fundacion.lugar}
- Fundadores: ${sanRoque.historia.fundacion.fundadores.join(", ")}

Hitos:
${sanRoque.historia.hitos.map(h => `- ${h.anio}: ${h.evento}`).join("\n")}

Datos:
- Provincia: ${sanRoque.provincia}
- País: ${sanRoque.pais}
- Distancia Corrientes: ${sanRoque.servicios.distancia_a_corrientes_km} km

Gastronomía:
${sanRoque.gastronomia.map(r => `- ${r}`).join("\n")}
`;

/* 📡 CHAT */
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mensaje requerido" });
  }

  const key = message.toLowerCase().trim();

  /* 🟢 1. CACHE HIT */
  if (cache.has(key)) {
    return res.json({
      reply: cache.get(key),
      cached: true
    });
  }

  /* ⌛ SIMULAR "ESCRIBIENDO..." */
  await new Promise(resolve => setTimeout(resolve, 1200));

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content: `
${contextoSanRoque}

Sos un guía turístico de San Roque.

REGLAS:
- Usá SOLO la info dada
- No inventes
- Si no sabés: "No cuento con información oficial"
            `
          },
          {
            role: "user",
            content: message
          }
        ],

        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://muni-bot-production.up.railway.app",
          "X-Title": "Muni Bot San Roque"
        },
        timeout: 12000
      }
    );

    const reply = response.data.choices[0].message.content;

    /* 🟢 GUARDAR EN CACHE */
    cache.set(key, reply);

    return res.json({ reply });

  } catch (err) {
    console.error("❌ OpenRouter falló:", err.response?.data || err.message);

    /* 🔴 FALLBACK SIN IA (IMPORTANTE) */
    const fallback = `
📍 San Roque es una localidad de Corrientes, Argentina.
Su historia se remonta a 1773 y es cabecera del departamento homónimo.
Para más información, consultá la plaza central o la iglesia local.
    `;

    return res.json({
      reply: fallback,
      fallback: true
    });
  }
});

/* 🚀 START */
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Muni Bot PRO online en puerto " + PORT);
});
