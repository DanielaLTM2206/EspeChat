document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector("#form");
  const loginErrorMsg = document.querySelector("#login-error-message");

  // Manejar Login (Autenticación JWT)
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginErrorMsg.style.display = "none";

    const username = document.querySelector("#username").value;
    const password = document.querySelector("#password").value;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirigir al chat
        document.location.href = "/";
      } else {
        // Mostrar error de lógica en la interfaz
        loginErrorMsg.innerText = data.error?.message || "Error al iniciar sesión.";
        loginErrorMsg.style.display = "block";
        console.warn("[Login Fallido]", data.error);
      }
    } catch (err) {
      loginErrorMsg.innerText = "No se pudo conectar con el servidor.";
      loginErrorMsg.style.display = "block";
      console.error("[Login Error Red]", err);
    }
  });

  // --- Lógica del Panel de Pruebas de Sentry ---
  const statusContainer = document.querySelector("#test-status");
  const statusText = document.querySelector("#status-text");

  function updateStatus(message, isError = false) {
    statusText.innerText = message;
    if (isError) {
      statusContainer.classList.add("error-status");
    } else {
      statusContainer.classList.remove("error-status");
    }
  }

  async function triggerError(type) {
    updateStatus(`Disparando error tipo: ${type}...`);
    try {
      const response = await fetch(`/api/debug-error?type=${type}`);
      const data = await response.json();

      if (!response.ok) {
        const errorDetails = data.error || {};
        const isOperational = errorDetails.type === "operational";
        
        // Reportar en pantalla los detalles del error devueltos por Express
        const summary = `HTTP ${response.status} | [${errorDetails.type.toUpperCase()}] ${errorDetails.name}: ${errorDetails.message}`;
        updateStatus(summary, true);
        
        console.log(`%c[Sentry Test] ${summary}`, isOperational ? "color: #c62828; font-weight: bold;" : "color: #b77c00; font-weight: bold;");
      } else {
        updateStatus(`Respuesta exitosa: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      updateStatus(`Error de red al llamar a la simulación: ${err.message}`, true);
    }
  }

  // Bindings de botones del panel
  document.querySelector("#btn-logic-cred").addEventListener("click", () => triggerError("logic-credentials"));
  document.querySelector("#btn-logic-token").addEventListener("click", () => triggerError("logic-token"));
  document.querySelector("#btn-op-service").addEventListener("click", () => triggerError("operational-service"));
  document.querySelector("#btn-op-db").addEventListener("click", () => triggerError("operational-db"));
  document.querySelector("#btn-op-runtime").addEventListener("click", () => triggerError("runtime"));
});
