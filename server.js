import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// 🌐 Ruta principal (IMPORTANTE)
app.get("/", (req, res) => {
  res.send("🤖 Muni Bot activo. Usá POST /chat");
});

// 💬 Chat endpoint
app.post("/chat", async (req, res) => {
  const message = req.body.message;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          {
            role: "system",
            content:
              "Sos un guía turístico de San Roque Corrientes. Respondes claro, útil y corto."
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
        }
      }
    );

    res.json({
      reply: response.data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: "Error en el bot" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Bot online en puerto " + PORT);
});
