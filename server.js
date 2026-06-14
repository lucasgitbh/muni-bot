import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* --------------------------------------------------
   🔁 RETRY AUTOMÁTICO
-------------------------------------------------- */
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1500,
  retryCondition: (error) =>
    error.response?.status === 429 ||
    error.response?.status >= 500
});

/* --------------------------------------------------
   📦 CARGA JSON LOCAL
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
   🧠 CONTEXTO RAG (IMPORTANTE)
-------------------------------------------------- */
const contextoSanRoque = `
Sos Muni Bot, asistente turístico oficial de San Roque, Corrientes, Argentina.

DATOS REALES:
- Fundación: ${sanRoque?.historia?.fundacion?.fecha || "1773"}
- Lugar: ${sanRoque?.historia?.fundacion?.lugar || "San Roque"}
- Provincia: ${sanRoque?.provincia || "Corrientes"}
- País: ${sanRoque?.pais || "Argentina"}
- Código postal: ${sanRoque?.servicios?.codigo_postal || "W3448"}
- Distancia a Corrientes: ${sanRoque?.servicios?.distancia_a_corrientes_km || "135 km"}

HITOS:
${(sanRoque?.historia?.hitos || [])
  .map(h => `- ${h.anio}: ${h.evento}`)
  .join("\n")}

GASTRONOMÍA:
${(sanRoque?.gastronomia || []).map(g => `- ${g}`).join("\n")}

REGLAS:
- Solo usar esta información como base
- No inventar datos específicos
- Responder como guía turístico
- Respuestas cortas, claras y útiles
`;

/* --------------------------------------------------
   🧠 FALLBACK LOCAL (SIN IA)
-------------------------------------------------- */
function fallbackResponse(message) {
  const msg = message.toLowerCase();

  if (msg.includes("comer") || msg.includes("hambre")) {
    return "En San Roque hay comedores familiares, parrillas y comida típica correntina como asado, empanadas y chipá.";
  }

  if (msg.includes("fundación") || msg.includes("quién fundo")) {
    return "San Roque fue fundado en 1773 por Juan García de Cossio y Antonio de la Trinidad Martínez de Ibarra.";
  }

  if (msg.includes("lugares") || msg.includes("visitar")) {
    return "Podés visitar la plaza central, la iglesia histórica y recorrer zonas rurales y naturales.";
  }

  if (msg.includes("banco")) {
    return "El banco se encuentra en la zona céntrica de San Roque.";
  }

  return "San Roque es una localidad de Corrientes con historia colonial, naturaleza y vida tranquila.";
}

/* --------------------------------------------------
   🏠 HOME
-------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo - San Roque Corrientes");
});

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

    const reply =
      response.data?.choices?.[0]?.message?.content ||
      fallbackResponse(message);

    return res.json({ reply });

  } catch (err) {
    console.log("❌ OpenRouter falló → fallback activo");

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
