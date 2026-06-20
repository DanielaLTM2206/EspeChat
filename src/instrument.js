require("dotenv").config();
const Sentry = require("@sentry/node");
const pkg = require("../package.json");

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || "EspeChat@${pkg.version}",
    tracesSampleRate: 0,
    sampleRate: 1.0, //100% errores
    sendDefaultPii: false,
    enabled: Boolean(process.env.SENTRY_DSN),
    beforeSend(event, hint) {
        const originalError = hint ? hint.originalException : null;
        event.tags = event.tags || {};

        if (originalError) {
            // Clasificación de error lógico vs operacional
            const isLogic = originalError.isOperational === false || 
                            originalError.name === 'LogicError' || 
                            originalError.name === 'ValidationError' || 
                            originalError.name === 'InvalidCredentialsError' || 
                            originalError.name === 'TokenExpiredError';

            if (isLogic) {
                event.tags.error_type = "logic";
                event.tags.is_operational = "false";
                event.level = "warning";
            } else {
                event.tags.error_type = "operational";
                event.tags.is_operational = "true";
                event.level = "error";
            }

            event.extra = event.extra || {};
            event.extra.statusCode = originalError.statusCode || (isLogic ? 400 : 500);
            event.extra.errorName = originalError.name || originalError.constructor.name;
        } else {
            // Sin excepción original, clasificar como operacional/técnico por defecto
            event.tags.error_type = "operational";
            event.tags.is_operational = "true";
            event.level = "error";
        }

        // Limpiar cookies por privacidad (PII)
        if (event.request) {
            if (event.request.headers && event.request.headers.cookie) {
                delete event.request.headers.cookie;
            }
            if (event.request.cookies) {
                delete event.request.cookies;
            }
        }

        return event;
    }




});
