import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* 🔁 retry automático */
axiosRetry(axios, {
  retries: 2,
  retryDelay: (r) => r * 1500,
  retryCondition: (err) => err.response?.status === 429
});

/* 📦 JSON local */
const sanRoque = JSON.parse(
  fs.readFileSync("./data/sanroque.json", "utf-8")
);

/* 🧠 cache */
const cache = new Map();

/* 🏠 health */
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo");
});

/* 🧠 CONTEXTO */
const contexto = `
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
- Distancia a Corrientes: ${sanRoque.servicios.distancia_a_corrientes_km} km

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

  if (cache.has(key)) {
    return res.json({ reply: cache.get(key), cached: true });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content: `
${contexto}

Sos un guía turístico de San Roque, Corrientes.

REGLAS:
- Respondé de forma natural, amable y conversacional
- Usá la info oficial como base
- Si falta algo, respondé de forma general útil para turistas
- Nunca respondas seco o tipo "no tengo info"
            `
          },
          {
            role: "user",
            content: message
          }
        ],

        temperature: 0.4
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

    cache.set(key, reply);

    res.json({ reply });

  } catch (err) {
    console.error("❌ error:", err.response?.data || err.message);

    res.json({
      reply: "📍 San Roque es una localidad tranquila de Corrientes, ideal para turismo rural y cultura local."
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Bot listo en puerto " + PORT);
});
