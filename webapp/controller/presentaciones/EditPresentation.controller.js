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
                isSubmitting: false,
                newFilesCount: 0
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
            oModel.setProperty("/newFilesCount", 0); // Reset counter on route match

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

                    // Cargar archivos por separado para evitar problemas de binding
                    this._loadFilesForPresentation(sPresentationId);
                } else {
                    throw new Error("No se encontró la presentación o la respuesta de la API no es válida.");
                }

            } catch (error) {
                MessageBox.error(this.getResourceBundle().getText("editPresentationLoadError"), {
                    details: error.message
                });
            } finally {
                oModel.setProperty("/isLoading", false);
            }
        },

        _loadFilesForPresentation: async function (sPresentationId) {
            const oModel = this.getView().getModel("editModel");
            try {
                const aFiles = await this._callApi(
                    '/ztpresentaciones-archivos/presentacionesArchivosCRUD',
                    'POST', {}, {
                        ProcessType: 'GetByIdPresentaOK',
                        idpresentaok: sPresentationId
                    }
                );

                if (Array.isArray(aFiles)) {
                    oModel.setProperty("/files", aFiles);
                }
            } catch (error) {
                // No mostrar un error bloqueante, solo en consola, para no interrumpir la edición.
                console.error("Error al cargar archivos de la presentación:", error);
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
            const oUploadCollection = this.byId("UploadCollection");
            const aCustomerFiles = oEvent.getParameter("files");

            // Añadir cabeceras necesarias para la subida
            const dbServer = sessionStorage.getItem('DBServer');
            const loggedUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');

            oUploadCollection.addHeaderParameter(new sap.ui.core.Item({
                key: "x-file-info", // El backend debe leer esta cabecera
                text: JSON.stringify({
                    idpresentaok: oModel.getProperty("/presentationId"),
                    MODUSER: loggedUser,
                    DBServer: dbServer
                })
            }));

            // Actualizar el contador de archivos nuevos
            const iNewFileCount = oModel.getProperty("/newFilesCount") + aCustomerFiles.length;
            oModel.setProperty("/newFilesCount", iNewFileCount);
        },

        onStartUpload: function () {
            const oUploadCollection = this.byId("UploadCollection");
            const aItems = oUploadCollection.getItems();
            // Solo subir si hay archivos nuevos pendientes
            if (this.getView().getModel("editModel").getProperty("/newFilesCount") > 0) {
                oUploadCollection.upload();
            } else {
                MessageToast.show("No hay archivos nuevos para subir.");
            }
        },

        onFileDeleted: function (oEvent) {
            const oModel = this.getView().getModel("editModel");
            const oItem = oEvent.getParameter("item");
            const oItemData = oItem.getBindingContext("editModel").getObject();

            // Si el archivo no tiene FILEID, es un archivo nuevo que se está eliminando de la cola de subida.
            if (!oItemData.FILEID) {
                const iNewFileCount = oModel.getProperty("/newFilesCount") - 1;
                oModel.setProperty("/newFilesCount", iNewFileCount);
            } else {
                // Si tiene FILEID, es un archivo existente que se debe borrar del servidor.
                // Aquí iría la lógica para llamar a la API y borrar el archivo del backend.
                // Por ahora, solo lo quitamos de la vista.
                MessageToast.show(`El archivo ${oItemData.originalname} se eliminará al guardar.`);
            }
        },

        onUploadComplete: function (oEvent) {
            const oModel = this.getView().getModel("editModel");
            const sPresentationId = oModel.getProperty("/presentationId");

            // Limpiar cabeceras para la próxima subida
            const oUploadCollection = this.byId("UploadCollection");
            oUploadCollection.removeAllHeaderParameters();

            // Refrescar la lista de archivos desde el backend
            this._loadFilesForPresentation(sPresentationId);

            // Reiniciar el contador de archivos nuevos
            oModel.setProperty("/newFilesCount", 0);

            MessageToast.show("Archivos subidos correctamente.");
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