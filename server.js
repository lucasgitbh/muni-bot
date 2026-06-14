import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

// 🔁 Reintentos automáticos por rate limit
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 2000,
  retryCondition: (error) => error.response?.status === 429
});


// 📦 CARGA SEGURA DEL JSON (SIN assert → FIX RAILWAY)
const sanRoque = JSON.parse(
  fs.readFileSync("./data/sanroque.json", "utf-8")
);


// 🏠 ENDPOINT BASE
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo (San Roque, Corrientes).");
});


// 🧠 CONTEXTO DEL MUNICIPIO
const contextoSanRoque = `
SAN ROQUE - DATOS OFICIALES

Historia:
- Fundación: ${sanRoque.historia.fundacion.fecha}
- Lugar: ${sanRoque.historia.fundacion.lugar}
- Fundadores: ${sanRoque.historia.fundacion.fundadores.join(", ")}

Hitos históricos:
${sanRoque.historia.hitos.map(h => `- ${h.anio}: ${h.evento}`).join("\n")}

Datos generales:
- Provincia: ${sanRoque.provincia}
- País: ${sanRoque.pais}
- Distancia a Corrientes: ${sanRoque.servicios.distancia_a_corrientes_km} km
- Código postal: ${sanRoque.servicios.codigo_postal}
- Prefijo: ${sanRoque.servicios.prefijo}

Gastronomía registrada:
${sanRoque.gastronomia.map(r => `- ${r}`).join("\n")}
`;


// 📡 CHAT PRINCIPAL
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "El mensaje es obligatorio" });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemma-4-31b-it:free",

        messages: [
          {
            role: "system",
            content: `
${contextoSanRoque}

Sos Muni Bot, asistente turístico oficial de San Roque, Corrientes.

REGLAS ESTRICTAS:
- Usá SOLO la información proporcionada.
- No inventes lugares, eventos ni actividades.
- Si no hay información, respondé: "No cuento con información oficial sobre eso."
- No agregues datos externos.
- Respondé claro, breve y útil.
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
        timeout: 15000
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch (err) {
    console.error("❌ Error en /chat:", err.response?.data || err.message);

    res.status(500).json({
      error: "El bot está ocupado, intenta nuevamente."
    });
  }
});


// 🚀 START SERVER
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Bot online en puerto " + PORT);
});
