import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

// Configuración de CORS para permitir peticiones desde cualquier lugar
app.use(cors());
app.use(express.json());

// 🌐 Ruta de prueba
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo. Usá POST /chat");
});

// 💬 Chat endpoint
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  // 1. Validar que llegue un mensaje
  if (!message) {
    return res.status(400).json({ error: "El campo 'message' es obligatorio" });
  }

  try {
    console.log("Procesando mensaje:", message);

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          {
            role: "system",
            content: "Sos un guía turístico de San Roque, Corrientes. Respondé claro, útil y corto."
          },
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000 // Timeout de 10 segundos para no colgar el servidor
      }
    );

    // 2. Respuesta exitosa
    const reply = response.data.choices[0].message.content;
    res.json({ reply: reply });

  } catch (err) {
    // 3. Log detallado del error en Railway
    console.error("❌ Error en la API de OpenRouter:");
    if (err.response) {
      console.error("Data:", err.response.data);
      console.error("Status:", err.response.status);
    } else {
      console.error("Mensaje:", err.message);
    }

    // 4. Devolver error estructurado para que el frontend entienda
    res.status(500).json({ 
      error: "Error al consultar la IA. Revisa los logs de Railway.",
      details: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Bot online en puerto " + PORT);
});
