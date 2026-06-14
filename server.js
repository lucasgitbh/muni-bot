import express from "express";
import cors from "cors";
import axios from "axios";
import axiosRetry from "axios-retry";

const app = express();

// Configuración de reintento automático: Si recibe error 429, espera e intenta de nuevo
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 2000, // Espera 2s, 4s, 6s...
  retryCondition: (error) => error.response?.status === 429
});

app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo (Gemma 4).");
});

// Endpoint de Chat
app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "El mensaje es obligatorio" });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        // Modelo seleccionado: Gemma 4 31B
        model: "google/gemma-4-31b-it:free",
        messages: [
          {
            role: "system",
            content: "Sos un guía turístico experto de San Roque, Corrientes. Respondé de forma amable, clara y precisa sobre historia, lugares y eventos locales. Si no tienes un dato, sé honesto."
          },
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://muni-bot-production.up.railway.app", // Recomendado por OpenRouter
          "X-Title": "Muni Bot San Roque" // Recomendado por OpenRouter
        },
        timeout: 15000 // 15 segundos máximo
      }
    );

    res.json({ reply: response.data.choices[0].message.content });

  } catch (err) {
    console.error("❌ Error en el bot:", err.response?.data || err.message);
    
    res.status(500).json({ 
      error: "El bot está descansando un momento, intenta en unos segundos." 
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Bot online en puerto " + PORT);
});
