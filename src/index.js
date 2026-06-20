require("./instrument");
const express = require("express");
const { createServer } = require("http");
const Sentry = require("@sentry/node");
const realTimeServer = require("./realTimeServer");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();
const httpServer = createServer(app);

app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "views"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(require("./routes"));

app.use(express.static(path.join(__dirname, "public")));

app.get("/debug-sentry", (req, res) => {
  throw new Error("Prueba Sentry: Error intencional en el backend ");

});

Sentry.setupExpressErrorHandler(app);

// Manejador global de errores personalizado para formatear respuestas JSON
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational !== false;

  res.status(statusCode).json({
    success: false,
    error: {
      name: err.name || 'Error',
      message: err.message || 'Error interno del servidor',
      type: isOperational ? 'operational' : 'logic',
      statusCode
    }
  });
});

httpServer.listen(app.get("port"), () => {
  console.log("La aplicación esta corriendo en el puerto ", app.get("port"));
});

realTimeServer(httpServer);
