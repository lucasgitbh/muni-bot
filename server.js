import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* --------------------------------------------------
   🔁 RETRY AUTOMÁTICO (rate limit / errores API)
-------------------------------------------------- */
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1500,
  retryCondition: (error) =>
    error.response?.status === 429 ||
    error.response?.status >= 500
});

/* --------------------------------------------------
   📦 CARGA DE DATOS LOCALES (SIN assert - RAILWAY SAFE)
-------------------------------------------------- */
let sanRoque = {};

try {
  sanRoque = JSON.parse(
    fs.readFileSync("./data/sanroque.json", "utf-8")
  );
} catch (err) {
  console.log("⚠️ No se pudo cargar sanroque.json");
}

/* --------------------------------------------------
   🏠 HOME
-------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo - San Roque Corrientes");
});

/* --------------------------------------------------
   🧠 CONTEXTO DEL SISTEMA (RAG SIMPLE)
-------------------------------------------------- */
const contextoSanRoque = `
Eres un guía turístico oficial de San Roque, Corrientes, Argentina.

📍 DATOS OFICIALES:
- Fundación: ${sanRoque?.historia?.fundacion?.fecha || "1773"}
- Lugar: ${sanRoque?.historia?.fundacion?.lugar || "San Roque"}
- Provincia: ${sanRoque?.provincia || "Corrientes"}
- País: ${sanRoque?.pais || "Argentina"}
- Población: ${sanRoque?.poblacion || "No especificado"}

📜 REGLAS IMPORTANTES:
- No inventes datos.
- Si no sabes algo: responde "No cuento con información oficial sobre eso".
- Sé breve, turístico y claro.
- No salgas del tema de San Roque.
`;

/* --------------------------------------------------
   🧠 FALLBACK LOCAL (si OpenRouter falla)
-------------------------------------------------- */
function fallbackResponse(message) {
  const msg = message.toLowerCase();

  if (msg.includes("comer")) {
    return "En San Roque podés encontrar opciones gastronómicas en el centro y comedores locales.";
  }

  if (msg.includes("fundación") || msg.includes("quien fundo")) {
    return "San Roque fue fundado en 1773 por Juan García de Cossio y Antonio de la Trinidad Martínez de Ibarra.";
  }

  if (msg.includes("lugares") || msg.includes("visitar")) {
    return "Podés visitar la plaza central, la iglesia parroquial y zonas rurales del pueblo.";
  }

  if (msg.includes("banco")) {
    return "El banco se encuentra en la zona céntrica de San Roque.";
  }

  return "San Roque es una localidad tranquila de Corrientes con historia, cultura y naturaleza.";
}

/* --------------------------------------------------
   📡 CHAT PRINCIPAL
-------------------------------------------------- */
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mensaje requerido" });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content: contextoSanRoque
          },
          {
            role: "user",
            content: message
          }
        ],

        temperature: 0.4,
        max_tokens: 500
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

    const reply = response.data?.choices?.[0]?.message?.content;

    return res.json({
      reply: reply || fallbackResponse(message)
    });

  } catch (err) {
    console.log("❌ OpenRouter falló, usando fallback");

    return res.json({
      reply: fallbackResponse(message)
    });
  }
});

/* --------------------------------------------------
   🚀 START SERVER
-------------------------------------------------- */
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Bot online en puerto " + PORT);
});
