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
                presentationData: {}, 
                propiedadesExtras: [], 
                files: [], 
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

            oModel.setProperty("/presentationData", presentation);

            let aProps = [];
            if (typeof presentation.PropiedadesExtras === "string" && presentation.PropiedadesExtras.trim()) {
                try {
                    const oPropsObj = JSON.parse(presentation.PropiedadesExtras);
                    aProps = Object.entries(oPropsObj).map(([key, value]) => ({ key, value }));
                } catch (e) {
                }
            }
            oModel.setProperty("/propiedadesExtras", aProps);

            const aFiles = Array.isArray(presentation.Files) ? presentation.Files : [];
            oModel.setProperty("/files", aFiles);

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
                        PRINCIPAL: !bHasPrincipal && aCurrentFiles.length === 0,
                        INFOAD: "Archivo " + file.name
                    };

                    aCurrentFiles.push(oNewFile);
                    oModel.setProperty("/files", aCurrentFiles);
                };

                oReader.readAsDataURL(file);
            });

            if (oFileUploader && oFileUploader.clear) {
                oFileUploader.clear();
            }
        },

                onRemoveFile: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("editModel");
            if (!oContext) {
                return;
            }

            const sPath = oContext.getPath(); 
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("editModel");
            const aFiles = oModel.getProperty("/files") || [];

            if (iIndex < 0 || iIndex >= aFiles.length) {
                return;
            }

            const bWasPrincipal = !!aFiles[iIndex].PRINCIPAL;

            aFiles.splice(iIndex, 1);

            if (bWasPrincipal && aFiles.length > 0) {
                aFiles[0].PRINCIPAL = true;
            }

            oModel.setProperty("/files", aFiles);
        },



        onStartUpload: function () {
            const oUploadCollection = this.byId("UploadCollection");
            const aItems = oUploadCollection.getItems();
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

            if (!oItemData.FILEID) {
                const iNewFileCount = oModel.getProperty("/newFilesCount") - 1;
                oModel.setProperty("/newFilesCount", iNewFileCount);
            } else {
                MessageToast.show(`El archivo ${oItemData.originalname} se eliminará al guardar.`);
            }
        },

        onUploadComplete: function (oEvent) {
            const oModel = this.getView().getModel("editModel");
            const sPresentationId = oModel.getProperty("/presentationId");

            const oUploadCollection = this.byId("UploadCollection");
            oUploadCollection.removeAllHeaderParameters();

            this._loadFilesForPresentation(sPresentationId);

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

    const aProps = oModel.getProperty("/propiedadesExtras") || [];
    const oProps = aProps.reduce((acc, prop) => {
        if (prop.key) {
            acc[prop.key] = prop.value;
        }
        return acc;
    }, {});

    const aFilesFromModel = oModel.getProperty("/files") || [];

    const aFilesPayload = aFilesFromModel.map(function (f) {
        const filePayload = {
            FILEID: f.FILEID,
            FILETYPE: f.FILETYPE,
            originalname: f.originalname,
            mimetype: f.mimetype,
            PRINCIPAL: f.PRINCIPAL,
            INFOAD: f.INFOAD,
            FILE: f.FILE
        };

        if (f.fileBase64 && !f.FILEID) {
            filePayload.fileBase64 = f.fileBase64;
        }

        return filePayload;
    });

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
        MessageBox.error(this.getResourceBundle().getText("editPresentationSaveError", [error.message]));
    } finally {
        oModel.setProperty("/isSubmitting", false);
    }
},


                     onNavBack: function () {
            const oModel = this.getView().getModel("editModel");
            const sSKU = oModel && oModel.getProperty("/skuid");

            if (sSKU) {
                this.getOwnerComponent().getRouter().navTo(
                    "RouteSelectPresentationToEdit",
                    { skuid: sSKU },
                    true // replace en el historial
                );
                return;
            }

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
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }

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
                
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    const mainResponse = oJson.value[0];
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        const dataResponse = mainResponse.data[0];
                        if (dataResponse.dataRes) { 
                            return dataResponse.dataRes;
                        }
                    }
                }
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0 && oJson.data[0].dataRes) {
                    return oJson.data[0].dataRes;
                }
                
                return oJson; 
                
            } catch (error) {
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        }
    });
});