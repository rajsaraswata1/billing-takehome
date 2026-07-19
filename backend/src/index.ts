import { createApp } from "./server.js";

const PORT = Number(process.env.PORT) || 3001;

const app = createApp();
app.listen(PORT, () => {
  console.log(`Fleksa billing backend listening on http://localhost:${PORT}`);
});
