sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/invertions/sapfiorimodinv/model/models",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("com.invertions.sapfiorimodinv.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Modelo global para sesión y usuario
            const oAppModel = new JSONModel({
                isLoggedIn: true, // Simular que el usuario está logueado
                currentUser: {
                    USERNAME: "AMIR.DEV", // Corregido de USERID a USERNAME para coincidir con el backend
                    FULLNAME: "Amir Developer",
                    EMAIL: "amir.dev@example.com"
                },
                token: null // El token puede seguir siendo nulo, la lógica actual lo maneja
            });
            this.setModel(oAppModel, "appView");

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        },

        /**
         * Función centralizada para realizar llamadas a la API.
         * @param {string} sPath - El endpoint de la API (ej. '/ztproducts-presentaciones/productsPresentacionesCRUD').
         * @param {string} sMethod - El método HTTP (GET, POST, PUT, DELETE).
         * @param {object} [oPayload] - El cuerpo de la solicitud para POST/PUT.
         * @param {object} [oHeaders] - Cabeceras adicionales para la solicitud.
         * @param {object} [oParams] - Parámetros para la URL (query string).
         * @returns {Promise<object>} - La respuesta de la API en formato JSON.
         */
        _callApi: async function (sPath, sMethod, oPayload, oHeaders = {}, oParams = {}) {
            // La URL base de tu API. Idealmente, esto debería venir del manifest.json.
            const sBaseUrl = "http://localhost:3033/api";
            let sUrl = sBaseUrl + sPath;

            // Construir la query string a partir de los parámetros
            const sQueryString = new URLSearchParams(oParams).toString();
            if (sQueryString) {
                sUrl += `?${sQueryString}`;
            }

            const oHeadersToSend = {
                'Content-Type': 'application/json',
                ...oHeaders
            };
            
            // Añadir token de autorización solo si existe
            const sToken = this.getModel("appView")?.getProperty("/token");
            if (sToken) {
                oHeadersToSend['Authorization'] = `Bearer ${sToken}`;
            }

            const oOptions = {
                method: sMethod.toUpperCase(),
                headers: oHeadersToSend
            };

            if (oPayload && (sMethod.toUpperCase() === 'POST' || sMethod.toUpperCase() === 'PUT')) {
                oOptions.body = JSON.stringify(oPayload);
            }

            try {
                const oResponse = await fetch(sUrl, oOptions);

                if (!oResponse.ok) {
                    const errorData = await oResponse.json().catch(() => ({ message: oResponse.statusText }));
                    const sErrorMessage = errorData?.error?.message || errorData?.messageDEV || errorData?.messageUSR || `Error de red: ${oResponse.status}`;
                    throw new Error(sErrorMessage);
                }

                if (oResponse.status === 204) { // No Content
                    return {};
                }

                return await oResponse.json();
            } catch (oError) {
                console.error("Error en _callApi:", oError);
                throw oError; // Re-lanza el error para que el controlador que llama pueda manejarlo.
            }
        }

        // Helper para obtener el usuario actual
        // getCurrentUser: function() {
        //     return this.getModel("appView").getProperty("/currentUser");
        // }

    });
});