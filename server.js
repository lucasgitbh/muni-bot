import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* ----------------------------------
   RETRY OPENROUTER
----------------------------------- */
axiosRetry(axios, {
  retries: 3,
  retryDelay: (c) => c * 1500,
  retryCondition: (err) =>
    err.response?.status === 429 ||
    err.response?.status >= 500
});

/* ----------------------------------
   CARGA JSON
----------------------------------- */
let sanRoque = {};

try {
  sanRoque = JSON.parse(
    fs.readFileSync("./data/sanroque.json", "utf8")
  );
  console.log("✅ JSON cargado correctamente");
} catch (err) {
  console.error("❌ Error cargando JSON", err);
}

/* ----------------------------------
   HELPERS LIMPIOS
----------------------------------- */

const listarHospedajes = () =>
  sanRoque.hospedajes
    .map(h => {
      const tel = h.telefono || h.telefonos?.[0] || "";
      const telLimpio = tel.replace(/\D/g, "");

      return `
🏨 <b>${h.nombre}</b><br>
📞 ${tel || "-"}<br>
📍 ${h.direccion || h.ubicacion || "-"}<br>

<a href="https://wa.me/${telLimpio}" target="_blank">📲 WhatsApp</a> |
<a href="${h.maps}" target="_blank">🗺️ Ver mapa</a>
`;
    })
    .join("<br><br>");
const listarGastronomia = () =>
  sanRoque.gastronomia
    .map(g => {
      const tel = g.whatsapp || "";
      const telLimpio = tel.replace(/\D/g, "");

      return `
🍽️ <b>${g.nombre}</b><br>
📞 ${tel || "-"}<br>
📍 ${g.direccion || "-"}<br>
🕒 ${g.horario || "-"}<br>
🍴 ${g.menu || ""}<br>

<a href="https://wa.me/${telLimpio}" target="_blank">📲 WhatsApp</a>
<a href="${g.maps}" target="_blank">🗺️ Ver en mapa</a>
`;
    })
    .join("<br><br>");
/* ----------------------------------
   BUSQUEDA REAL (ROBUSTA)
----------------------------------- */
function buscarItem(texto, lista) {
  return lista.find(item =>
    item.nombre?.toLowerCase().includes(texto)
  );
}

/* ----------------------------------
   RESPUESTA LOCAL (SIN IA)
----------------------------------- */
function respuestaLocal(msgRaw) {
  const msg = msgRaw.toLowerCase();

  /* 🏨 HOSPEDAJES */
  if (
    msg.includes("dormir") ||
    msg.includes("hotel") ||
    msg.includes("hospedaje") ||
    msg.includes("alojamiento")
  ) {
    return `🏨 Hospedajes en San Roque:\n\n${listarHospedajes()}`;
  }

  /* 🍽️ COMIDA */
  if (
    msg.includes("comer") ||
    msg.includes("restaurante") ||
    msg.includes("gastronomia") ||
    msg.includes("comida")
  ) {
    return `🍽️ Gastronomía en San Roque:\n\n${listarGastronomia()}`;
  }

  /* 📜 FUNDACIÓN */
  if (
    msg.includes("fundacion") ||
    msg.includes("fundó") ||
    msg.includes("historia")
  ) {
    return `📜 San Roque fue fundado el ${sanRoque.historia.fundacion.fecha}
por ${sanRoque.historia.fundacion.fundadores.join(" y ")}`;
  }

  /* 🔍 RESTAURANTE ESPECÍFICO */
  const resto = buscarItem(msg, sanRoque.gastronomia);
  if (resto) {
    return `🍽️ ${resto.nombre}
📞 ${resto.whatsapp || "-"}
🕒 ${resto.horario || "-"}
📍 ${resto.direccion || "-"}`;
  }

  /* 🔍 HOSPEDAJE ESPECÍFICO */
  const hotel = buscarItem(msg, sanRoque.hospedajes);
  if (hotel) {
    return `🏨 ${hotel.nombre}
📞 ${hotel.telefono || hotel.telefonos?.join(" / ") || "-"}
📍 ${hotel.direccion || hotel.ubicacion || "-"}`;
  }

  return null;
}

/* ----------------------------------
   SYSTEM PROMPT (ANTI INVENTOS)
----------------------------------- */
function buildContext() {
  return `
Sos un asistente turístico oficial de San Roque.

REGLAS:
- NO inventes información.
- Si no está en el JSON: "No tengo esa información".
- Respuestas cortas.
- Nada de markdown (*, **, etc).

CIUDAD: ${sanRoque.ciudad}
PROVINCIA: ${sanRoque.provincia}
PAÍS: ${sanRoque.pais}

FUNDACIÓN:
${sanRoque.historia.fundacion.fecha}
${sanRoque.historia.fundacion.fundadores.join(", ")}
`;
}

/* ----------------------------------
   ROUTES
----------------------------------- */

app.get("/", (req, res) => {
  res.send("🤖 Muni Bot OK");
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mensaje requerido" });
  }

  /* 1. RESPUESTA LOCAL (PRIORIDAD TOTAL) */
  const local = respuestaLocal(message);
  if (local) {
    return res.json({ reply: local });
  }

  /* 2. IA SOLO FALLBACK */
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",
        messages: [
          { role: "system", content: buildContext() },
          { role: "user", content: message }
        ],
        temperature: 0.2,
        max_tokens: 250
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://muni-bot-production.up.railway.app",
          "X-Title": "Muni Bot San Roque"
        }
      }
    );

    const reply =
      response.data?.choices?.[0]?.message?.content ||
      "No tengo esa información.";

    res.json({ reply });

  } catch (err) {
    console.log("⚠️ IA falló");

    res.json({
      reply: "No tengo esa información en este momento."
    });
  }
});

/* ----------------------------------
   START
----------------------------------- */

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server en puerto ${PORT}`);
});
