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
    oModel.setProperty("/newFilesCount", 0);

    try {
        const oPresentationData = await this._callApi(
            '/ztproducts-presentaciones/productsPresentacionesCRUD',
            'POST',
            {},
            {
                ProcessType: 'GetOne',
                idpresentaok: sPresentationId
            }
        );

        if (oPresentationData && typeof oPresentationData === "object" && !Array.isArray(oPresentationData)) {
            const presentation = oPresentationData;

            // Datos base de la presentación
            oModel.setProperty("/presentationData", presentation);

            // ---- Propiedades Extras: string JSON -> array {key,value} ----
            let aProps = [];
            if (typeof presentation.PropiedadesExtras === "string" && presentation.PropiedadesExtras.trim()) {
                try {
                    const oPropsObj = JSON.parse(presentation.PropiedadesExtras);
                    aProps = Object.entries(oPropsObj).map(([key, value]) => ({ key, value }));
                } catch (e) {
                    console.warn("PropiedadesExtras no es un JSON válido:", presentation.PropiedadesExtras);
                }
            }
            oModel.setProperty("/propiedadesExtras", aProps);

            // ---- Archivos: usar lo que ya devuelve el backend en Files (como React) ----
            const aFiles = Array.isArray(presentation.Files) ? presentation.Files : [];
            oModel.setProperty("/files", aFiles);

            // (Opcional) si quieres seguir refrescando tras subir, _loadFilesForPresentation
            // se usará sólo después de upload, no en el load inicial.
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
            '/ztproducts-files/productsFilesCRUD',
            'POST',
            {},
            {
                ProcessType: 'GetByIdPresentaOK',
                idPresentaOK: sPresentationId
            }
        );

        if (Array.isArray(aFiles)) {
            oModel.setProperty("/files", aFiles);
        }
    } catch (error) {
        console.error("Error al cargar archivos:", error);
        // No bloqueamos la edición si falla esto
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
            const oFileUploader = oEvent.getSource();
            const aFiles = Array.from(oEvent.getParameter("files") || []);

            aFiles.forEach(function (file) {
                const oReader = new FileReader();

                oReader.onload = function (e) {
                    const sFullBase64String = e.target.result;
                    const aCurrentFiles = oModel.getProperty("/files") || [];

                    const bHasPrincipal = aCurrentFiles.some(function (f) {
                        return f.PRINCIPAL;
                    });

                    let sFileType;
                    if (file.type && file.type.startsWith("image/")) {
                        sFileType = "IMG";
                    } else if (file.type === "application/pdf") {
                        sFileType = "PDF";
                    } else if (file.type && file.type.startsWith("video/")) {
                        sFileType = "VID";
                    } else {
                        sFileType = "OTHER";
                    }

                    const oNewFile = {
                        fileBase64: sFullBase64String,
                        FILETYPE: sFileType,
                        originalname: file.name,
                        mimetype: file.type,
                        // si todavía no hay principal, el primer archivo se marca principal
                        PRINCIPAL: !bHasPrincipal && aCurrentFiles.length === 0,
                        INFOAD: "Archivo " + file.name
                    };

                    aCurrentFiles.push(oNewFile);
                    oModel.setProperty("/files", aCurrentFiles);
                };

                oReader.readAsDataURL(file);
            });

            // limpiar el FileUploader para poder seleccionar el mismo archivo de nuevo
            if (oFileUploader && oFileUploader.clear) {
                oFileUploader.clear();
            }
        },

                onRemoveFile: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("editModel");
            if (!oContext) {
                return;
            }

            const sPath = oContext.getPath(); // p.ej. "/files/0"
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("editModel");
            const aFiles = oModel.getProperty("/files") || [];

            if (iIndex < 0 || iIndex >= aFiles.length) {
                return;
            }

            const bWasPrincipal = !!aFiles[iIndex].PRINCIPAL;

            // Quitamos el archivo del arreglo (igual que en React: ya no se envía en el payload)
            aFiles.splice(iIndex, 1);

            // Si borramos el principal y quedan archivos, el primero pasa a ser principal
            if (bWasPrincipal && aFiles.length > 0) {
                aFiles[0].PRINCIPAL = true;
            }

            oModel.setProperty("/files", aFiles);
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

    // ---- 1. Propiedades Extras: array -> objeto -> string JSON (como React) ----
    const aProps = oModel.getProperty("/propiedadesExtras") || [];
    const oProps = aProps.reduce((acc, prop) => {
        if (prop.key) {
            acc[prop.key] = prop.value;
        }
        return acc;
    }, {});

    // ---- 2. Archivos: normalizar estructura (similar al front en React) ----
    const aFilesFromModel = oModel.getProperty("/files") || [];

    const aFilesPayload = aFilesFromModel.map(function (f) {
        // Copia limpia sólo con los campos relevantes
        const filePayload = {
            FILEID: f.FILEID,
            FILETYPE: f.FILETYPE,
            originalname: f.originalname,
            mimetype: f.mimetype,
            PRINCIPAL: f.PRINCIPAL,
            INFOAD: f.INFOAD,
            FILE: f.FILE
        };

        // Si por alguna razón hay archivos nuevos con base64 y sin FILEID, los mandamos
        if (f.fileBase64 && !f.FILEID) {
            filePayload.fileBase64 = f.fileBase64;
        }

        return filePayload;
    });

    // ---- 3. Payload final, igual que updatedData en React ----
    const payload = {
        NOMBREPRESENTACION: oData.NOMBREPRESENTACION,
        Descripcion: oData.Descripcion,
        ACTIVED: !!oData.ACTIVED,
        PropiedadesExtras: JSON.stringify(oProps),
        files: aFilesPayload,
        MODUSER: this.getOwnerComponent()
                    .getModel("appView")
                    .getProperty("/currentUser/USERNAME") || "SYSTEM"
    };

    console.log("Payload UpdateOne que se envía:", payload);

    try {
        await this._callApi(
            '/ztproducts-presentaciones/productsPresentacionesCRUD',
            'POST',
            payload,
            {
                ProcessType: 'UpdateOne',
                idpresentaok: sPresentationId
            }
        );

        MessageToast.show(this.getResourceBundle().getText("editPresentationSaveSuccess"));
        this.onNavBack();

    } catch (error) {
        // Aquí verás el mensaje que viene del backend si trae "message"
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