sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.AddProduct", {

        // =================================================================
        //  Funciones de Validación
        // =================================================================
        _validation: {
            /**
             * Valida los datos principales de un nuevo producto (Paso 1 del wizard).
             * @param {object} productData - El objeto con los datos del producto.
             * @returns {{errors: object, errorMessages: string[]}} - Un objeto con los campos erróneos y una lista de mensajes.
             */
            validateNewProduct: function (productData) {
                const errorMessages = [];
                const errors = {};

                if (!productData.PRODUCTNAME || productData.PRODUCTNAME.trim() === '') {
                    errorMessages.push('El nombre del producto es obligatorio.');
                    errors.PRODUCTNAME = "Error";
                } else if (productData.PRODUCTNAME.trim().length < 3) {
                    errorMessages.push('El nombre del producto debe tener al menos 3 caracteres.');
                    errors.PRODUCTNAME = "Error";
                }

                if (!productData.DESSKU || productData.DESSKU.trim() === '') {
                    errorMessages.push('La descripción es obligatoria.');
                    errors.DESSKU = "Error";
                }

                if (!productData.MARCA || productData.MARCA.trim() === '') {
                    errorMessages.push('La marca es obligatoria.');
                    errors.MARCA = "Error";
                }

                if (!productData.IDUNIDADMEDIDA || productData.IDUNIDADMEDIDA.trim() === '') {
                    errorMessages.push('La unidad de medida es obligatoria.');
                    errors.IDUNIDADMEDIDA = "Error";
                }

                return { errors, errorMessages };
            },

            /**
             * Valida los datos de una presentación (Paso 2 del wizard).
             * @param {object} presentationData - El objeto con los datos de la presentación.
             * @returns {{errors: object, errorMessages: string[]}} - Un objeto con los campos erróneos y una lista de mensajes.
             */
            validatePresentation: function (presentationData) {
                const errorMessages = [];
                const errors = {};

                if (!presentationData.IdPresentaOK || presentationData.IdPresentaOK.trim() === '') {
                    errorMessages.push('El ID de la presentación (generado por el nombre) es obligatorio.');
                    errors.NOMBREPRESENTACION = "Error";
                }

                if (!presentationData.NOMBREPRESENTACION || presentationData.NOMBREPRESENTACION.trim() === '') {
                    errorMessages.push('El nombre de la presentación es obligatorio.');
                    errors.NOMBREPRESENTACION = "Error";
                }

                if (!presentationData.Descripcion || presentationData.Descripcion.trim() === '') {
                    errorMessages.push('La descripción de la presentación es obligatoria.');
                    errors.Descripcion = "Error";
                }
                return { errors, errorMessages };
            }
        },

        onInit: function () {
            this._skuSuffix = null;
            this._barcode = null;

            this._initializeModel();
            this._loadCategories();

            this._initializeNavContainer();

            this.getOwnerComponent().getRouter().getRoute("RouteAddProduct").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            this._initializeNavContainer();
            this._initializeModel();
            this._loadCategories();
        },

        _initializeNavContainer: function() {
            const oNavContainer = this.getView().byId("stepNavContainer");
            const oFirstPage = this.getView().byId("ProductStepPage");
            if (oNavContainer && oFirstPage) {
                oNavContainer.to(oFirstPage, "show");
            }
        },

        onNavBack: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMain", {}, true);
        },

        _initializeModel: function () {
            const oInitialData = {
                // --- Datos del Producto Padre ---
                SKUID: '',
                PRODUCTNAME: '',
                DESSKU: '',
                MARCA: '',
                IDUNIDADMEDIDA: 'PZA',
                CATEGORIAS: [],
                BARCODE: '',
                INFOAD: '',
                // --- Categorías ---
                allCategories: [],
                loadingCategories: true,
                // --- Presentaciones (Paso 2) ---
                presentations: [],
                newPresentation: {
                    IdPresentaOK: '',
                    Descripcion: '',
                    NOMBREPRESENTACION: '',
                    PropiedadesExtras: {},
                    files: [],
                },
                propKey: '',
                propValue: '',
                // --- Estado de la UI ---
                errors: {},
                newPresentationErrors: {},
                showGlobalError: false,
                // --- Navegación de pasos ---
                currentStep: 1,
                currentStepTitle: "Paso 1: Información del Producto",
                progressPercent: 33,
            };

            const oAddModel = new JSONModel(JSON.parse(JSON.stringify(oInitialData))); // Deep copy
            this.getView().setModel(oAddModel, "addProduct");
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
                    method: 'POST', // Forzar siempre el método POST
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(oData || {})
                });

                if (!oResponse.ok) {
                    const oErrorJson = await oResponse.json();
                    const sErrorMessage = oErrorJson.message || `Error ${oResponse.status}`;
                    throw new Error(sErrorMessage);
                }

                const oJson = await oResponse.json();
                
                // Adaptado para la estructura de respuesta de categorías
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
                    const mainResponse = oJson.data[0];
                    if (mainResponse.dataRes && Array.isArray(mainResponse.dataRes)) {
                        return mainResponse.dataRes;
                    }
                }
                
                console.warn("Estructura de respuesta no esperada, devolviendo JSON completo");
                return oJson; 
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        _loadCategories: async function () {
            const oModel = this.getView().getModel("addProduct");
            oModel.setProperty("/loadingCategories", true);
            try {
                const aCategories = await this._callApi('/ztcategorias/categoriasCRUD', 'POST', {}, { ProcessType: 'GetAll' });
                if (!Array.isArray(aCategories)) {
                    throw new Error("La respuesta de la API de categorías no es un array válido.");
                }
                oModel.setProperty("/allCategories", aCategories);
            } catch (error) {
                console.error("Error al cargar categorías", error);
                MessageBox.error("No se pudieron cargar las categorías. " + error.message);
            } finally {
                oModel.setProperty("/loadingCategories", false);
            }
        },

        onProductNameChange: function (oEvent) {
            const sProductName = oEvent.getParameter("value");
            const oModel = this.getView().getModel("addProduct");

            if (!sProductName || sProductName.trim() === '') {
                this._skuSuffix = null;
                this._barcode = null;
                oModel.setProperty("/SKUID", "");
                oModel.setProperty("/BARCODE", "");
                return;
            }

            // Generar y guardar el sufijo y barcode solo la primera vez que se escribe el nombre
            if (!this._skuSuffix) {
                this._skuSuffix = Date.now().toString(36).toUpperCase();
            }
            if (!this._barcode) {
                this._barcode = Date.now().toString().slice(0, 13);
            }

            const sBase = sProductName
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
                .toUpperCase()
                .replace(/[^A-Z0-9\s-]/g, '') // Quitar caracteres especiales
                .trim()
                .replace(/\s+/g, '-'); // Reemplazar espacios con guiones

            const sSkuId = `${sBase.slice(0, 40)}-${this._skuSuffix}`;

            oModel.setProperty("/SKUID", sSkuId);
            oModel.setProperty("/BARCODE", this._barcode);

            this.onAddProductInputChange(oEvent); // Para limpiar el estado de error
        },

        onAddProductInputChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const sFieldId = oInput.getId().includes("productNameInput") ? "PRODUCTNAME" : oInput.getBindingPath("value").replace("/", "");
            const oModel = this.getView().getModel("addProduct");
            if (oModel.getProperty(`/errors/${sFieldId}`)) {
                oModel.setProperty(`/errors/${sFieldId}`, null);
            }
        },

        // ============================================================
        // PASO 2: LÓGICA DE PRESENTACIONES
        // ============================================================

        onPresentationNameChange: function(oEvent) {
            const sPresName = oEvent.getParameter("value");
            const oModel = this.getView().getModel("addProduct");
            const sProductSKU = oModel.getProperty("/SKUID");

            if (sPresName && sProductSKU) {
                const presentationSlug = sPresName
                    .trim()
                    .toUpperCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^A-Z0-9-]/g, '');
                const generatedId = `${sProductSKU}-${presentationSlug}`;
                oModel.setProperty("/newPresentation/IdPresentaOK", generatedId);
            } else {
                oModel.setProperty("/newPresentation/IdPresentaOK", "");
            }
            this.onPresentationInputChange(oEvent);
        },

        onPresentationInputChange: function(oEvent) {
            const oInput = oEvent.getSource();
            const sFieldId = oInput.getBindingPath("value").replace("/newPresentation/", "");
            const oModel = this.getView().getModel("addProduct");
            if (oModel.getProperty(`/newPresentationErrors/${sFieldId}`)) {
                oModel.setProperty(`/newPresentationErrors/${sFieldId}`, null);
            }
        },

        onAddProperty: function () {
            const oModel = this.getView().getModel("addProduct");
            const sKey = oModel.getProperty("/propKey");
            const sValue = oModel.getProperty("/propValue");

            if (sKey) {
                const oProps = oModel.getProperty("/newPresentation/PropiedadesExtras");
                const aPropsArray = Array.isArray(oProps) ? oProps : [];
                aPropsArray.push({ key: sKey, value: sValue });

                oModel.setProperty("/newPresentation/PropiedadesExtras", aPropsArray);
                oModel.setProperty("/propKey", "");
                oModel.setProperty("/propValue", "");
                // No es necesario refresh(true) si el binding es correcto
            }
        },

        onFileChange: function (oEvent) {
            const oModel = this.getView().getModel("addProduct");
            const aFiles = oEvent.getParameter("files");

            Array.from(aFiles).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = reader.result;
                    const newFile = {
                        fileBase64: base64String,
                        FILETYPE: file.type.startsWith('image/') ? 'IMG' : file.type === 'application/pdf' ? 'PDF' : 'OTHER',
                        originalname: file.name,
                        mimetype: file.type,
                        PRINCIPAL: oModel.getProperty("/newPresentation/files").length === 0,
                        INFOAD: `Archivo ${file.name}`
                    };

                    const aCurrentFiles = oModel.getProperty("/newPresentation/files");
                    aCurrentFiles.push(newFile);
                    oModel.setProperty("/newPresentation/files", aCurrentFiles);
                    oModel.refresh(true);
                };
                reader.readAsDataURL(file);
            });
        },

        onRemoveFile: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("addProduct");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("addProduct");
            const aFiles = oModel.getProperty("/newPresentation/files");
            aFiles.splice(iIndex, 1);
            oModel.setProperty("/newPresentation/files", aFiles);
            oModel.refresh(true);
        },

        onAddPresentation: function () {
            const oModel = this.getView().getModel("addProduct");
            const oNewPresentation = oModel.getProperty("/newPresentation");

            // Usar la nueva función de validación
            const validationResult = this._validation.validatePresentation(oNewPresentation);
            oModel.setProperty("/newPresentationErrors", validationResult.errors);

            if (validationResult.errorMessages.length > 0) {
                // Formatear errores para MessageBox
                const sErrorText = validationResult.errorMessages.map(e => `• ${e}`).join("\n");
                MessageBox.error("Por favor, corrija los siguientes errores en la presentación:\n\n" + sErrorText);
                return;
            }
            oModel.setProperty("/newPresentationErrors", {}); // Limpiar errores si es válido

            const oPresentationToAdd = JSON.parse(JSON.stringify(oNewPresentation));
            // Convertir PropiedadesExtras a un array de objetos para el binding de la agregación
            // El modelo ya debería tener un array, pero nos aseguramos
            if (!Array.isArray(oPresentationToAdd.PropiedadesExtras)) {
                 oPresentationToAdd.PropiedadesExtras = Object.entries(oPresentationToAdd.PropiedadesExtras).map(([key, value]) => ({ key, value }));
            }

            const aPresentations = oModel.getProperty("/presentations");
            aPresentations.push(oPresentationToAdd);
            oModel.setProperty("/presentations", aPresentations);

            // Resetear el formulario de nueva presentación
            oModel.setProperty("/newPresentation", {
                IdPresentaOK: '', Descripcion: '', NOMBREPRESENTACION: '', PropiedadesExtras: [], files: []
            });
            oModel.setProperty("/propKey", "");
            oModel.setProperty("/propValue", "");
            this.getView().byId("fileUploader").clear();
            oModel.refresh(true);

            MessageToast.show("Presentación añadida a la lista.");
        },

        onRemovePresentation: function(oEvent) {
            const oItem = oEvent.getSource().getParent().getParent(); // VBox -> FlexBox -> CustomListItem
            const oContext = oItem.getBindingContext("addProduct");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("addProduct");
            const aPresentations = oModel.getProperty("/presentations");
            aPresentations.splice(iIndex, 1);
            oModel.setProperty("/presentations", aPresentations);
            oModel.refresh(true);
        },

        // ============================================================
        // PASO 3: REVISIÓN Y GUARDADO
        // ============================================================

        getCategoryName: function(sCatId) {
            const oModel = this.getView().getModel("addProduct");
            const aCategories = oModel.getProperty("/allCategories");
            const oCategory = aCategories.find(cat => cat.CATID === sCatId);
            return oCategory ? oCategory.Nombre : sCatId;
        },

        _validateStep1: function() {
            const oModel = this.getView().getModel("addProduct");
            const productData = oModel.getProperty("/");

            const validationResult = this._validation.validateNewProduct(productData);
            oModel.setProperty("/errors", validationResult.errors);

            if (validationResult.errorMessages.length > 0) {
                const sErrorText = validationResult.errorMessages.map(e => `• ${e}`).join("\n");
                MessageBox.error("Por favor, corrija los siguientes errores en la información del producto:\n\n" + sErrorText);
                return false;
            }
            return true;
        },

        _validateStep2: function() {
            const oModel = this.getView().getModel("addProduct");
            const aPresentations = oModel.getProperty("/presentations");
            if (!aPresentations || aPresentations.length === 0) {
                MessageBox.warning("Debe añadir al menos una presentación para continuar.");
                return false;
            }
            return true;
        },

        onSaveProduct: async function () {
            if (!this._validateStep1()) {
                this.onPreviousStep(null, "ProductStepPage");
                return; // Stop if step 1 is invalid
            }

            const oModel = this.getView().getModel("addProduct");
            const oData = oModel.getProperty("/");

            const oProductPayload = {
                SKUID: oData.SKUID,
                PRODUCTNAME: oData.PRODUCTNAME,
                DESSKU: oData.DESSKU,
                MARCA: oData.MARCA,
                IDUNIDADMEDIDA: oData.IDUNIDADMEDIDA,
                CATEGORIAS: oData.CATEGORIAS,
                BARCODE: oData.BARCODE,
                INFOAD: oData.INFOAD
            };

            const aPresentationsPayload = oData.presentations.map(pres => {
                // Si PropiedadesExtras ya es un array de {key, value}, lo convertimos a objeto
                let propsObject = {};
                if (Array.isArray(pres.PropiedadesExtras)) {
                    propsObject = pres.PropiedadesExtras.reduce((acc, prop) => {
                        acc[prop.key] = prop.value;
                        return acc;
                    }, {});
                }
                return { ...pres, PropiedadesExtras: JSON.stringify(propsObject), files: pres.files };
            });

            const oCompletePayload = {
                product: oProductPayload,
                presentations: aPresentationsPayload
            };

            // Console log for debugging the final payload
            console.log("Final Payload to be sent:", JSON.stringify(oCompletePayload, null, 2));

            try {
                const oResponse = await this._callApi('/add-product/createCompleteProduct', 'POST', oCompletePayload);
                if (oResponse.success) {
                    MessageBox.success("Producto creado exitosamente.", {
                        onClose: () => this.onNavBack()
                    });
                } else {
                    throw new Error(oResponse.message || "La API indicó un error no especificado.");
                }
            } catch (error) {
                MessageBox.error("Error al guardar el producto: " + error.message);
            }
        },

        onNextStep: function() {
            const oModel = this.getView().getModel("addProduct");
            const currentStep = oModel.getProperty("/currentStep");

            let bIsValid = true;
            if (currentStep === 1) {
                bIsValid = this._validateStep1();
            } else if (currentStep === 2) {
                bIsValid = this._validateStep2();
            }

            if (!bIsValid) {
                return;
            }

            const oNavContainer = this.getView().byId("stepNavContainer");
            let nextPage;
            let stepTitle;
            let progressPercent;

            if (currentStep === 1) {
                nextPage = this.getView().byId("PresentationsStepPage");
                stepTitle = "Paso 2: Presentaciones";
                progressPercent = 66;
            } else if (currentStep === 2) {
                nextPage = this.getView().byId("ReviewStepPage");
                stepTitle = "Paso 3: Revisión y Confirmación";
                progressPercent = 100;
                oModel.refresh(true); // Refresh for review step
            }

            if (nextPage && oNavContainer) {
                oNavContainer.to(nextPage);
                oModel.setProperty("/currentStep", currentStep + 1);
                oModel.setProperty("/currentStepTitle", stepTitle);
                oModel.setProperty("/progressPercent", progressPercent);
            }
        },

        onPreviousStep: function(oEvent, sTargetPageId) {
            const oModel = this.getView().getModel("addProduct");
            const currentStep = oModel.getProperty("/currentStep");

            if (currentStep <= 1 && !sTargetPageId) return;

            const oNavContainer = this.getView().byId("stepNavContainer");
            let prevPage;
            let stepTitle;
            let progressPercent;

            if (sTargetPageId) { // Direct navigation
                prevPage = this.getView().byId(sTargetPageId);
                if (sTargetPageId === "ProductStepPage") {
                    oModel.setProperty("/currentStep", 1);
                    oModel.setProperty("/currentStepTitle", "Paso 1: Información del Producto");
                    oModel.setProperty("/progressPercent", 33);
                }
            } else if (currentStep === 2) {
                prevPage = this.getView().byId("ProductStepPage");
                oModel.setProperty("/currentStep", 1);
                oModel.setProperty("/currentStepTitle", "Paso 1: Información del Producto");
                oModel.setProperty("/progressPercent", 33);
            } else if (currentStep === 3) {
                prevPage = this.getView().byId("PresentationsStepPage");
                oModel.setProperty("/currentStep", 2);
                oModel.setProperty("/currentStepTitle", "Paso 2: Presentaciones");
                oModel.setProperty("/progressPercent", 66);
            }

            if (prevPage && oNavContainer) {
                oNavContainer.backToPage(prevPage.getId());
            }
        }
    });
});