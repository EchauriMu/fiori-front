sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, History, MessageBox, MessageToast) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.presentaciones.EditPresentation", {

        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("RouteEditPresentation").attachPatternMatched(this._onRouteMatched, this);

            const oEditModel = new JSONModel({
                skuid: null,
                presentationId: null,
                presentationData: {}, // Datos de la presentación (nombre, desc, activo)
                propiedadesExtras: [], // Array de {key, value}
                files: [], // Array de archivos
                newProperty: {
                    key: "",
                    value: ""
                },
                isLoading: true,
                isSubmitting: false
            });
            this.getView().setModel(oEditModel, "editModel");
        },

        _onRouteMatched: async function (oEvent) {
            const sSKU = oEvent.getParameter("arguments").skuid;
            const sPresentationId = oEvent.getParameter("arguments").presentationId;
            const oModel = this.getView().getModel("editModel");

            oModel.setProperty("/isLoading", true);
            oModel.setProperty("/skuid", sSKU);
            oModel.setProperty("/presentationId", sPresentationId);

            try {
                // CORRECTION: The backend expects all identifiers and process types
                // in the URL parameters, even for POST requests. The payload for a
                // read operation ('GetById') should be empty.
                const oPresentationData = await this._callApi(
                    '/ztproducts-presentaciones/productsPresentacionesCRUD',
                    'POST', {}, { // <-- Payload is empty
                        ProcessType: 'GetOne',
                        idpresentaok: sPresentationId
                    }
                );

                // La API con 'GetOne' devuelve un único objeto, no un array.
                // La comprobación debe ser si el objeto existe, no si el array tiene elementos.
                if (oPresentationData && typeof oPresentationData === 'object' && !Array.isArray(oPresentationData)) {
                    const presentation = oPresentationData; // Usamos el objeto directamente
                    oModel.setProperty("/presentationData", presentation);

                    // Parsear PropiedadesExtras
                    let props = [];
                    if (typeof presentation.PropiedadesExtras === 'string') {
                        try {
                            const propsObj = JSON.parse(presentation.PropiedadesExtras);
                            props = Object.entries(propsObj).map(([key, value]) => ({ key, value }));
                        } catch (e) {
                            console.warn("PropiedadesExtras no es un JSON válido:", presentation.PropiedadesExtras);
                        }
                    }
                    oModel.setProperty("/propiedadesExtras", props);

                    // Los archivos ya vienen en la respuesta
                    oModel.setProperty("/files", presentation.Files || []);
                } else {
                    throw new Error("No se encontró la presentación.");
                }

            } catch (error) {
                MessageBox.error(this.getResourceBundle().getText("editPresentationLoadError"), {
                    details: error.message
                });
            } finally {
                oModel.setProperty("/isLoading", false);
            }
        },

        onAddProperty: function () {
            const oModel = this.getView().getModel("editModel");
            const oNewProp = oModel.getProperty("/newProperty");
            if (oNewProp.key) {
                const aProps = oModel.getProperty("/propiedadesExtras");
                aProps.push({ ...oNewProp });
                oModel.setProperty("/propiedadesExtras", aProps);
                oModel.setProperty("/newProperty", { key: "", value: "" });
            }
        },

        onRemoveProperty: function (oEvent) {
            const oListItem = oEvent.getSource().getParent().getParent();
            const oCtx = oListItem.getBindingContext("editModel");
            const sPath = oCtx.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("editModel");
            const aProps = oModel.getProperty("/propiedadesExtras");
            aProps.splice(iIndex, 1);
            oModel.setProperty("/propiedadesExtras", aProps);
        },

        onFileChange: function (oEvent) {
            const oModel = this.getView().getModel("editModel");
            const aFiles = oEvent.getParameter("files");

            aFiles.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const sBase64 = e.target.result;
                    const aCurrentFiles = oModel.getProperty("/files");
                    const newFile = {
                        fileBase64: sBase64,
                        FILETYPE: file.type.startsWith('image/') ? 'IMG' : (file.type === 'application/pdf' ? 'PDF' : 'OTHER'),
                        originalname: file.name,
                        mimetype: file.type,
                        PRINCIPAL: aCurrentFiles.length === 0,
                        INFOAD: `Archivo ${file.name}`
                    };
                    aCurrentFiles.push(newFile);
                    oModel.setProperty("/files", aCurrentFiles);
                };
                reader.readAsDataURL(file);
            });
        },

        onFileDeleted: function (oEvent) {
            const oItem = oEvent.getParameter("item");
            const oCtx = oItem.getBindingContext("editModel");
            const sPath = oCtx.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("editModel");
            const aFiles = oModel.getProperty("/files");
            aFiles.splice(iIndex, 1);
            oModel.setProperty("/files", aFiles);
        },

        onSave: async function () {
            const oModel = this.getView().getModel("editModel");
            const oData = oModel.getProperty("/presentationData");
            const sPresentationId = oModel.getProperty("/presentationId");

            if (!oData.NOMBREPRESENTACION) {
                MessageBox.error("El nombre de la presentación es obligatorio.");
                return;
            }

            oModel.setProperty("/isSubmitting", true);

            // Convertir array de propiedades a objeto
            const aProps = oModel.getProperty("/propiedadesExtras");
            const oProps = aProps.reduce((acc, prop) => {
                acc[prop.key] = prop.value;
                return acc;
            }, {});

            // Se crea un payload limpio solo con los campos que se pueden modificar,
            // igual que en la implementación de React. No se debe esparcir 'oData'
            // porque contiene campos inmutables (IdPresentaOK, SKUID, etc.).
            const payload = {
                NOMBREPRESENTACION: oData.NOMBREPRESENTACION,
                Descripcion: oData.Descripcion,
                ACTIVED: oData.ACTIVED,
                PropiedadesExtras: JSON.stringify(oProps),
                files: oModel.getProperty("/files"),
                MODUSER: this.getOwnerComponent().getModel("appView").getProperty("/currentUser/USERNAME") || "SYSTEM"
            };

            try {
                await this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', payload, {
                    ProcessType: 'UpdateOne',
                    idpresentaok: sPresentationId
                });

                MessageToast.show(this.getResourceBundle().getText("editPresentationSaveSuccess"));
                this.onNavBack();

            } catch (error) {
                MessageBox.error(this.getResourceBundle().getText("editPresentationSaveError", [error.message]));
            } finally {
                oModel.setProperty("/isSubmitting", false);
            }
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

       _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {
            // 1. Añadir parámetros globales (DBServer, LoggedUser)
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }

            // 2. Construir URL con query parameters
            const sQueryString = new URLSearchParams(oParams).toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;
            
            try {
                const oResponse = await fetch(sFullUrl, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(oData || {})
                });

                if (!oResponse.ok) {
                    const oErrorJson = await oResponse.json();
                    const sErrorMessage = oErrorJson.message || `Error ${oResponse.status}`;
                    throw new Error(sErrorMessage);
                }

                const oJson = await oResponse.json();
                
                // Lógica para desenvolver la respuesta anidada de la API
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    const mainResponse = oJson.value[0];
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        const dataResponse = mainResponse.data[0];
                        if (dataResponse.dataRes) { // No necesita ser siempre un array
                            return dataResponse.dataRes;
                        }
                    }
                }
                // Estructura alternativa vista en otros controladores
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0 && oJson.data[0].dataRes) {
                    return oJson.data[0].dataRes;
                }
                
                // Devolver el JSON si no tiene la estructura anidada (para otras llamadas)
                return oJson; 
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        }
    });
});