sap.ui.define([
    "sap/base/Log",
    "sap/ui/thirdparty/jquery"
], function (Log, jQuery) {
    "use strict";

    /**
     * Servicio para gestionar las operaciones de promociones
     */
    var PromotionsService = {

        // URL base de la API (configurar según tu entorno)
        _baseURL: "https://ccnayt.dnsalias.com:9101", // De BaseController.js

        /**
         * Obtener todas las promociones
         * @returns {Promise<Array>} Array de promociones
         */
        getAllPromotions: function () {
            return new Promise((resolve, reject) => {
                // Configurar la llamada AJAX
                jQuery.ajax({
                    url: this._baseURL + "/api/promociones", // Ajustar endpoint según tu API
                    type: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        // Agregar headers de autenticación si es necesario
                        // "Authorization": "Bearer " + this._getAuthToken()
                    },
                    success: function (data) {
                        Log.info("Promociones obtenidas exitosamente", data);
                        
                        // Procesar respuesta de la API
                        var aPromotions = this._extractPromotionsFromResponse(data);
                        resolve(aPromotions);
                    }.bind(this),
                    error: function (xhr, status, error) {
                        Log.error("Error al obtener promociones", {
                            status: status,
                            error: error,
                            response: xhr.responseText
                        });
                        
                        var sErrorMessage = this._parseErrorMessage(xhr);
                        reject(new Error(sErrorMessage));
                    }.bind(this)
                });
            });
        },

        /**
         * Obtener promoción por ID
         * @param {string} sPromotionId - ID de la promoción
         * @returns {Promise<Object>} Datos de la promoción
         */
        getPromotionById: function (sPromotionId) {
            return new Promise((resolve, reject) => {
                if (!sPromotionId) {
                    reject(new Error("ID de promoción requerido"));
                    return;
                }

                jQuery.ajax({
                    url: this._baseURL + "/api/promociones/" + encodeURIComponent(sPromotionId),
                    type: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    success: function (data) {
                        Log.info("Promoción obtenida exitosamente", data);
                        resolve(data);
                    },
                    error: function (xhr, status, error) {
                        Log.error("Error al obtener promoción", {
                            promotionId: sPromotionId,
                            status: status,
                            error: error
                        });
                        
                        var sErrorMessage = this._parseErrorMessage(xhr);
                        reject(new Error(sErrorMessage));
                    }.bind(this)
                });
            });
        },

        /**
         * Crear nueva promoción
         * @param {Object} oPromotionData - Datos de la promoción
         * @returns {Promise<Object>} Promoción creada
         */
        createPromotion: function (oPromotionData) {
            return new Promise((resolve, reject) => {
                if (!oPromotionData || !oPromotionData.Titulo) {
                    reject(new Error("Datos de promoción inválidos"));
                    return;
                }

                jQuery.ajax({
                    url: this._baseURL + "/api/promociones",
                    type: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    data: JSON.stringify(oPromotionData),
                    success: function (data) {
                        Log.info("Promoción creada exitosamente", data);
                        resolve(data);
                    },
                    error: function (xhr, status, error) {
                        Log.error("Error al crear promoción", {
                            status: status,
                            error: error,
                            data: oPromotionData
                        });
                        
                        var sErrorMessage = this._parseErrorMessage(xhr);
                        reject(new Error(sErrorMessage));
                    }.bind(this)
                });
            });
        },

        /**
         * Actualizar promoción existente
         * @param {string} sPromotionId - ID de la promoción
         * @param {Object} oPromotionData - Datos actualizados
         * @returns {Promise<Object>} Promoción actualizada
         */
        updatePromotion: function (sPromotionId, oPromotionData) {
            return new Promise((resolve, reject) => {
                if (!sPromotionId || !oPromotionData) {
                    reject(new Error("ID y datos de promoción requeridos"));
                    return;
                }

                jQuery.ajax({
                    url: this._baseURL + "/api/promociones/" + encodeURIComponent(sPromotionId),
                    type: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    data: JSON.stringify(oPromotionData),
                    success: function (data) {
                        Log.info("Promoción actualizada exitosamente", data);
                        resolve(data);
                    },
                    error: function (xhr, status, error) {
                        Log.error("Error al actualizar promoción", {
                            promotionId: sPromotionId,
                            status: status,
                            error: error
                        });
                        
                        var sErrorMessage = this._parseErrorMessage(xhr);
                        reject(new Error(sErrorMessage));
                    }.bind(this)
                });
            });
        },

        /**
         * Eliminar promoción (eliminación lógica)
         * @param {string} sPromotionId - ID de la promoción
         * @returns {Promise<Object>} Resultado de la operación
         */
        deletePromotion: function (sPromotionId) {
            return new Promise((resolve, reject) => {
                if (!sPromotionId) {
                    reject(new Error("ID de promoción requerido"));
                    return;
                }

                // Eliminación lógica - marcar como DELETED: true
                this.updatePromotion(sPromotionId, { 
                    DELETED: true,
                    ACTIVED: false 
                })
                .then(resolve)
                .catch(reject);
            });
        },

        /**
         * Activar/Reactivar promoción
         * @param {string} sPromotionId - ID de la promoción
         * @returns {Promise<Object>} Resultado de la operación
         */
        activatePromotion: function (sPromotionId) {
            return new Promise((resolve, reject) => {
                if (!sPromotionId) {
                    reject(new Error("ID de promoción requerido"));
                    return;
                }

                this.updatePromotion(sPromotionId, { 
                    ACTIVED: true,
                    DELETED: false 
                })
                .then(resolve)
                .catch(reject);
            });
        },

        /**
         * Desactivar promoción
         * @param {string} sPromotionId - ID de la promoción
         * @returns {Promise<Object>} Resultado de la operación
         */
        deactivatePromotion: function (sPromotionId) {
            return new Promise((resolve, reject) => {
                if (!sPromotionId) {
                    reject(new Error("ID de promoción requerido"));
                    return;
                }

                this.updatePromotion(sPromotionId, { 
                    ACTIVED: false 
                })
                .then(resolve)
                .catch(reject);
            });
        },

        /**
         * Obtener promociones activas
         * @returns {Promise<Array>} Array de promociones activas
         */
        getActivePromotions: function () {
            return new Promise((resolve, reject) => {
                this.getAllPromotions()
                    .then(function (aPromotions) {
                        var aActivePromotions = aPromotions.filter(function (oPromotion) {
                            return this._isPromotionCurrentlyActive(oPromotion);
                        }.bind(this));
                        
                        resolve(aActivePromotions);
                    }.bind(this))
                    .catch(reject);
            });
        },

        /**
         * Extraer promociones de la respuesta de la API
         * @private
         */
        _extractPromotionsFromResponse: function (oResponse) {
            // Manejar diferentes estructuras de respuesta como en el JSX original
            var aPromotions = [];

            if (oResponse?.data?.[0]?.dataRes) {
                aPromotions = oResponse.data[0].dataRes;
            } else if (oResponse?.value?.[0]?.data?.[0]?.dataRes) {
                aPromotions = oResponse.value[0].data[0].dataRes;
            } else if (Array.isArray(oResponse?.data)) {
                aPromotions = oResponse.data;
            } else if (Array.isArray(oResponse)) {
                aPromotions = oResponse;
            } else if (Array.isArray(oResponse?.dataRes)) {
                aPromotions = oResponse.dataRes;
            }

            // Filtrar promociones válidas
            return Array.isArray(aPromotions) ? aPromotions.filter(function (oPromotion) {
                return oPromotion && oPromotion.IdPromoOK;
            }) : [];
        },

        /**
         * Verificar si una promoción está actualmente activa
         * @private
         */
        _isPromotionCurrentlyActive: function (oPromotion) {
            var oNow = new Date();
            var oStartDate = new Date(oPromotion.FechaIni);
            var oEndDate = new Date(oPromotion.FechaFin);
            
            return oPromotion.ACTIVED === true && 
                   oNow >= oStartDate && 
                   oNow <= oEndDate && 
                   oPromotion.DELETED !== true;
        },

        /**
         * Parsear mensaje de error de la respuesta
         * @private
         */
        _parseErrorMessage: function (xhr) {
            var sMessage = "Error desconocido";
            
            try {
                if (xhr.responseText) {
                    var oError = JSON.parse(xhr.responseText);
                    sMessage = oError.message || oError.error || sMessage;
                }
            } catch (e) {
                sMessage = xhr.statusText || sMessage;
            }
            
            return `Error ${xhr.status}: ${sMessage}`;
        },

        /**
         * Obtener token de autenticación (implementar según tu sistema)
         * @private
         */
        _getAuthToken: function () {
            // Implementar lógica de obtención de token
            return sessionStorage.getItem("authToken") || "";
        }
    };

    return PromotionsService;
});