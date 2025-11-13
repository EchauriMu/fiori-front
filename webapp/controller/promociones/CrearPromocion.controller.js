sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/format/DateFormat"
], function (Controller, JSONModel, MessageBox, MessageToast, Fragment, DateFormat) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.promociones.CrearPromocion", {

        onInit: function () {
            this._initializeModel();
            
            this.getOwnerComponent().getRouter().getRoute("RouteCrearPromocion")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            this.getView().byId("createPromoWizard").discardProgress(this.getView().byId("InfoStep"));
            this._initializeModel();
        },

        onNavBack: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RoutePromociones", {}, true);
        },

        _initializeModel: function () {
            const today = new Date();
            const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            const oInitialData = {
                // Información general
                plantilla: "",
                titulo: "",
                descripcion: "",
                fechaInicio: this._formatDateForInput(today),
                fechaFin: this._formatDateForInput(oneMonthLater),
                
                // Descuento
                tipoDescuento: "PORCENTAJE",
                descuentoPorcentaje: 10,
                descuentoMonto: 0,
                
                // Reglas
                permiteAcumulacion: false,
                limiteUsos: null,
                
                // Productos/Presentaciones
                selectedPresentaciones: [],
                
                // Estado
                errors: {}
            };

            const oModel = new JSONModel(JSON.parse(JSON.stringify(oInitialData)));
            this.getView().setModel(oModel, "createPromo");
        },

        _formatDateForInput: function(oDate) {
            const year = oDate.getFullYear();
            const month = String(oDate.getMonth() + 1).padStart(2, '0');
            const day = String(oDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
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
                return oJson;
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        // Formatters
        formatDate: function(sDate) {
            if (!sDate) return "N/A";
            try {
                const oDate = new Date(sDate);
                const oDateFormat = DateFormat.getDateInstance({
                    pattern: "dd/MM/yyyy"
                });
                return oDateFormat.format(oDate);
            } catch (e) {
                return "Fecha inválida";
            }
        },

        // Event Handlers
        onPlantillaChange: function(oEvent) {
            const sPlantilla = oEvent.getParameter("selectedItem").getKey();
            const oModel = this.getView().getModel("createPromo");
            
            // Plantillas predefinidas
            const oPlantillas = {
                "black-friday": {
                    titulo: "Black Friday 2025 - Ofertas Especiales",
                    descripcion: "Descuentos increíbles por tiempo limitado. ¡No te lo pierdas!",
                    descuentoPorcentaje: 25
                },
                "navidad": {
                    titulo: "Promoción Navideña 2025",
                    descripcion: "Regalos perfectos con precios especiales para esta Navidad.",
                    descuentoPorcentaje: 20
                },
                "flash-sale": {
                    titulo: "Flash Sale - 24 Horas",
                    descripcion: "Ofertas relámpago por tiempo muy limitado.",
                    descuentoPorcentaje: 30
                },
                "lanzamiento": {
                    titulo: "Promoción de Lanzamiento",
                    descripcion: "Celebra el lanzamiento de nuevos productos con ofertas especiales.",
                    descuentoPorcentaje: 15
                }
            };

            if (sPlantilla && oPlantillas[sPlantilla]) {
                const oPlantillaData = oPlantillas[sPlantilla];
                oModel.setProperty("/titulo", oPlantillaData.titulo);
                oModel.setProperty("/descripcion", oPlantillaData.descripcion);
                oModel.setProperty("/descuentoPorcentaje", oPlantillaData.descuentoPorcentaje);
            }
        },

        onTipoDescuentoChange: function(oEvent) {
            const oModel = this.getView().getModel("createPromo");
            oModel.setProperty("/errors/descuentoPorcentaje", null);
            oModel.setProperty("/errors/descuentoMonto", null);
        },

        onPromoInputChange: function(oEvent) {
            const oInput = oEvent.getSource();
            let sFieldId;
            
            if (oInput.getId().includes("tituloInput")) {
                sFieldId = "titulo";
            } else {
                const sPath = oInput.getBindingPath("value");
                if (sPath) {
                    sFieldId = sPath.replace("createPromo>/", "").replace("/", "");
                }
            }
            
            if (sFieldId) {
                const oModel = this.getView().getModel("createPromo");
                if (oModel.getProperty(`/errors/${sFieldId}`)) {
                    oModel.setProperty(`/errors/${sFieldId}`, null);
                }
            }
        },

        onOpenFilterDialog: function() {
            const oView = this.getView();
            
            // Crear el diálogo si no existe
            if (!this._filterDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.promociones.fragments.FilterDialog",
                    controller: this
                }).then(function(oDialog) {
                    this._filterDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._loadProductsForFilter();
                    oDialog.open();
                }.bind(this));
            } else {
                this._loadProductsForFilter();
                this._filterDialog.open();
            }
        },

        _loadProductsForFilter: async function() {
            // TODO: Cargar productos desde la API para el filtro
            console.log("Cargando productos para filtro...");
        },

        onFilterDialogConfirm: function(oEvent) {
            // Obtener presentaciones seleccionadas del diálogo
            const oModel = this.getView().getModel("createPromo");
            const aSelected = []; // TODO: Obtener del modelo del filtro
            
            oModel.setProperty("/selectedPresentaciones", aSelected);
            this._filterDialog.close();
        },

        onFilterDialogCancel: function() {
            this._filterDialog.close();
        },

        onRemovePresentacion: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext("createPromo");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("createPromo");
            const aPresentaciones = oModel.getProperty("/selectedPresentaciones");
            aPresentaciones.splice(iIndex, 1);
            oModel.setProperty("/selectedPresentaciones", aPresentaciones);
            oModel.refresh(true);
        },

        onStepActivate: function(oEvent) {
            const sStepId = oEvent.getSource().getId();
            if (sStepId.includes("ReviewStep")) {
                this.getView().getModel("createPromo").refresh();
            }
        },

        _validateStep1: function() {
            const oModel = this.getView().getModel("createPromo");
            const oData = oModel.getProperty("/");
            const oErrors = {};
            let bIsValid = true;

            if (!oData.titulo || oData.titulo.trim() === "") { 
                oErrors.titulo = "Error"; 
                bIsValid = false; 
            }
            if (!oData.descripcion || oData.descripcion.trim() === "") { 
                oErrors.descripcion = "Error"; 
                bIsValid = false; 
            }
            if (!oData.fechaInicio) { 
                oErrors.fechaInicio = "Error"; 
                bIsValid = false; 
            }
            if (!oData.fechaFin) { 
                oErrors.fechaFin = "Error"; 
                bIsValid = false; 
            }

            // Validar que la fecha de fin sea posterior a la de inicio
            if (oData.fechaInicio && oData.fechaFin) {
                const dInicio = new Date(oData.fechaInicio);
                const dFin = new Date(oData.fechaFin);
                if (dFin <= dInicio) {
                    oErrors.fechaFin = "Error";
                    bIsValid = false;
                    MessageBox.error("La fecha de fin debe ser posterior a la fecha de inicio.");
                }
            }

            oModel.setProperty("/errors", oErrors);
            if (!bIsValid) {
                MessageBox.error("Por favor, complete todos los campos obligatorios.");
            }
            return bIsValid;
        },

        _validateStep2: function() {
            const oModel = this.getView().getModel("createPromo");
            const oData = oModel.getProperty("/");
            const oErrors = {};
            let bIsValid = true;

            if (oData.tipoDescuento === "PORCENTAJE") {
                if (!oData.descuentoPorcentaje || oData.descuentoPorcentaje <= 0 || oData.descuentoPorcentaje > 100) {
                    oErrors.descuentoPorcentaje = "Error";
                    bIsValid = false;
                    MessageBox.error("El porcentaje de descuento debe estar entre 1 y 100.");
                }
            } else if (oData.tipoDescuento === "MONTO_FIJO") {
                if (!oData.descuentoMonto || oData.descuentoMonto <= 0) {
                    oErrors.descuentoMonto = "Error";
                    bIsValid = false;
                    MessageBox.error("El monto de descuento debe ser mayor a 0.");
                }
            }

            oModel.setProperty("/errors", oErrors);
            return bIsValid;
        },

        _validateStep3: function() {
            const oModel = this.getView().getModel("createPromo");
            const aPresentaciones = oModel.getProperty("/selectedPresentaciones");
            
            if (!aPresentaciones || aPresentaciones.length === 0) {
                MessageBox.error("Debe seleccionar al menos una presentación para la promoción.");
                return false;
            }
            
            return true;
        },

        onSavePromotion: async function () {
            // Validar todos los pasos
            if (!this._validateStep1()) {
                this.getView().byId("createPromoWizard").goToStep(this.getView().byId("InfoStep"));
                return;
            }

            if (!this._validateStep2()) {
                this.getView().byId("createPromoWizard").goToStep(this.getView().byId("DiscountStep"));
                return;
            }

            if (!this._validateStep3()) {
                this.getView().byId("createPromoWizard").goToStep(this.getView().byId("ProductsStep"));
                return;
            }

            const oModel = this.getView().getModel("createPromo");
            const oData = oModel.getProperty("/");

            // Generar ID único para la promoción
            const timestamp = Date.now();
            const shortId = timestamp.toString().slice(-6);
            const idPromoOK = `PROMO-${shortId}`;

            // Preparar presentaciones aplicables
            const presentacionesAplicables = oData.selectedPresentaciones
                .filter(presentacion => presentacion && presentacion.IdPresentaOK)
                .map(presentacion => ({
                    IdPresentaOK: presentacion.IdPresentaOK,
                    SKUID: presentacion.producto?.SKUID || presentacion.SKUID || '',
                    NombreProducto: presentacion.producto?.PRODUCTNAME || '',
                    NombrePresentacion: presentacion.NOMBREPRESENTACION || '',
                    PrecioOriginal: presentacion.Precio || 0
                }));

            // Preparar payload
            const oPromoPayload = {
                IdPromoOK: idPromoOK,
                Titulo: oData.titulo,
                Descripcion: oData.descripcion,
                FechaIni: new Date(oData.fechaInicio).toISOString(),
                FechaFin: new Date(oData.fechaFin).toISOString(),
                ProductosAplicables: presentacionesAplicables,
                TipoDescuento: oData.tipoDescuento,
                DescuentoPorcentaje: oData.tipoDescuento === 'PORCENTAJE' ? oData.descuentoPorcentaje : 0,
                DescuentoMonto: oData.tipoDescuento === 'MONTO_FIJO' ? oData.descuentoMonto : 0,
                PermiteAcumulacion: oData.permiteAcumulacion || false,
                LimiteUsos: oData.limiteUsos || null,
                ACTIVED: true,
                DELETED: false
            };

            console.log("📤 Payload a enviar:", oPromoPayload);

            try {
                const oResponse = await this._callApi('/ztpromociones/crudPromociones', 'POST', oPromoPayload, {
                    ProcessType: 'AddOne',
                    DBServer: 'MongoDB'
                });
                
                console.log("✅ Promoción creada exitosamente:", oResponse);
                
                MessageBox.success(`Promoción "${oData.titulo}" creada exitosamente.`, {
                    onClose: () => this.onNavBack()
                });
            } catch (error) {
                console.error("❌ Error al crear promoción:", error);
                MessageBox.error("Error al crear la promoción: " + error.message);
            }
        }
    });
});
