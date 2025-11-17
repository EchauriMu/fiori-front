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

            // Modelo para la vista de añadir presentación
            const oPresentationModel = new JSONModel({
                productSKU: "",
                productName: "",
                IdPresentaOK: "",
                NOMBREPRESENTACION: "",
                Descripcion: "",
                ACTIVED: true,
                // Para manejar propiedades extras
                extraProperties: [],
                newPropKey: "",
                newPropValue: "",
                // Para manejar archivos
                files: [],
                // Estado de la UI
                isSubmitting: false
            });
            this.getView().setModel(oPresentationModel, "presentationModel");
        },

        _onRouteMatched: function (oEvent) {
            const sSKUID = oEvent.getParameter("arguments").skuid;
            const oPresentationModel = this.getView().getModel("presentationModel");

            // Resetear el modelo cada vez que se entra a la vista
            oPresentationModel.setData({
                productSKU: sSKUID,
                productName: sSKUID, // Placeholder, idealmente se buscaría el nombre
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
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Limpia acentos y caracteres especiales (añadido para robustez)
                    .replace(/\s+/g, '-') // Reemplaza espacios con guiones
                    .replace(/[^A-Z0-9-]/g, ''); // Elimina caracteres no alfanuméricos excepto guiones

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
                
                // Comprobar si la clave ya existe
                const bKeyExists = aProperties.some(prop => prop.key.toUpperCase() === sKey.toUpperCase());
                
                if (bKeyExists) {
                     MessageToast.show(`La propiedad "${sKey}" ya existe.`);
                     return;
                }

                aProperties.push({ key: sKey, value: sValue });
                oModel.setProperty("/extraProperties", aProperties);
                // Limpiar inputs
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
            // Obtener la FileUploader para resetearla visualmente después de la carga
            const oFileUploader = this.getView().byId("addPresentationPage").getContent()[0].getContent().find(control => control instanceof sap.ui.unified.FileUploader);
            const aFiles = Array.from(oEvent.getParameter("files"));

            aFiles.forEach(file => {
                const oReader = new FileReader();
                oReader.onload = (e) => {
                    // Solo guardar la porción Base64 después del encabezado
                    const sBase64String = e.target.result.split(',')[1]; 
                    const aCurrentFiles = oModel.getProperty("/files");
                    
                    // Determinar el FILETYPE
                    let sFileType;
                    if (file.type.startsWith('image/')) {
                        sFileType = 'IMG';
                    } else if (file.type === 'application/pdf') {
                        sFileType = 'PDF';
                    } else if (file.type.startsWith('video/')) {
                        sFileType = 'VID'; // Añadido soporte para video
                    } else {
                        sFileType = 'OTHER';
                    }

                    const oNewFile = {
                        fileBase64: sBase64String, // Solo el contenido Base64
                        FILETYPE: sFileType,
                        originalname: file.name,
                        mimetype: file.type,
                        // El primero es principal si no hay ninguno
                        PRINCIPAL: aCurrentFiles.length === 0, 
                        INFOAD: `Archivo ${file.name}`
                    };
                    aCurrentFiles.push(oNewFile);
                    oModel.refresh(true);
                };
                oReader.readAsDataURL(file);
            });
            
            // Limpiar el control FileUploader para poder subir el mismo archivo de nuevo
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
            
            // Si eliminamos el principal, hacemos que el nuevo primer archivo sea principal
            if (bWasPrincipal && aFiles.length > 0) {
                aFiles[0].PRINCIPAL = true;
            }

            oModel.refresh(true);
        },

        onSubmit: async function () {
            const oModel = this.getView().getModel("presentationModel");
            const oData = oModel.getData();

            // --- Validación ---
            if (!oData.IdPresentaOK || !oData.NOMBREPRESENTACION || !oData.Descripcion) {
                MessageBox.error("Por favor, complete todos los campos obligatorios (Nombre y Descripción).");
                return;
            }

            oModel.setProperty("/isSubmitting", true);

            // --- Construir Payload ---
            const oPropertiesObject = oData.extraProperties.reduce((obj, item) => {
                obj[item.key] = item.value;
                return obj;
            }, {});

            // Mapear archivos: eliminar 'originalname' y 'mimetype' que no son necesarios para el backend
            const aFilesPayload = oData.files.map(file => ({
                fileBase64: file.fileBase64,
                FILETYPE: file.FILETYPE,
                PRINCIPAL: file.PRINCIPAL,
                INFOAD: file.INFOAD
            }));
            
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
                // Asumiendo que esta función está disponible en tu componente principal
                const oMainController = this.getOwnerComponent().getRootViewController();
                await oMainController._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', oPayload, {
                    ProcessType: 'AddOne'
                });

                MessageToast.show("Presentación creada correctamente.");
                this.onNavBack();

            } catch (oError) {
                // Manejo de errores más específico
                const sErrorMessage = oError.message || "Un error desconocido ha ocurrido.";
                MessageBox.error(`Error al crear la presentación: ${sErrorMessage}`);
            } finally {
                oModel.setProperty("/isSubmitting", false);
            }
        },

        onNavBack: function () {
            // Usar el historial para volver a la pantalla anterior
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                // Navega a la ruta principal si no hay historial previo
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        }
    });
});