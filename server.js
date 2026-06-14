import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* 🔁 Reintentos por rate limit */
axiosRetry(axios, {
  retries: 2,
  retryDelay: (retryCount) => retryCount * 1500,
  retryCondition: (error) => error.response?.status === 429
});

/* 📦 JSON local seguro */
const sanRoque = JSON.parse(
  fs.readFileSync("./data/sanroque.json", "utf-8")
);

/* 🧠 cache simple en memoria */
const cache = new Map();

/* 🏠 endpoint base */
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo (San Roque)");
});

/* 🧠 contexto del municipio */
const contextoSanRoque = `
SAN ROQUE - DATOS OFICIALES

Historia:
- Fundación: ${sanRoque.historia.fundacion.fecha}
- Lugar: ${sanRoque.historia.fundacion.lugar}
- Fundadores: ${sanRoque.historia.fundacion.fundadores.join(", ")}

Hitos:
${sanRoque.historia.hitos.map(h => `- ${h.anio}: ${h.evento}`).join("\n")}

Datos generales:
- Provincia: ${sanRoque.provincia}
- País: ${sanRoque.pais}
- Distancia a Corrientes: ${sanRoque.servicios.distancia_a_corrientes_km} km
- Código postal: ${sanRoque.servicios.codigo_postal}
- Prefijo: ${sanRoque.servicios.prefijo}

Gastronomía:
${sanRoque.gastronomia.map(r => `- ${r}`).join("\n")}
`;

/* 📡 CHAT */
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mensaje obligatorio" });
  }

  const key = message.toLowerCase().trim();

  /* 🟢 CACHE HIT */
  if (cache.has(key)) {
    return res.json({
      reply: cache.get(key),
      cached: true
    });
  }

  /* ⌛ simulación "escribiendo..." */
  await new Promise(r => setTimeout(r, 1000));

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

Sos un guía turístico oficial de San Roque, Corrientes.

REGLAS:
- Usá SOLO la información dada
- No inventes datos
- Si no sabés: "No cuento con información oficial"
- Respuestas breves y claras
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

    /* 🟢 guardar en cache */
    cache.set(key, reply);

    return res.json({ reply });

  } catch (err) {
    console.error("❌ OpenRouter error:", err.response?.data || err.message);

    /* 🔴 fallback sin IA */
    return res.json({
      reply: `
📍 San Roque es una localidad de Corrientes, Argentina.
Fundada en 1773, es cabecera del departamento homónimo.
Podés visitar la plaza central, la iglesia y zonas rurales.
      `,
      fallback: true
    });
  }
});

/* 🚀 START SERVER */
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Muni Bot listo en puerto " + PORT);
});
