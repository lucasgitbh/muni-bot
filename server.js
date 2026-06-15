import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

axiosRetry(axios, {
  retries: 3,
  retryDelay: (count) => count * 1500,
  retryCondition: (error) =>
    error.response?.status === 429 ||
    error.response?.status >= 500
});

/* ----------------------------------
   CARGAR JSON
----------------------------------- */

let sanRoque = {};

try {
  sanRoque = JSON.parse(
    fs.readFileSync("./data/sanroque.json", "utf8")
  );

  console.log("✅ sanroque.json cargado");
} catch (err) {
  console.error("❌ Error cargando JSON", err);
}

/* ----------------------------------
   HELPERS
----------------------------------- */

function listaHospedajes() {
  return sanRoque.hospedajes
    .map(
      h =>
        `🏨 ${h.nombre}\n📞 ${
          h.telefono || h.telefonos?.join(" / ")
        }`
    )
    .join("\n\n");
}

function listaGastronomia() {
  return sanRoque.gastronomia
    .map(
      g =>
        `🍽️ ${g.nombre}\n📞 ${g.whatsapp}\n🕒 ${g.horario}`
    )
    .join("\n\n");
}

function buscarHospedaje(nombre) {
  return sanRoque.hospedajes.find(h =>
    nombre.includes(h.nombre.toLowerCase())
  );
}

function buscarGastronomia(nombre) {
  return sanRoque.gastronomia.find(g =>
    nombre.includes(g.nombre.toLowerCase())
  );
}

/* ----------------------------------
   RESPUESTAS LOCALES
----------------------------------- */

function respuestaLocal(texto) {

  const msg = texto.toLowerCase();

  /* TODOS LOS HOSPEDAJES */

  if (
    msg.includes("hospedaje") ||
    msg.includes("hotel") ||
    msg.includes("alojamiento")
  ) {
    return `
🏨 Hospedajes disponibles en San Roque:

${listaHospedajes()}
`;
  }

  /* TODOS LOS RESTAURANTES */

  if (
    msg.includes("comer") ||
    msg.includes("restaurante") ||
    msg.includes("gastronomia")
  ) {
    return `
🍽️ Opciones gastronómicas:

${listaGastronomia()}
`;
  }

  /* CELIACOS */

  if (
    msg.includes("celiaco") ||
    msg.includes("sin tacc")
  ) {

    const lugares = sanRoque.gastronomia.filter(
      g => g.celiacos
    );

    return `
✅ Lugares con menú para celíacos:

${lugares.map(g => "• " + g.nombre).join("\n")}
`;
  }

  /* MASCOTAS */

  if (
    msg.includes("mascota") ||
    msg.includes("perro")
  ) {

    const lugares = sanRoque.gastronomia.filter(
      g => g.mascotas
    );

    return `
🐾 Lugares que aceptan mascotas:

${lugares.map(g => "• " + g.nombre).join("\n")}
`;
  }

  /* WIFI */

  if (
    msg.includes("wifi")
  ) {

    const lugares = sanRoque.hospedajes.filter(
      h => h.wifi
    );

    return `
📶 Hospedajes con WiFi:

${lugares.map(h => "• " + h.nombre).join("\n")}
`;
  }

  /* FUNDACION */

  if (
    msg.includes("fundacion") ||
    msg.includes("fundó") ||
    msg.includes("fundadores")
  ) {

    return `
📜 San Roque fue fundado el
${sanRoque.historia.fundacion.fecha}

Fundadores:
${sanRoque.historia.fundacion.fundadores.join(" y ")}
`;
  }

  /* BUSCAR RESTAURANTE ESPECIFICO */

  const resto = buscarGastronomia(msg);

  if (resto) {
    return `
🍽️ ${resto.nombre}

📞 ${resto.whatsapp || "-"}

🕒 ${resto.horario || "-"}

📍 ${resto.direccion || "Consultar"}

${resto.celiacos ? "✅ Menú para celíacos\n" : ""}
${resto.mascotas ? "🐾 Acepta mascotas\n" : ""}
${resto.delivery ? "🛵 Delivery disponible\n" : ""}
`;
  }

  /* BUSCAR HOSPEDAJE ESPECIFICO */

  const hotel = buscarHospedaje(msg);

  if (hotel) {

    return `
🏨 ${hotel.nombre}

📞 ${
      hotel.telefono ||
      hotel.telefonos?.join(" / ")
    }

📍 ${hotel.direccion || hotel.ubicacion || "-"}

${hotel.wifi ? "📶 WiFi\n" : ""}
${hotel.cochera ? "🚗 Cochera\n" : ""}
${hotel.desayuno ? "☕ Desayuno\n" : ""}
${hotel.aire_acondicionado ? "❄️ Aire acondicionado\n" : ""}
`;
  }

  return null;
}

/* ----------------------------------
   HOME
----------------------------------- */

app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo");
});

/* ----------------------------------
   CHAT
----------------------------------- */

app.post("/chat", async (req, res) => {

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Mensaje requerido"
    });
  }

  const local = respuestaLocal(message);

  if (local) {
    return res.json({
      reply: local
    });
  }

  const contexto = `
Sos Muni Bot.

Asistente turístico oficial de San Roque, Corrientes.

Datos oficiales:

Ciudad: ${sanRoque.ciudad}
Provincia: ${sanRoque.provincia}
País: ${sanRoque.pais}

Fundación:
${sanRoque.historia.fundacion.fecha}

Fundadores:
${sanRoque.historia.fundacion.fundadores.join(", ")}

Respondé únicamente sobre San Roque.
`;

  try {

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content: contexto
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
          "HTTP-Referer":
            "https://muni-bot-production.up.railway.app",
          "X-Title":
            "Muni Bot San Roque"
        }
      }
    );

    const reply =
      response.data.choices?.[0]?.message?.content ||
      "No encontré información.";

    res.json({ reply });

  } catch (error) {

    console.log("⚠️ OpenRouter no respondió");

    res.json({
      reply:
        "No encontré información específica sobre esa consulta."
    });
  }
});

/* ----------------------------------
   START
----------------------------------- */

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Muni Bot escuchando en puerto ${PORT}`
  );
});
