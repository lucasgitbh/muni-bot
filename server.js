import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

/* ----------------------------------
   RETRY
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
   HELPERS (100% CONTROLADOS POR JSON)
----------------------------------- */

const listarHospedajes = () =>
  sanRoque.hospedajes
    .map(
      h => `🏨 ${h.nombre}
📞 ${h.telefono || h.telefonos?.join(" / ") || "-"}
📍 ${h.direccion || h.ubicacion || "-"}`
    )
    .join("\n\n");

const listarGastronomia = () =>
  sanRoque.gastronomia
    .map(
      g => `🍽️ ${g.nombre}
📞 ${g.whatsapp}
🕒 ${g.horario}`
    )
    .join("\n\n");

function buscarEnLista(texto, lista) {
  return lista.find(i =>
    texto.includes(i.nombre.toLowerCase())
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

  /* 🍽️ COMER */
  if (
    msg.includes("comer") ||
    msg.includes("restaurante") ||
    msg.includes("gastronomia")
  ) {
    return `🍽️ Gastronomía:\n\n${listarGastronomia()}`;
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
  const resto = buscarEnLista(msg, sanRoque.gastronomia);
  if (resto) {
    return `🍽️ ${resto.nombre}
📞 ${resto.whatsapp}
🕒 ${resto.horario}
📍 ${resto.direccion || "-"}`
  }

  /* 🔍 HOSPEDAJE ESPECÍFICO */
  const hotel = buscarEnLista(msg, sanRoque.hospedajes);
  if (hotel) {
    return `🏨 ${hotel.nombre}
📞 ${hotel.telefono || hotel.telefonos?.join(" / ")}
📍 ${hotel.direccion || hotel.ubicacion || "-"}`
  }

  return null;
}

/* ----------------------------------
   SYSTEM PROMPT (MUY ESTRICTO)
----------------------------------- */

function buildContext() {
  return `
SOS UN ASISTENTE TURÍSTICO OFICIAL DE SAN ROQUE.

REGLAS OBLIGATORIAS:
- SOLO podés usar información del JSON provisto.
- SI NO está en el JSON, respondé: "No tengo esa información".
- NO inventes hoteles, restaurantes ni datos.
- Respuestas cortas.

DATOS:

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

  /* 1. SI EXISTE EN JSON → NO IA */
  const local = respuestaLocal(message);
  if (local) {
    return res.json({ reply: local });
  }

  /* 2. IA SOLO COMO FALLBACK CONTROLADO */
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content: buildContext()
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.2,
        max_tokens: 300
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
    console.log("⚠️ Error IA, fallback activo");

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
