sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageBox, MessageToast, History) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.presentaciones.AddPresentation", {

        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("RouteAddPresentation").attachPatternMatched(this._onRouteMatched, this);

            const oPresentationModel = new JSONModel({
                productSKU: "",
                productName: "",
                IdPresentaOK: "",
                NOMBREPRESENTACION: "",
                Descripcion: "",
                ACTIVED: true,
                extraProperties: [],
                newPropKey: "",
                newPropValue: "",
                files: [],
                isSubmitting: false
            });
            this.getView().setModel(oPresentationModel, "presentationModel");
        },

        _onRouteMatched: function (oEvent) {
            const sSKUID = oEvent.getParameter("arguments").skuid;
            const oPresentationModel = this.getView().getModel("presentationModel");

            oPresentationModel.setData({
                productSKU: sSKUID,
                productName: sSKUID, 
                IdPresentaOK: "",
                NOMBREPRESENTACION: "",
                Descripcion: "",
                ACTIVED: true,
                extraProperties: [],
                newPropKey: "",
                newPropValue: "",
                files: [],
                isSubmitting: false
            });
        },

        onNameChange: function (oEvent) {
            const sName = oEvent.getParameter("value");
            const oModel = this.getView().getModel("presentationModel");
            const sSKU = oModel.getProperty("/productSKU");

            if (sName && sSKU) {
                const sPresentationSlug = sName
                    .trim()
                    .toUpperCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
                    .replace(/\s+/g, '-') 
                    .replace(/[^A-Z0-9-]/g, ''); 

                const sGeneratedId = `${sSKU}-${sPresentationSlug}`;
                oModel.setProperty("/IdPresentaOK", sGeneratedId);
            } else {
                oModel.setProperty("/IdPresentaOK", "");
            }
        },

        onAddProperty: function () {
            const oModel = this.getView().getModel("presentationModel");
            const sKey = oModel.getProperty("/newPropKey");
            const sValue = oModel.getProperty("/newPropValue");

            if (sKey) {
                const aProperties = oModel.getProperty("/extraProperties");
                
                const bKeyExists = aProperties.some(prop => prop.key.toUpperCase() === sKey.toUpperCase());
                
                if (bKeyExists) {
                     MessageToast.show(`La propiedad "${sKey}" ya existe.`);
                     return;
                }

                aProperties.push({ key: sKey, value: sValue });
                oModel.setProperty("/extraProperties", aProperties);
                oModel.setProperty("/newPropKey", "");
                oModel.setProperty("/newPropValue", "");
            }
        },

        onRemoveProperty: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("presentationModel");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.substring(sPath.lastIndexOf('/') + 1));

            const oModel = this.getView().getModel("presentationModel");
            const aProperties = oModel.getProperty("/extraProperties");
            aProperties.splice(iIndex, 1);
            oModel.refresh(true);
        },

        onFileChange: function (oEvent) {
            const oModel = this.getView().getModel("presentationModel");
            const oFileUploader = this.getView().byId("addPresentationPage").getContent()[0].getContent().find(control => control instanceof sap.ui.unified.FileUploader);
            const aFiles = Array.from(oEvent.getParameter("files"));

            aFiles.forEach(file => {
                const oReader = new FileReader();
                oReader.onload = (e) => {
                    const sFullBase64String = e.target.result;
                    const aCurrentFiles = oModel.getProperty("/files");
                    
                    let sFileType;
                    if (file.type.startsWith('image/')) {
                        sFileType = 'IMG';
                    } else if (file.type === 'application/pdf') {
                        sFileType = 'PDF';
                    } else if (file.type.startsWith('video/')) {
                        sFileType = 'VID'; 
                    } else {
                        sFileType = 'OTHER';
                    }

                    const oNewFile = {
                        fileBase64: sFullBase64String, // String Base64 completo
                        FILETYPE: sFileType,
                        originalname: file.name,
                        mimetype: file.type,
                        PRINCIPAL: aCurrentFiles.length === 0, 
                        INFOAD: `Archivo ${file.name}`
                    };
                    aCurrentFiles.push(oNewFile);
                    oModel.refresh(true);
                };
                oReader.readAsDataURL(file);
            });
            
            if (oFileUploader) {
                oFileUploader.clear();
            }
        },

        onRemoveFile: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("presentationModel");
            const iIndex = parseInt(oContext.getPath().split('/').pop());
            const oModel = this.getView().getModel("presentationModel");
            const aFiles = oModel.getProperty("/files");
            
            const bWasPrincipal = aFiles[iIndex].PRINCIPAL;
            
            aFiles.splice(iIndex, 1);
            
            if (bWasPrincipal && aFiles.length > 0) {
                aFiles[0].PRINCIPAL = true;
            }

            oModel.refresh(true);
        },

        onSubmit: async function () {
            const oModel = this.getView().getModel("presentationModel");
            const oData = oModel.getData();

            if (!oData.IdPresentaOK || !oData.NOMBREPRESENTACION || !oData.Descripcion) {
                MessageBox.error("Por favor, complete todos los campos obligatorios (Nombre y Descripción).");
                return;
            }

            oModel.setProperty("/isSubmitting", true);

            const oPropertiesObject = oData.extraProperties.reduce((obj, item) => {
                obj[item.key] = item.value;
                return obj;
            }, {});

            const aFilesPayload = oData.files.map(file => ({
                fileBase64: file.fileBase64,
                FILETYPE: file.FILETYPE,
                PRINCIPAL: file.PRINCIPAL,
                INFOAD: file.INFOAD,
                originalname: file.originalname,
                mimetype: file.mimetype
            }));
            
            const oCurrentUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");

            const oPayload = {
                IdPresentaOK: oData.IdPresentaOK,
                SKUID: oData.productSKU,
                NOMBREPRESENTACION: oData.NOMBREPRESENTACION,
                Descripcion: oData.Descripcion,
                ACTIVED: oData.ACTIVED,
                PropiedadesExtras: JSON.stringify(oPropertiesObject),
                files: aFilesPayload
            };

            try {
                await this.getOwnerComponent()._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', oPayload, null, {
                    ProcessType: 'AddOne',
                    DBServer: 'MongoDB',
                    LoggedUser: oCurrentUser.USERNAME 
                });

                MessageToast.show("Presentación creada correctamente.");
                this.onNavBack();

            } catch (oError) {
                const sErrorMessage = oError.message || "Un error desconocido ha ocurrido.";
                MessageBox.error(`Error al crear la presentación: ${sErrorMessage}`);
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
        }
    });
});